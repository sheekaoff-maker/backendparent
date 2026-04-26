import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OAuthService } from './oauth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('OAuth')
@Controller('oauth')
export class OAuthController {
  constructor(private oauthService: OAuthService) {}

  @Get('microsoft/url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Microsoft OAuth authorization URL' })
  async getMicrosoftUrl() {
    return this.oauthService.getMicrosoftAuthUrl();
  }

  @Get('microsoft/callback')
  @ApiOperation({ summary: 'Microsoft OAuth callback' })
  async microsoftCallback(@Query('code') code: string, @Query('state') state: string) {
    const userId = state;
    return this.oauthService.handleMicrosoftCallback(userId, code);
  }

  @Post('microsoft/refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh Microsoft OAuth token' })
  async refreshMicrosoft(@CurrentUser('sub') userId: string) {
    return this.oauthService.refreshMicrosoftToken(userId);
  }
}
