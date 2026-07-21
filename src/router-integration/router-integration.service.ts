import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { CapabilityEngineService } from './capability-engine.service';
import { RouterCommandService } from './router-command.service';
import { RouterCapabilityScoreService } from './router-capability-score.service';
import { RouterSetupDto } from './dto/router-integration.dto';

@Injectable()
export class RouterIntegrationService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private capabilityEngine: CapabilityEngineService,
    private routerCommandService: RouterCommandService,
    private capabilityScore: RouterCapabilityScoreService,
  ) {}

  private async assertOwnership(parentId: string, gatewayId: string) {
    const gateway = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) throw new NotFoundException('Gateway not found');
    if (gateway.parentId !== parentId) throw new ForbiddenException('Not your gateway');
    return gateway;
  }

  async getFeatures(parentId: string, gatewayId: string) {
    await this.assertOwnership(parentId, gatewayId);
    const router = await this.prisma.detectedRouter.findUnique({ where: { gatewayId } });
    if (!router || !router.pluginId) {
      return { detected: false, capabilities: null, score: this.capabilityScore.computeScore(null) };
    }
    const capabilities = this.capabilityEngine.getCapabilities(router.pluginId);
    return { detected: true, capabilities, score: this.capabilityScore.computeScore(capabilities, router) };
  }

  async setup(parentId: string, gatewayId: string, dto: RouterSetupDto) {
    await this.assertOwnership(parentId, gatewayId);

    const encrypted = this.encryption.encrypt(
      JSON.stringify({ username: dto.username, password: dto.password, apiKey: dto.apiKey }),
    );
    const capabilities = dto.vendorPluginId ? this.capabilityEngine.getCapabilities(dto.vendorPluginId) : null;

    await this.prisma.detectedRouter.upsert({
      where: { gatewayId },
      create: {
        gatewayId,
        pluginId: dto.vendorPluginId ?? null,
        integrationStatus: capabilities?.integrationStatus ?? 'UNDETECTED',
        adminCredentialsEncrypted: encrypted,
      },
      update: {
        ...(dto.vendorPluginId
          ? { pluginId: dto.vendorPluginId, integrationStatus: capabilities?.integrationStatus ?? 'UNDETECTED' }
          : {}),
        adminCredentialsEncrypted: encrypted,
      },
    });

    const command = await this.routerCommandService.enqueueCommand(gatewayId, 'TEST_CONNECTION', {});
    return { saved: true, testCommandId: command.id };
  }

  async testConnection(parentId: string, gatewayId: string) {
    await this.assertOwnership(parentId, gatewayId);
    const command = await this.routerCommandService.enqueueCommand(gatewayId, 'TEST_CONNECTION', {});
    return { testCommandId: command.id };
  }

  async triggerDetection(parentId: string, gatewayId: string) {
    await this.assertOwnership(parentId, gatewayId);
    const command = await this.routerCommandService.enqueueCommand(gatewayId, 'DETECT', {});
    return { detectCommandId: command.id };
  }

  async getDiagnostics(parentId: string, gatewayId: string) {
    await this.assertOwnership(parentId, gatewayId);
    const [router, recentCommands] = await Promise.all([
      this.prisma.detectedRouter.findUnique({
        where: { gatewayId },
        select: {
          id: true,
          gatewayId: true,
          vendor: true,
          model: true,
          firmwareVersion: true,
          pluginId: true,
          integrationStatus: true,
          detectionMethod: true,
          confidence: true,
          macOui: true,
          ipAddress: true,
          hostname: true,
          lastDetectedAt: true,
          lastTestedAt: true,
          lastTestResult: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.routerCommandService.listRecentCommands(gatewayId),
    ]);
    const capabilities = router?.pluginId ? this.capabilityEngine.getCapabilities(router.pluginId) : null;
    return { router, recentCommands, score: this.capabilityScore.computeScore(capabilities, router) };
  }

  async changeDns(parentId: string, gatewayId: string, dnsServer: string) {
    await this.assertOwnership(parentId, gatewayId);
    const command = await this.routerCommandService.enqueueCommand(gatewayId, 'CHANGE_DNS', { dnsServer });
    return { commandId: command.id };
  }

  async blockMac(parentId: string, gatewayId: string, macAddress: string) {
    await this.assertOwnership(parentId, gatewayId);
    const command = await this.routerCommandService.enqueueCommand(gatewayId, 'BLOCK_MAC', { macAddress });
    return { commandId: command.id };
  }

  async unblockMac(parentId: string, gatewayId: string, macAddress: string) {
    await this.assertOwnership(parentId, gatewayId);
    const command = await this.routerCommandService.enqueueCommand(gatewayId, 'UNBLOCK_MAC', { macAddress });
    return { commandId: command.id };
  }
}
