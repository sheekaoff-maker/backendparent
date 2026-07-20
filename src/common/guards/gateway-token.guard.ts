import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma.service';

// 5 minutes: generous enough for reasonable clock drift on router hardware
// (which frequently has no RTC battery and gets its clock from NTP/DHCP at
// boot), tight enough to bound how long a captured request stays replayable.
// This is a replay-WINDOW, not a nonce-tracking scheme — see the class doc
// comment for why that's the honest scope here.
const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class GatewayTokenGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  /**
   * Request signing is additive and backward-compatible, not required:
   * gateway-agent instances already deployed in the field (this runs on
   * customers' own router hardware, so a backend deploy can't force an
   * instant upgrade) keep working with the plain `x-gateway-token` header
   * alone. An agent that also sends `x-gateway-timestamp` +
   * `x-gateway-signature` gets the stronger check — HMAC-SHA256 over
   * `method\npath\ntimestamp\nsha256(body)`, keyed by the gateway's own
   * token, verified in constant time — and its timestamp must fall within
   * SIGNATURE_WINDOW_MS of "now".
   *
   * This is a replay-WINDOW, not a full anti-replay nonce store: a captured
   * signed request stays replayable until its timestamp ages out, not
   * exactly-once. Given the endpoints this guards are either idempotent
   * reads (GET /gateway/policies) or mutations gated by a device already
   * belonging to that gateway (block/unblock/ack), the risk a wider nonce
   * store would additionally close is small relative to the complexity of
   * adding one (a shared nonce cache across gateway-agent restarts). Noted
   * here rather than silently left unstated.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-gateway-token'] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Missing gateway token');
    }
    const gateway = await this.prisma.gateway.findUnique({ where: { token } });
    if (!gateway || !gateway.paired) {
      throw new UnauthorizedException('Invalid or unpaired gateway token');
    }

    const signature = request.headers['x-gateway-signature'] as string | undefined;
    const timestamp = request.headers['x-gateway-timestamp'] as string | undefined;
    if (signature || timestamp) {
      this.verifySignature(request, gateway.token, signature, timestamp);
    }

    request.gateway = gateway;
    return true;
  }

  private verifySignature(request: any, gatewayToken: string, signature?: string, timestamp?: string): void {
    if (!signature || !timestamp) {
      throw new UnauthorizedException('Partial request signature (both x-gateway-signature and x-gateway-timestamp are required together)');
    }

    const timestampMs = Number(timestamp);
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > SIGNATURE_WINDOW_MS) {
      throw new UnauthorizedException('Request signature timestamp is missing, malformed, or outside the allowed window');
    }

    const bodyHash = createHash('sha256')
      .update(request.body && Object.keys(request.body).length > 0 ? JSON.stringify(request.body) : '')
      .digest('hex');
    const signedString = `${request.method}\n${request.originalUrl || request.url}\n${timestamp}\n${bodyHash}`;
    const expected = createHmac('sha256', gatewayToken).update(signedString).digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');
    const valid = expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
    if (!valid) {
      throw new UnauthorizedException('Invalid request signature');
    }
  }
}
