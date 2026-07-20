import { Injectable } from '@nestjs/common';
import { Prisma, PairStatus, ConnectionEventType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

/**
 * Repository pattern: isolates every Prisma call the pairing feature makes
 * behind a plain-method interface, so PairingService's business logic
 * (ownership checks, expiry rules, transaction orchestration) can be unit
 * tested against a mocked repository instead of a real database.
 */
@Injectable()
export class PairingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDeviceForOwner(deviceId: string) {
    return this.prisma.device.findUnique({ where: { id: deviceId } });
  }

  findDeviceByBeaconToken(token: string) {
    return this.prisma.device.findUnique({ where: { dnsBeaconToken: token } });
  }

  deleteWaitingSessionsForDevice(deviceId: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.pairingSession.deleteMany({ where: { deviceId, status: 'WAITING' } });
  }

  createSession(data: { deviceId: string; parentId: string; token: string; expiresAt: Date }) {
    return this.prisma.pairingSession.create({ data: { ...data, status: 'WAITING' } });
  }

  findLatestWaitingSession(deviceId: string) {
    return this.prisma.pairingSession.findFirst({
      where: { deviceId, status: 'WAITING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  findSessionByToken(token: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.pairingSession.findUnique({ where: { token } });
  }

  markSessionStatus(id: string, status: PairStatus, tx: Prisma.TransactionClient = this.prisma) {
    return tx.pairingSession.update({ where: { id }, data: { status } });
  }

  incrementSessionAttempts(id: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.pairingSession.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  deleteSession(id: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.pairingSession.delete({ where: { id } });
  }

  markDevicePaired(
    deviceId: string,
    data: {
      sourceIp: string;
      resolverRegion: string | null;
      pairedAt: Date;
      beaconToken: string;
    },
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.device.update({
      where: { id: deviceId },
      data: {
        paired: true,
        pairStatus: 'PAIRED',
        pairedAt: data.pairedAt,
        dnsSourceIp: data.sourceIp,
        publicIp: data.sourceIp,
        dnsConfigured: true,
        lastDnsSeenAt: data.pairedAt,
        resolverRegion: data.resolverRegion,
        dnsBeaconToken: data.beaconToken,
      },
    });
  }

  setDevicePairStatus(deviceId: string, status: PairStatus) {
    return this.prisma.device.update({ where: { id: deviceId }, data: { pairStatus: status } });
  }

  touchLastSeen(deviceId: string, seenAt: Date) {
    return this.prisma.device.update({ where: { id: deviceId }, data: { lastDnsSeenAt: seenAt } });
  }

  applyIpChange(deviceId: string, ipAddress: string, seenAt: Date, tx: Prisma.TransactionClient = this.prisma) {
    return tx.device.update({
      where: { id: deviceId },
      data: { dnsSourceIp: ipAddress, publicIp: ipAddress, lastDnsSeenAt: seenAt },
    });
  }

  upsertIpHistory(deviceId: string, ipAddress: string, seenAt: Date, tx: Prisma.TransactionClient = this.prisma) {
    return tx.deviceIpHistory.upsert({
      where: { deviceId_ipAddress: { deviceId, ipAddress } },
      update: { lastSeenAt: seenAt },
      create: { deviceId, ipAddress, firstSeenAt: seenAt, lastSeenAt: seenAt },
    });
  }

  recordConnectionEvent(
    deviceId: string,
    type: ConnectionEventType,
    ipAddress: string | null,
    metadata?: Record<string, unknown>,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.deviceConnectionEvent.create({
      data: { deviceId, type, ipAddress, metadata: metadata as Prisma.InputJsonValue | undefined },
    });
  }

  listRecentConnectionEvents(deviceId: string, take = 20) {
    return this.prisma.deviceConnectionEvent.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  listIpHistory(deviceId: string) {
    return this.prisma.deviceIpHistory.findMany({
      where: { deviceId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  // --- Admin/listing queries ---

  listByParentAndStatus(parentId: string, pairStatus?: PairStatus) {
    return this.prisma.device.findMany({
      where: { parentId, ...(pairStatus ? { pairStatus } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
  }

  countQueriesSince(sourceIp: string, since: Date) {
    return this.prisma.dnsQueryLog.count({ where: { sourceIp, createdAt: { gte: since } } });
  }

  lastQueryFor(sourceIp: string) {
    return this.prisma.dnsQueryLog.findFirst({
      where: { sourceIp },
      orderBy: { createdAt: 'desc' },
    });
  }

  listExpiredSessions(take = 100) {
    return this.prisma.pairingSession.findMany({
      where: { status: 'WAITING', expiresAt: { lt: new Date() } },
      take,
    });
  }
}
