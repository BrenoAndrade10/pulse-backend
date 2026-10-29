import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { TwoFactorCipher } from '../../domain/services/TwoFactorCipher';
import type { EncryptedTwoFactorSecret } from '../../domain/types/EncryptedTwoFactorSecret';
import { TwoFactorKeys } from './TwoFactorKeys';

@Injectable()
export class AesTwoFactorCipher implements TwoFactorCipher {
  constructor(private readonly keys: TwoFactorKeys) {}

  encrypt(secret: string, userId: string): EncryptedTwoFactorSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keys.encryption(), iv);
    cipher.setAAD(this.aad(userId));
    const encryptedValue = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);

    return {
      encryptedValue: encryptedValue.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(secret: EncryptedTwoFactorSecret, userId: string): string {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.keys.encryption(),
        Buffer.from(secret.iv, 'base64'),
      );
      decipher.setAAD(this.aad(userId));
      decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(secret.encryptedValue, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch (error) {
      if (
        error instanceof DomainError &&
        error.reason === 'TWO_FACTOR_NOT_CONFIGURED'
      ) {
        throw error;
      }
      throw new DomainError(500, 'TWO_FACTOR_DECRYPTION_FAILED');
    }
  }

  private aad(userId: string): Buffer {
    return Buffer.from(`two-factor:v1:${userId}`, 'utf8');
  }
}
