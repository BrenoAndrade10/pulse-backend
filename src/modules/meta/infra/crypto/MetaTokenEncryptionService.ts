import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { EncryptedToken } from '../../domain/entities/ExpertMetaCredential';
import type { MetaTokenCipher } from '../../domain/services/MetaTokenCipher';

@Injectable()
export class MetaTokenEncryptionService implements MetaTokenCipher {
  private readonly algorithm = 'aes-256-gcm';

  assertConfigured(): void {
    this.getKey();
  }

  encrypt(value: string): EncryptedToken {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.getKey(), iv);
    const encryptedValue = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedValue: encryptedValue.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  decrypt(token: EncryptedToken): string {
    const decipher = createDecipheriv(
      this.algorithm,
      this.getKey(),
      Buffer.from(token.iv, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(token.authTag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(token.encryptedValue, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getKey(): Buffer {
    Environment.assertInitialized();

    const encryptionKey = Environment.vars.META_TOKENS_ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new DomainError(500, 'META_TOKENS_ENCRYPTION_KEY_NOT_CONFIGURED');
    }

    return this.normalizeKey(encryptionKey);
  }

  private normalizeKey(encryptionKey: string): Buffer {
    const base64Key = Buffer.from(encryptionKey, 'base64');

    if (base64Key.length === 32) {
      return base64Key;
    }

    const hexKey = Buffer.from(encryptionKey, 'hex');

    if (hexKey.length === 32) {
      return hexKey;
    }

    return createHash('sha256').update(encryptionKey).digest();
  }
}
