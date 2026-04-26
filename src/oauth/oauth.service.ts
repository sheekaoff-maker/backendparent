import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  getMicrosoftAuthUrl() {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return { url: null, message: 'Microsoft OAuth not configured. Set MICROSOFT_OAUTH_CLIENT_ID and redirect URI.' };
    }
    const url = `https://login.microsoftonline.com/common/oauth20/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=offline_access User.Read&response_mode=query`;
    return { url };
  }

  async handleMicrosoftCallback(userId: string, code: string) {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Microsoft OAuth not configured');
    }

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth20/v2.0/token';
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      this.logger.error('Microsoft OAuth token exchange failed', JSON.stringify(data));
      return { success: false, message: 'Token exchange failed' };
    }

    const encryptedAccess = this.encryptionService.encrypt(data.access_token as string);
    const encryptedRefresh = this.encryptionService.encrypt(data.refresh_token as string);
    const expiresAt = new Date(Date.now() + (data.expires_in as number) * 1000);

    await this.prisma.oAuthAccount.upsert({
      where: { provider_providerUserId: { provider: 'microsoft', providerUserId: data.sub as string || 'unknown' } },
      create: {
        userId,
        provider: 'microsoft',
        providerUserId: (data.sub as string) || 'unknown',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
        scope: (data.scope as string) || '',
      },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
        scope: (data.scope as string) || '',
      },
    });

    return { success: true, message: 'Microsoft account linked' };
  }

  async getDecryptedAccessToken(userId: string, provider: string) {
    const account = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider },
    });
    if (!account) return null;
    return this.encryptionService.decrypt(account.accessToken);
  }

  async refreshMicrosoftToken(userId: string) {
    const account = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider: 'microsoft' },
    });
    if (!account) return { success: false, message: 'No Microsoft account linked' };

    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) return { success: false, message: 'Microsoft OAuth not configured' };

    const decryptedRefresh = this.encryptionService.decrypt(account.refreshToken);
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth20/v2.0/token';
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptedRefresh,
      grant_type: 'refresh_token',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      this.logger.error('Microsoft token refresh failed', JSON.stringify(data));
      return { success: false, message: 'Token refresh failed' };
    }

    const encryptedAccess = this.encryptionService.encrypt(data.access_token as string);
    const encryptedRefresh = this.encryptionService.encrypt(data.refresh_token as string);
    const expiresAt = new Date(Date.now() + (data.expires_in as number) * 1000);

    await this.prisma.oAuthAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
      },
    });

    return { success: true, message: 'Token refreshed' };
  }
}
