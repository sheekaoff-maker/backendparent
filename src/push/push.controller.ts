import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PushService } from './push.service';
import { FirebaseService } from './firebase.service';
import { RegisterPushTokenDto, UnregisterPushTokenDto } from './dto/push-token.dto';

@ApiTags('Push Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(
    private readonly service: PushService,
    private readonly firebase: FirebaseService,
  ) {}

  @Post('tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register (or refresh) this device\'s push token' })
  async register(@CurrentUser('sub') userId: string, @Body() dto: RegisterPushTokenDto) {
    await this.service.registerToken(userId, dto.token, dto.platform);
  }

  @Delete('tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister this device\'s push token (on logout)' })
  async unregister(@CurrentUser('sub') userId: string, @Body() dto: UnregisterPushTokenDto) {
    await this.service.removeToken(userId, dto.token);
  }

  @Get('status')
  @ApiOperation({ summary: 'Whether push delivery is configured on the server' })
  status() {
    return {
      deliveryEnabled: this.service.deliveryEnabled,
      firebaseStatus: this.firebase.initStatus,
      // Only surface the raw error to help ops diagnose a misconfigured
      // credential; never leaks tokens/keys, just fs/parse error text.
      firebaseError: this.firebase.initError,
    };
  }
}
