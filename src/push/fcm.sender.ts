import { Injectable, Logger } from '@nestjs/common';
import type { BatchResponse, Message, MulticastMessage } from 'firebase-admin/messaging';
import { FirebaseService } from './firebase.service';

export type FcmSendResult = 'sent' | 'invalid' | 'skipped' | 'error';

export interface FcmMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface MulticastResult {
  sent: string[];
  invalid: string[];
  errored: string[];
  skipped: boolean;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = [300, 900];

// FCM error codes that are safe to retry (transient/infra) vs. codes that mean
// the token itself is dead and must be pruned, not retried.
const TRANSIENT_CODES = new Set([
  'messaging/internal-error',
  'messaging/server-unavailable',
  'messaging/unknown-error',
  'messaging/timeout',
  'messaging/quota-exceeded',
]);
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
  'messaging/unregistered',
  'messaging/mismatched-credential',
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorCode(err: unknown): string {
  return (err as { code?: string })?.code ?? 'unknown';
}

/**
 * Real Firebase Cloud Messaging client, backed by the official `firebase-admin`
 * SDK (HTTP v1 under the hood). Delegates initialization to [FirebaseService]
 * (singleton, initialized once for the process).
 *
 * When Firebase is not configured this is NOT a mock: `send()`/`sendMulticast()`
 * report `skipped` and the caller stores notifications without pushing — the
 * same graceful-degradation behaviour as before this integration.
 */
@Injectable()
export class FcmSender {
  private readonly logger = new Logger(FcmSender.name);

  constructor(private readonly firebase: FirebaseService) {}

  get isConfigured(): boolean {
    return this.firebase.isReady;
  }

  /** Send to a single token, retrying transient failures. */
  async send(token: string, message: FcmMessage): Promise<FcmSendResult> {
    if (!this.isConfigured) {
      this.logger.debug('FCM not configured — notification stored but not pushed.');
      return 'skipped';
    }

    const payload: Message = {
      token,
      notification: { title: message.title, body: message.body },
      data: message.data ?? {},
    };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.firebase.getMessaging().send(payload);
        return 'sent';
      } catch (err) {
        const code = errorCode(err);
        if (INVALID_TOKEN_CODES.has(code)) {
          this.logger.debug(`FCM token invalid (${code}) — will prune.`);
          return 'invalid';
        }
        if (TRANSIENT_CODES.has(code) && attempt < MAX_RETRIES) {
          this.logger.debug(`FCM transient error (${code}), retry ${attempt + 1}/${MAX_RETRIES}`);
          await sleep(RETRY_DELAY_MS[attempt] ?? 900);
          continue;
        }
        this.logger.warn(`FCM send failed (${code}): ${msg(err)}`);
        return 'error';
      }
    }
    return 'error';
  }

  /**
   * Send the same message to many tokens at once (a real device's own
   * registrations, or a broadcast). Uses the SDK's official multicast API,
   * classifies each result, and retries transient per-token failures.
   */
  async sendMulticast(tokens: string[], message: FcmMessage): Promise<MulticastResult> {
    if (tokens.length === 0) {
      return { sent: [], invalid: [], errored: [], skipped: false };
    }
    if (!this.isConfigured) {
      this.logger.debug('FCM not configured — notifications stored but not pushed.');
      return { sent: [], invalid: [], errored: [], skipped: true };
    }

    let pending = [...tokens];
    const sent: string[] = [];
    const invalid: string[] = [];
    const errored: string[] = [];

    for (let attempt = 0; attempt <= MAX_RETRIES && pending.length > 0; attempt++) {
      const isLastAttempt = attempt === MAX_RETRIES;
      const multicastMessage: MulticastMessage = {
        tokens: pending,
        notification: { title: message.title, body: message.body },
        data: message.data ?? {},
      };

      let response: BatchResponse;
      try {
        response = await this.firebase.getMessaging().sendEachForMulticast(multicastMessage);
      } catch (err) {
        // Whole-batch failure (e.g. auth/network). On the last attempt, every
        // still-pending token is counted as errored exactly once; otherwise
        // retry the same batch.
        this.logger.warn(`FCM multicast batch failed: ${msg(err)}`);
        if (isLastAttempt) {
          errored.push(...pending);
          pending = [];
          break;
        }
        await sleep(RETRY_DELAY_MS[attempt] ?? 900);
        continue;
      }

      const retryNext: string[] = [];
      response.responses.forEach((r, i) => {
        const token = pending[i];
        if (r.success) {
          sent.push(token);
          return;
        }
        const code = errorCode(r.error);
        if (INVALID_TOKEN_CODES.has(code)) {
          invalid.push(token);
        } else if (TRANSIENT_CODES.has(code) && !isLastAttempt) {
          retryNext.push(token);
        } else {
          errored.push(token);
        }
      });

      pending = retryNext;
      if (pending.length > 0 && !isLastAttempt) {
        await sleep(RETRY_DELAY_MS[attempt] ?? 900);
      }
    }

    return { sent, invalid, errored, skipped: false };
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
