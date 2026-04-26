import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeviceType } from '@prisma/client';
import { PLATFORM_SUPPORT_MATRIX, getPlatformSupport } from './platform-support.matrix';
import { SETUP_GUIDES } from './setup-guides.data';

@ApiTags('Platform Support & Setup Guides')
@Controller('platform-support')
export class PlatformSupportController {
  @Get('matrix')
  @ApiOperation({
    summary: 'Get the full platform support matrix — what we can/cannot control',
  })
  matrix() {
    return Object.values(PLATFORM_SUPPORT_MATRIX);
  }

  @Get('matrix/:deviceType')
  @ApiOperation({ summary: 'Get support info for one device type' })
  one(@Param('deviceType') deviceType: DeviceType) {
    const info = getPlatformSupport(deviceType);
    if (!info) throw new NotFoundException(`Unknown deviceType: ${deviceType}`);
    return info;
  }

  @Get('guides')
  @ApiOperation({ summary: 'List all parental-control setup guides' })
  guides() {
    return SETUP_GUIDES;
  }

  @Get('guides/:platform')
  @ApiOperation({
    summary: 'Get setup guide for a platform (PLAYSTATION, NINTENDO, XBOX, SMART_TV, ROUTER)',
  })
  guide(@Param('platform') platform: string) {
    const guide = SETUP_GUIDES.find(
      (g) => g.platform.toLowerCase() === platform.toLowerCase(),
    );
    if (!guide) throw new NotFoundException(`No setup guide for ${platform}`);
    return guide;
  }
}
