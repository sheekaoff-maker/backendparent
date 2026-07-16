import { Injectable, Logger } from '@nestjs/common';
import { createSign } from 'crypto';

export type FcmSendResult = 'sent' | 'invalid' | 'skipped' | 'error';

export interface FcmMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/**
 * Real Firebase Cloud Messaging HTTP v1 client.
 *
 * Uses a service account (FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY)
 * to mint a short-lived Google OAuth token and POST to the v1 send endpoint.
 * The legacy "server key" API was shut down in 2024, so v1 is the only correct
 * path. No third-party dependency — JWT is signed with Node's crypto.
 *
 * When the service account env is absent this is NOT a mock: `send()` reports
 * `skipped` and the caller stores notifications without pushing. That is the
 * correct behaviour for a deploy that has not wired Firebase yet.
 */
@Injectable()
export class FcmSender {
  private readonly logger = new Logger(FcmSender.name);
  private readonly projectId = process.env.FCM_PROJECT_ID;
  private readonly clientEmail = process.env.FCM_CLIENT_EMAIL;
  private readonly privateKey = (process.env.FCM_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  private cached: { accessToken: string; expiresAt: number } | null = null;

  get isConfigured(): boolean {
    return Boolean(this.projectId && this.clientEmail && this.privateKey);
  }

  async send(token: string, message: FcmMessage): Promise<FcmSendResult> {
    if (!this.isConfigured) {
      this.logger.debug('FCM not configured — notification stored but not pushed.');
      return 'skipped';
    }

    let accessToken: string;
    try {
      accessToken = await this.getAccessToken();
    } catch (err) {
      this.logger.error(`FCM auth failed: ${msg(err)}`);
      return 'error';
    }

    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data: message.data ?? {},
            },
          }),
        },
      );

      if (res.ok) return 'sent';

      // A 404 / UNREGISTERED / invalid-argument for the token means it is stale
      // and should be pruned by the caller.
      const text = await res.text();
      if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(text)) {
        this.logger.debug(`FCM token invalid (${res.status}) — will prune.`);
        return 'invalid';
      }
      this.logger.warn(`FCM send failed ${res.status}: ${text.slice(0, 200)}`);
      return 'error';
    } catch (err) {
      this.logger.error(`FCM send error: ${msg(err)}`);
      return 'error';
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cached && this.cached.expiresAt > now + 60) {
      return this.cached.accessToken;
    }

    const assertion = this.buildSignedJwt(now);
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) {
      throw new Error(`token endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.cached = {
      accessToken: json.access_token,
      expiresAt: now + (json.expires_in ?? 3600),
    };
    return json.access_token;
  }

  private buildSignedJwt(now: number): string {
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
      JSON.stringify({
        iss: this.clientEmail,
        scope: FCM_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    );
    const signingInput = `${header}.${claims}`;
    const signature = createSign('RSA-SHA256')
      .update(signingInput)
      .sign(this.privateKey, 'base64');
    return `${signingInput}.${toBase64Url(signature)}`;
  }
}

function base64url(input: string): string {
  return toBase64Url(Buffer.from(input).toString('base64'));
}

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
