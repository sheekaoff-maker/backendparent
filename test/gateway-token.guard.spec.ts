import { createHmac, createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { GatewayTokenGuard } from '../src/common/guards/gateway-token.guard';

const GATEWAY = { id: 'gw-1', token: 'tok-123', paired: true };

function buildPrisma(gateway: any = GATEWAY) {
  return { gateway: { findUnique: jest.fn().mockResolvedValue(gateway) } } as any;
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
