import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { parseAes256Key } from '../../../../shared/infra/crypto/parseAes256Key';
import type {
  IntegrationTokenCipher,
  IntegrationTokenContext,
} from '../../domain/services/IntegrationTokenCipher';
import type { EncryptedToken } from '../../domain/types/EncryptedToken';

const ALGORITHM = 'aes-256-gcm';
const AAD_VERSION = 'integration-token:v1';

export function integrationTokenAad(context: IntegrationTokenContext): Buffer {
  return Buffer.from(
    [
      AAD_VERSION,
      context.provider,
      context.purpose,
      context.tenantId,
      context.expertId,
      context.credentialId,
    ].join(':'),
    'utf8',
  );
}

@Injectable()
export class IntegrationTokenEncryptionService implements IntegrationTokenCipher {
  assertConfigured(): void {
    this.getKey();
  }

  encrypt(value: string, context: IntegrationTokenContext): EncryptedToken {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.getKey(), iv);
    cipher.setAAD(integrationTokenAad(context));
    const encryptedValue = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    return {
      encryptedValue: encryptedValue.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(token: EncryptedToken, context: IntegrationTokenContext): string {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.getKey(),
      Buffer.from(token.iv, 'base64'),
    );
    decipher.setAAD(integrationTokenAad(context));
    decipher.setAuthTag(Buffer.from(token.authTag, 'base64'));

    try {
      return Buffer.concat([
        decipher.update(Buffer.from(token.encryptedValue, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Chave errada, valor adulterado ou token de outro registro.
      throw new DomainError(500, 'INTEGRATION_TOKEN_DECRYPTION_FAILED');
    }
  }

  private getKey(): Buffer {
    Environment.assertInitialized();

    const encryptionKey = Environment.vars.META_TOKENS_ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new DomainError(500, 'META_TOKENS_ENCRYPTION_KEY_NOT_CONFIGURED');
    }

    const key = parseAes256Key(encryptionKey);

    if (!key) {
      throw new DomainError(500, 'META_TOKENS_ENCRYPTION_KEY_INVALID');
    }

    return key;
  }
}
