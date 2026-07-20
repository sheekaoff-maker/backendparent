import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PairingRepository } from './pairing.repository';
import { AuditService } from '../audit/audit.service';
import { PAIR_TOKEN_TTL_MS, pairHostnameFor } from './pairing.constants';
import { computeConnectionQuality } from './connection-quality';
import {
  ConfirmPairingDto,
  ConnectionStatsResponseDto,
  PairingStatusResponseDto,
  StartPairingResponseDto,
} from './dto/pairing.dto';

const DNS_SERVER_HOST = process.env.DNS_RESOLVER_PUBLIC_HOST || 'dns.guardtime.app';

@Injectable()
export class PairingService {
  private readonly logger = new Logger(PairingService.name);

  constructor(
    private readonly repo: PairingRepository,
    private readonly audit: AuditService,
  ) {}

  /** Starts (or restarts) pairing for a device the requesting parent owns. */
  async startPairing(deviceId: string, parentId: string): Promise<StartPairingResponseDto> {
    const device = await this.repo.findDeviceForOwner(deviceId);
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('You do not own this device');

    // One live session per device — starting again invalidates any prior one.
    await this.repo.deleteWaitingSessionsForDevice(deviceId);

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + PAIR_TOKEN_TTL_MS);
    const session = await this.repo.createSession({ deviceId, parentId, token, expiresAt });
    await this.repo.setDevicePairStatus(deviceId, 'WAITING');

    await this.audit.log({
      userId: parentId,
      action: 'pairing.start',
      entity: 'device',
      entityId: deviceId,
    });

