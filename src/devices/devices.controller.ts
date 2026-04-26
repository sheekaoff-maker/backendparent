import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new device' })
  async create(@CurrentUser('sub') parentId: string, @Body() dto: CreateDeviceDto) {
    return this.devicesService.create(parentId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all devices' })
  async findAll(@CurrentUser('sub') parentId: string) {
    return this.devicesService.findAll(parentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device by ID' })
  async findOne(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.devicesService.findOne(parentId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update device' })
  async update(@CurrentUser('sub') parentId: string, @Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.devicesService.update(parentId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete device' })
  async remove(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    await this.devicesService.remove(parentId, id);
  }

  @Post(':id/internet-lock')
  @ApiOperation({
    summary: 'FULL INTERNET LOCK — block ALL online traffic for this device',
    description:
      'Sets blockingMode=FULL_INTERNET_LOCK so the DNS server returns BLOCK for every domain. ' +
      'NOTE: This only blocks online access. Offline single-player games on PlayStation / Nintendo / ' +
      'Steam Deck / Smart TV cannot be stopped by us.',
  })
  async lockInternet(
    @CurrentUser('sub') parentId: string,
    @Param('id') id: string,
    @Body() body: { reason?: string } = {},
  ) {
    return this.devicesService.lockInternet(parentId, id, body?.reason);
  }

  @Post(':id/internet-unlock')
  @ApiOperation({ summary: 'Restore normal policy (GAMING_ONLY mode)' })
  async unlockInternet(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.devicesService.unlockInternet(parentId, id);
  }

  @Get(':id/network-status')
  @ApiOperation({ summary: 'Get current blocking mode + last DNS-seen info for a device' })
  async networkStatus(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.devicesService.getNetworkStatus(parentId, id);
  }
}
