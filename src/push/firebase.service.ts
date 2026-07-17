import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import {
  App,
  Credential,
  applicationDefault,
  cert,
  deleteApp,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { Messaging, getMessaging } from 'firebase-admin/messaging';

export type FirebaseInitStatus = 'ready' | 'not_configured' | 'error';

/**
 * Owns the ONE Firebase Admin SDK instance for the whole process.
 *
 * Credential resolution order (first one present wins):
 *   1. FIREBASE_SERVICE_ACCOUNT_PATH — explicit path to the service-account
 *      JSON (e.g. /opt/guardtime/secrets/firebase-service-account.json).
 *   2. GOOGLE_APPLICATION_CREDENTIALS — the standard Google/Firebase env var,
 *      honoured automatically by applicationDefault().
 *   3. FCM_PROJECT_ID + FCM_CLIENT_EMAIL + FCM_PRIVATE_KEY — discrete fields
 *      (back-compat with the pre-firebase-admin hand-rolled sender).
 *
 * If none are present, or the credential is invalid, initialization is
 * skipped/fails WITHOUT throwing — the rest of the app must keep running with
 * push simply disabled (notifications are still stored for the in-app
 * center). This mirrors the pre-existing "skipped" behaviour so nothing that
 * worked before breaks.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;
  private status: FirebaseInitStatus = 'not_configured';
  private error: string | null = null;

  onModuleInit(): void {
    this.initializeOnce();
  }

  get isReady(): boolean {
    return this.status === 'ready';
  }

  /** 'ready' | 'not_configured' | 'error' — surfaced on /push/status and /health/ready. */
  get initStatus(): FirebaseInitStatus {
    return this.status;
  }

  get initError(): string | null {
    return this.error;
  }

  getMessaging(): Messaging {
    if (!this.app) {
      throw new Error('Firebase is not initialized — check FIREBASE_SERVICE_ACCOUNT_PATH');
    }
    return getMessaging(this.app);
  }

  /**
   * Initialize exactly once for the process. Safe to call multiple times
   * (e.g. if the module is re-instantiated in tests) — reuses the existing
   * default app instead of re-initializing, which firebase-admin forbids.
   */
  private initializeOnce(): void {
    const existing = getApps().find((a) => a.name === '[DEFAULT]');
    if (existing) {
      this.app = existing;
      this.status = 'ready';
      return;
    }

    const credential = this.resolveCredential();
    if (!credential) {
      // resolveCredential() already set status='error' + a specific message if
      // a configured source (e.g. a bad file path) failed to load. Only
      // downgrade to the generic "not configured" when nothing was attempted.
      if (this.status !== 'error') {
        this.status = 'not_configured';
        this.logger.warn(
          'Firebase not configured (no FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS, ' +
            'or FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY). Push notifications are disabled; ' +
            'events are still stored for the in-app notification center.',
        );
      }
      return;
    }

    try {
      this.app = initializeApp({ credential });
      this.status = 'ready';
      this.logger.log('Firebase Admin SDK initialized successfully.');
    } catch (err) {
      this.status = 'error';
      this.error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Firebase initialization failed: ${this.error}`);
    }
  }

  private resolveCredential(): Credential | null {
    // 1. Explicit service-account file path (recommended for this deployment).
    const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (explicitPath) {
      try {
        const raw = fs.readFileSync(explicitPath, 'utf8');
        const json = JSON.parse(raw);
        return cert(json);
      } catch (err) {
        this.status = 'error';
        this.error = `Failed to read/parse FIREBASE_SERVICE_ACCOUNT_PATH (${explicitPath}): ${
          err instanceof Error ? err.message : String(err)
        }`;
        this.logger.error(this.error);
        return null;
      }
    }

    // 2. Standard Google Application Default Credentials env var.
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        return applicationDefault();
      } catch (err) {
        this.status = 'error';
        this.error = `applicationDefault() failed: ${err instanceof Error ? err.message : String(err)}`;
        this.logger.error(this.error);
        return null;
      }
    }

    // 3. Back-compat discrete fields (pre-dated firebase-admin integration).
    const projectId = process.env.FCM_PROJECT_ID;
    const clientEmail = process.env.FCM_CLIENT_EMAIL;
    const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (projectId && clientEmail && privateKey) {
      return cert({ projectId, clientEmail, privateKey });
    }

    return null;
  }

  /** Test-only: tear down the default app so a fresh instance can be built. */
  async _resetForTests(): Promise<void> {
    const existing = getApps().find((a) => a.name === '[DEFAULT]');
    if (existing) await deleteApp(existing);
    this.app = null;
    this.status = 'not_configured';
    this.error = null;
  }

  /** Re-exported for use by getApp() consumers if ever needed elsewhere. */
  static currentDefaultApp(): App | undefined {
    try {
      return getApp();
    } catch {
      return undefined;
    }
  }
}
