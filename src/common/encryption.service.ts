import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * AES-256-CBC helper for encrypting third-party secrets (e.g. OAuth tokens) at
 * rest. The symmetric key is derived from ENCRYPTION_KEY via scrypt with a
 * fixed salt so the same env key always yields the same derived key (required
 * for decryption). Presence/strength of ENCRYPTION_KEY is enforced at boot by
 * env validation, so there is deliberately no insecure fallback here.
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;

  constructor() {
    const envKey = process.env.ENCRYPTION_KEY;
    if (!envKey || envKey.length < 32) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY must be defined and at least 32 characters long.',
      );
    }
    // Salt kept stable so previously-encrypted payloads remain decryptable.
    this.key = crypto.scryptSync(envKey, 'salt', 32);
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new InternalServerErrorException('Malformed encrypted payload');
    }
    const iv = Buffer.from(parts[0], 'hex');
    if (iv.length !== 16) {
      throw new InternalServerErrorException('Malformed encryption IV');
    }
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