    const hostname = pairHostnameFor(token);
    return {
      sessionId: session.id,
      dnsServer: DNS_SERVER_HOST,
      token,
      expiresAt: expiresAt.toISOString(),
      qrPayload: JSON.stringify({ v: 1, deviceId, token, dnsServer: DNS_SERVER_HOST, probeHost: hostname }),
    };
  }

  async getStatus(deviceId: string, parentId: string): Promise<PairingStatusResponseDto> {
    const device = await this.repo.findDeviceForOwner(deviceId);
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('You do not own this device');

    return {
      pairStatus: device.pairStatus,
      paired: device.paired,
      pairedAt: device.pairedAt?.toISOString() ?? null,
      dnsSourceIp: device.dnsSourceIp,
      publicIp: device.publicIp,
      resolverRegion: device.resolverRegion,
      lastDnsSeenAt: device.lastDnsSeenAt?.toISOString() ?? null,
      connectionQuality: computeConnectionQuality(device.lastDnsSeenAt),
      beaconToken: device.paired ? device.dnsBeaconToken : null,
    };
  }

  /** Connection detail view for the device page: today's query count, recent events, IP history. */
  async getConnectionStats(deviceId: string, parentId: string): Promise<ConnectionStatsResponseDto> {
    const device = await this.repo.findDeviceForOwner(deviceId);
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('You do not own this device');

    const midnightUtc = new Date();
    midnightUtc.setUTCHours(0, 0, 0, 0);

    const [queriesToday, lastQuery, recentEvents, ipHistory] = await Promise.all([
      device.dnsSourceIp ? this.repo.countQueriesSince(device.dnsSourceIp, midnightUtc) : Promise.resolve(0),
      device.dnsSourceIp ? this.repo.lastQueryFor(device.dnsSourceIp) : Promise.resolve(null),
      this.repo.listRecentConnectionEvents(deviceId),
      this.repo.listIpHistory(deviceId),
    ]);

    return {
      paired: device.paired,
      connectionQuality: computeConnectionQuality(device.lastDnsSeenAt),
      lastDnsSeenAt: device.lastDnsSeenAt?.toISOString() ?? null,
      dnsSourceIp: device.dnsSourceIp,
      publicIp: device.publicIp,
      resolverRegion: device.resolverRegion,
      queriesToday,
      lastQueryDomain: lastQuery?.domain ?? null,
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        type: e.type,
        ipAddress: e.ipAddress,
        metadata: e.metadata as Record<string, unknown> | null,
        createdAt: e.createdAt.toISOString(),
      })),
      ipHistory: ipHistory.map((h) => ({
        ipAddress: h.ipAddress,
        firstSeenAt: h.firstSeenAt.toISOString(),
        lastSeenAt: h.lastSeenAt.toISOString(),
      })),
    };
  }

  async cancelPairing(deviceId: string, parentId: string): Promise<void> {
    const device = await this.repo.findDeviceForOwner(deviceId);
    if (!device) throw new NotFoundException('Device not found');
    if (device.parentId !== parentId) throw new ForbiddenException('You do not own this device');

    await this.repo.deleteWaitingSessionsForDevice(deviceId);
    await this.audit.log({ userId: parentId, action: 'pairing.cancel', entity: 'device', entityId: deviceId });
  }

  /**
   * Single entry point dns-service calls whenever it resolves any
   * `<token>.pair.guardtime.local` probe query — during initial pairing AND
   * for every later silent reaffirmation. Tries the one-time pairing token
   * first; if that misses, falls back to a device's long-lived beacon
   * token. One hostname pattern, one endpoint, two token spaces — this is
   * what makes IP auto-repair "no manual intervention" instead of a second
   * bespoke mechanism.
   */
  async confirmProbe(dto: ConfirmPairingDto): Promise<{ deviceId: string }> {
    const pairResult = await this.tryConfirmPairingSession(dto);
    if (pairResult) return pairResult;

    const device = await this.repo.findDeviceByBeaconToken(dto.token);
    if (!device) throw new NotFoundException('Unknown or expired pairing/beacon token');

    await this.recordHeartbeat(device.id, dto.sourceIp);
    return { deviceId: device.id };
  }

  /**
   * Called by dns-service (internal trust boundary, no parent JWT) the
   * instant the initial probe query `<token>.pair.guardtime.local`
   * resolves. Ownership was already proven when the session was created
   * under the parent's JWT in startPairing — the token itself is the
   * credential here. Returns null (not an error) if the token isn't a
   * pairing-session token, so confirmProbe can fall through to beacon
   * lookup.
   */
  private async tryConfirmPairingSession(dto: ConfirmPairingDto): Promise<{ deviceId: string } | null> {
    return this.repo.runInTransaction(async (tx) => {
      const session = await this.repo.findSessionByToken(dto.token, tx);
      if (!session) return null;

      if (session.status !== 'WAITING') {
        throw new BadRequestException(`Pairing session already ${session.status.toLowerCase()}`);
      }
      if (session.expiresAt.getTime() < Date.now()) {
        await this.repo.markSessionStatus(session.id, 'EXPIRED', tx);
        await this.repo.setDevicePairStatus(session.deviceId, 'EXPIRED');
        throw new BadRequestException('Pairing token expired — start pairing again');
      }

      const attempts = await this.repo.incrementSessionAttempts(session.id, tx);
      if (attempts.attempts > 5) {
        await this.repo.markSessionStatus(session.id, 'FAILED', tx);
        await this.repo.setDevicePairStatus(session.deviceId, 'FAILED');
        throw new BadRequestException('Too many pairing attempts — start pairing again');
      }

      const pairedAt = new Date();
      await this.repo.markDevicePaired(
        session.deviceId,
        {
          sourceIp: dto.sourceIp,
          resolverRegion: dto.resolverRegion ?? null,
          pairedAt,
          beaconToken: randomUUID(),
        },
        tx,
      );
      await this.repo.upsertIpHistory(session.deviceId, dto.sourceIp, pairedAt, tx);
      await this.repo.recordConnectionEvent(session.deviceId, 'PAIRED', dto.sourceIp, { via: 'probe' }, tx);
      await this.repo.deleteSession(session.id, tx);

      this.logger.log(`Device ${session.deviceId} paired from ${dto.sourceIp}`);
      await this.audit.log({
        action: 'pairing.confirmed',
        entity: 'device',
        entityId: session.deviceId,
        ipAddress: dto.sourceIp,
      });

      return { deviceId: session.deviceId };
    });
  }

  /**
   * Called on every regular (non-pairing) DNS query the resolver serves for
   * an already-paired device — keeps lastDnsSeenAt fresh and auto-repairs
   * dnsSourceIp when the household's public IP changes (DHCP renewal, ISP
   * failover), with no manual reconfiguration. See dns-policy.service.ts.
   */
  async recordHeartbeat(deviceId: string, sourceIp: string): Promise<void> {
    const device = await this.repo.findDeviceForOwner(deviceId);
    if (!device || !device.paired) return;

    const now = new Date();

    if (device.dnsSourceIp !== sourceIp) {
      await this.repo.runInTransaction(async (tx) => {
        await this.repo.applyIpChange(deviceId, sourceIp, now, tx);
        await this.repo.upsertIpHistory(deviceId, sourceIp, now, tx);
        await this.repo.recordConnectionEvent(deviceId, 'IP_CHANGED', sourceIp, { previous: device.dnsSourceIp }, tx);
      });
      this.logger.log(`Device ${deviceId} IP changed ${device.dnsSourceIp} -> ${sourceIp}, auto-repaired`);
    } else {
      await this.repo.upsertIpHistory(deviceId, sourceIp, now);
      await this.repo.touchLastSeen(deviceId, now);
    }
  }
}
