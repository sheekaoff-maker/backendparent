import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { computeFingerprintHash } from './device-fingerprint.util';

/**
 * Backfills `fingerprintHash` for devices that predate Layer 4 (only
 * macAddress known, no hostname/DHCP-client-id/vendor-OUI yet). Idempotent —
 * safe to run on every boot, same pattern as CategoriesService's domain seed.
 */
@Injectable()
export class DeviceFingerprintService implements OnModuleInit {
  private readonly logger = new Logger(DeviceFingerprintService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const pending = await this.prisma.device.findMany({
        where: { fingerprintHash: null, macAddress: { not: null } },
        select: { id: true, macAddress: true, hostname: true, dhcpClientId: true, vendorOui: true },
      });

      if (pending.length === 0) {
        this.logger.log('Device fingerprint backfill: nothing pending — skipping');
        return;
      }

      this.logger.log(`Backfilling fingerprintHash for ${pending.length} device(s)...`);
      const now = new Date();
      for (const device of pending) {
        const fingerprintHash = computeFingerprintHash({
          macAddress: device.macAddress,
          hostname: device.hostname,
          dhcpClientId: device.dhcpClientId,
          vendorOui: device.vendorOui,
        });
        await this.prisma.device.update({
          where: { id: device.id },
          data: { fingerprintHash, fingerprintUpdatedAt: now },
        });
      }
      this.logger.log('Device fingerprint backfill complete');
    } catch (err: any) {
      this.logger.warn(`Device fingerprint backfill failed: ${err.message}`);
    }
  }
}
