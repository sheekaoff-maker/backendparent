import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RouterDatabaseService } from './router-database.service';
import { RouterDetectionMethod, RouterIntegrationStatus } from '@prisma/client';

export interface RouterDetectionReport {
  vendor?: string;
  model?: string;
  firmwareVersion?: string;
  detectionMethod?: RouterDetectionMethod;
  macOui?: string;
  ipAddress?: string;
  hostname?: string;
  confidence?: number;
}

@Injectable()
export class RouterDetectionService {
  constructor(
    private prisma: PrismaService,
    private routerDatabase: RouterDatabaseService,
  ) {}

  /**
   * Reported by gateway-agent after a discovery scan (UPnP/SSDP/mDNS/OUI/
   * HTTP-header fingerprinting — see gateway-agent/src/router-discovery.js).
   * Resolves the vendor string to a known pluginId and its integration
   * status via RouterDatabaseService; unrecognized vendors stay UNDETECTED
   * rather than being guessed into a plugin they don't match.
   */
  async recordDetection(gatewayId: string, report: RouterDetectionReport) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');

    const pluginId = this.routerDatabase.resolveVendorNameToPluginId(report.vendor);
    const capabilities = pluginId ? this.routerDatabase.getCapabilities(pluginId) : null;
    const integrationStatus: RouterIntegrationStatus = capabilities
      ? (capabilities.integrationStatus as RouterIntegrationStatus)
      : 'UNDETECTED';

    return this.prisma.detectedRouter.upsert({
      where: { gatewayId },
      create: {
        gatewayId,
        vendor: report.vendor ?? null,
        model: report.model ?? null,
        firmwareVersion: report.firmwareVersion ?? null,
        pluginId,
        integrationStatus,
        detectionMethod: report.detectionMethod ?? null,
        confidence: report.confidence ?? null,
        macOui: report.macOui ?? null,
        ipAddress: report.ipAddress ?? null,
        hostname: report.hostname ?? null,
        lastDetectedAt: new Date(),
      },
      update: {
        vendor: report.vendor ?? null,
        model: report.model ?? null,
        firmwareVersion: report.firmwareVersion ?? null,
        pluginId,
        integrationStatus,
        detectionMethod: report.detectionMethod ?? null,
        confidence: report.confidence ?? null,
        macOui: report.macOui ?? null,
        ipAddress: report.ipAddress ?? null,
        hostname: report.hostname ?? null,
        lastDetectedAt: new Date(),
      },
    });
  }

  async getDetectedRouter(parentId: string, gatewayId: string) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');
    if (gateway.parentId !== parentId) throw new ForbiddenException('Not your gateway');

    return this.prisma.detectedRouter.findUnique({ where: { gatewayId } });
  }
}
