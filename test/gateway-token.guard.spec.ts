import { createHmac, createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { GatewayTokenGuard } from '../src/common/guards/gateway-token.guard';

const GATEWAY = { id: 'gw-1', token: 'tok-123', paired: true, previousToken: null, previousTokenExpiresAt: null };

function buildPrisma(gateway: any = GATEWAY, overrides: any = {}) {
  return {
    gateway: {
      findUnique: jest.fn().mockResolvedValue(gateway),
      findFirst: jest.fn().mockResolvedValue(null),
      ...overrides,
    },
  } as any;
}

function buildContext(headers: Record<string, string>, method = 'GET', url = '/gateway/policies', body: any = {}) {
  const request: any = { headers, method, url, originalUrl: url, body };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

function sign(token: string, method: string, path: string, body: any, timestamp: string) {
  const bodyStr = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
  const bodyHash = createHash('sha256').update(bodyStr).digest('hex');
  const signedString = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  return createHmac('sha256', token).update(signedString).digest('hex');
}

describe('GatewayTokenGuard', () => {
  it('accepts a plain token with no signature headers (backward compatible with already-deployed agents)', async () => {
    const guard = new GatewayTokenGuard(buildPrisma());
    const context = buildContext({ 'x-gateway-token': 'tok-123' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a request with no token at all', async () => {
    const guard = new GatewayTokenGuard(buildPrisma());
    const context = buildContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown or unpaired gateway token', async () => {
    const guard = new GatewayTokenGuard(buildPrisma(null));
    const context = buildContext({ 'x-gateway-token': 'wrong' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid signature within the timestamp window', async () => {
    const guard = new GatewayTokenGuard(buildPrisma());
    const timestamp = String(Date.now());
    const signature = sign('tok-123', 'GET', '/gateway/policies', {}, timestamp);
    const context = buildContext({
      'x-gateway-token': 'tok-123',
      'x-gateway-timestamp': timestamp,
      'x-gateway-signature': signature,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const guard = new GatewayTokenGuard(buildPrisma());
    const timestamp = String(Date.now());
    const context = buildContext({
      'x-gateway-token': 'tok-123',
      'x-gateway-timestamp': timestamp,
      'x-gateway-signature': 'a'.repeat(64),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(/Invalid request signature/);
  });

  it('rejects a signature computed with the wrong gateway token', async () => {
    const guard = new GatewayTokenGuard(buildPrisma());
    const timestamp = String(Date.now());
    const signature = sign('a-different-token', 'GET', '/gateway/policies', {}, timestamp);
    const context = buildContext({
      'x-gateway-token': 'tok-123',
      'x-gateway-timestamp': timestamp,
      'x-gateway-signature': signature,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(/Invalid request signature/);
  });

  it('rejects a signature whose timestamp is outside the replay window', async () => {
    const guard = new GatewayTokenGuard(buildPrisma());
    const staleTimestamp = String(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    const signature = sign('tok-123', 'GET', '/gateway/policies', {}, staleTimestamp);
    const context = buildContext({
      'x-gateway-token': 'tok-123',
      'x-gateway-timestamp': staleTimestamp,
      'x-gateway-signature': signature,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(/outside the allowed window/);
  });

  it('rejects a request that supplies only one of the two signature headers', async () => {
    const guard = new GatewayTokenGuard(buildPrisma());
    const context = buildContext({
      'x-gateway-token': 'tok-123',
      'x-gateway-timestamp': String(Date.now()),
      // signature header deliberately omitted
    });

    await expect(guard.canActivate(context)).rejects.toThrow(/both x-gateway-signature and x-gateway-timestamp/);
  });

  it('validates a signed POST request body correctly', async () => {
    const guard = new GatewayTokenGuard(buildPrisma());
    const timestamp = String(Date.now());
    const body = { detections: [{ deviceId: 'dev-1', provider: 'NordVPN', method: 'dns-pattern' }] };
    const signature = sign('tok-123', 'POST', '/gateway/vpn-detections', body, timestamp);
    const context = buildContext(
      { 'x-gateway-token': 'tok-123', 'x-gateway-timestamp': timestamp, 'x-gateway-signature': signature },
      'POST',
      '/gateway/vpn-detections',
      body,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a signed POST request if the body is tampered with after signing', async () => {
    const guard = new GatewayTokenGuard(buildPrisma());
    const timestamp = String(Date.now());
    const signedBody = { detections: [{ deviceId: 'dev-1', provider: 'NordVPN', method: 'dns-pattern' }] };
    const signature = sign('tok-123', 'POST', '/gateway/vpn-detections', signedBody, timestamp);
    const tamperedBody = { detections: [{ deviceId: 'dev-2', provider: 'NordVPN', method: 'dns-pattern' }] };
    const context = buildContext(
      { 'x-gateway-token': 'tok-123', 'x-gateway-timestamp': timestamp, 'x-gateway-signature': signature },
      'POST',
      '/gateway/vpn-detections',
      tamperedBody,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(/Invalid request signature/);
  });
});

describe('GatewayTokenGuard — previousToken grace period', () => {
  it('accepts the previous token while it is still within its grace window, and flags usedPreviousToken', async () => {
    const rotated = {
      id: 'gw-1',
      token: 'new-tok',
      previousToken: 'old-tok',
      previousTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      paired: true,
    };
    const prisma = buildPrisma(null, { findFirst: jest.fn().mockResolvedValue(rotated) });
    const guard = new GatewayTokenGuard(prisma);
    const request: any = { headers: { 'x-gateway-token': 'old-tok' }, method: 'GET', url: '/gateway/policies', body: {} };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.usedPreviousToken).toBe(true);
    expect(request.gateway).toBe(rotated);
    expect(prisma.gateway.findFirst).toHaveBeenCalledWith({
      where: { previousToken: 'old-tok', previousTokenExpiresAt: { gt: expect.any(Date) } },
    });
  });

  it('rejects the previous token once its grace window has expired (findFirst\'s own gt-filter excludes it, so it resolves null)', async () => {
    const prisma = buildPrisma(null, { findFirst: jest.fn().mockResolvedValue(null) });
    const guard = new GatewayTokenGuard(prisma);
    const context = buildContext({ 'x-gateway-token': 'old-tok' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('does not query previousToken at all when the current token already matched', async () => {
    const prisma = buildPrisma();
    const guard = new GatewayTokenGuard(prisma);
    const context = buildContext({ 'x-gateway-token': 'tok-123' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.gateway.findFirst).not.toHaveBeenCalled();
  });

  it('sets usedPreviousToken to false on a normal current-token request', async () => {
    const guard = new GatewayTokenGuard(buildPrisma());
    const request: any = { headers: { 'x-gateway-token': 'tok-123' }, method: 'GET', url: '/gateway/policies', body: {} };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;

    await guard.canActivate(context);
    expect(request.usedPreviousToken).toBe(false);
  });

  it('verifies a signature made with the OLD token when authenticated via the grace-period path', async () => {
    const rotated = {
      id: 'gw-1',
      token: 'new-tok',
      previousToken: 'old-tok',
      previousTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      paired: true,
    };
    const prisma = buildPrisma(null, { findFirst: jest.fn().mockResolvedValue(rotated) });
    const guard = new GatewayTokenGuard(prisma);
    const timestamp = String(Date.now());
    const signature = sign('old-tok', 'GET', '/gateway/policies', {}, timestamp);
    const context = buildContext({ 'x-gateway-token': 'old-tok', 'x-gateway-timestamp': timestamp, 'x-gateway-signature': signature });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
