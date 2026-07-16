import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DeviceHealthService } from './device-health.service';

@ApiTags('Device Health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('device-health')
export class DeviceHealthController {
  constructor(private readonly service: DeviceHealthService) {}

  @Get()
  @ApiOperation({
    summary:
      'Live protection health for all of the parent\'s devices — is DNS filtering actually reaching each device right now.',
  })
  summary(@CurrentUser('sub') parentId: string) {
    return this.service.getSummary(parentId);
  }

  @Get(':deviceId')
  @ApiOperation({ summary: 'Protection-health verdict for a single device' })
  device(@CurrentUser('sub') parentId: string, @Param('deviceId') deviceId: string) {
    return this.service.getForDevice(parentId, deviceId);
  }
}
