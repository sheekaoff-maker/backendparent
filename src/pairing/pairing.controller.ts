import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PairingService } from './pairing.service';
import {
  ConfirmPairingDto,
  ConnectionStatsResponseDto,
  PairingStatusResponseDto,
  StartPairingResponseDto,
} from './dto/pairing.dto';

/** Parent-facing pairing endpoints — JWT-protected, ownership-checked in the service. */
@ApiTags('pairing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices/:deviceId/pair')
export class PairingController {
  constructor(private readonly pairing: PairingService) {}

  @Post('start')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start (or restart) DNS auto-pairing for a device' })
  start(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @CurrentUser('sub') parentId: string,
  ): Promise<StartPairingResponseDto> {
    return this.pairing.startPairing(deviceId, parentId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Poll live pairing/connection status for a device' })
  status(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @CurrentUser('sub') parentId: string,
  ): Promise<PairingStatusResponseDto> {
    return this.pairing.getStatus(deviceId, parentId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Connection detail: queries today, recent events, IP history' })
  stats(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @CurrentUser('sub') parentId: string,
  ): Promise<ConnectionStatsResponseDto> {
    return this.pairing.getConnectionStats(deviceId, parentId);
  }

  @Delete()
  @ApiOperation({ summary: 'Cancel an in-progress pairing session' })
  cancel(@Param('deviceId', ParseUUIDPipe) deviceId: string, @CurrentUser('sub') parentId: string): Promise<void> {
    return this.pairing.cancelPairing(deviceId, parentId);
  }
}

/**
 * Internal-only — called by dns-service when it resolves a
 * `<token>.pair.guardtime.local` probe query. Not behind JwtAuthGuard: the
 * caller is the resolver process, not a parent's browser/app. Trust
 * boundary is enforced the same way as DnsPolicyController's
 * `/dns/policy/check` — restricted at the edge (Nginx/Ingress) to internal
 * traffic only, never exposed publicly. See deploy/nginx/guardtime.conf.
 */
@SkipThrottle({ default: true, auth_login: true, auth_register: true })
@ApiTags('pairing-internal')
@Controller('dns/pair')
export class DnsPairController {
  constructor(private readonly pairing: PairingService) {}

  @Post('confirm')
  @ApiOperation({
    summary:
      '[internal] Confirm a device pairing or reaffirm its IP, from a resolved probe query',
  })
  confirm(@Body() dto: ConfirmPairingDto): Promise<{ deviceId: string }> {
    return this.pairing.confirmProbe(dto);
  }
}
