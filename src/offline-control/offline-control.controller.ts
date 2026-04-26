import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeviceType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChecklistDto, SetSetupStatusDto } from './dto/offline-control.dto';
import { OfflineControlService } from './offline-control.service';

@ApiTags('Offline Control')
@Controller()
@ApiBearerAuth()
export class OfflineControlController {
  constructor(private readonly service: OfflineControlService) {}

  @Get('platform-guides/:deviceType')
  @ApiOperation({
    summary:
      'Official setup guide for offline control on a specific device type. We do NOT control offline games — this returns the vendor steps the parent must do.',
  })
  guide(@Param('deviceType') deviceType: DeviceType) {
    return this.service.getGuide(deviceType);
  }

  @UseGuards(JwtAuthGuard)
  @Post('devices/:id/offline-control/setup-status')
  @ApiOperation({ summary: 'Mark offline setup as completed/verified for a device' })
  setSetupStatus(
    @CurrentUser('sub') parentId: string,
    @Param('id') id: string,
    @Body() dto: SetSetupStatusDto,
  ) {
    return this.service.setSetupStatus(parentId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('devices/:id/offline-control/status')
  @ApiOperation({
    summary:
      'Honest status: what is supported, what is not, current checklist, recommended next step',
  })
  status(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.service.getStatus(parentId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('devices/:id/offline-control/checklist')
  @ApiOperation({ summary: 'Update offline-control checklist for a device' })
  checklist(
    @CurrentUser('sub') parentId: string,
    @Param('id') id: string,
    @Body() dto: ChecklistDto,
  ) {
    return this.service.upsertChecklist(parentId, id, dto);
  }
}
