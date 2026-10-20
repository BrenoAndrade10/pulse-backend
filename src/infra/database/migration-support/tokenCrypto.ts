import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Environment } from '../../../config/Environment';
import { parseAes256Key } from '../../../shared/infra/crypto/parseAes256Key';

/**
 * Cifra usada pelas migrations que movem tokens entre formatos.
 *
 * NÃO altere: migrations já aplicadas dependem destes formatos exatos. Uma
 * mudança de formato pede funções novas aqui, não a edição das existentes.
 */

export type EncryptedToken = {
  encryptedValue: string;
  iv: string;
  authTag: string;
};

export type TokenOwner = {
  tenantId: string;
  expertId: string;
  credentialId: string;
};

/** Formato de `expert_meta_credentials` (migration 1791334590498). */
export const metaTokenAad = (owner: TokenOwner): Buffer =>
  Buffer.from(
    `meta-token:v1:access_token:${owner.tenantId}:${owner.expertId}:${owner.credentialId}`,
    'utf8',
  );

/** Formato de `integration_credentials` (IntegrationTokenEncryptionService). */
export const integrationTokenAad = (
  owner: TokenOwner & { provider: string },
): Buffer =>
  Buffer.from(
    `integration-token:v1:${owner.provider}:access_token:${owner.tenantId}:${owner.expertId}:${owner.credentialId}`,
    'utf8',
  );

export function migrationTokenKey(): Buffer {
  Environment.assertInitialized();

  const value = Environment.vars.META_TOKENS_ENCRYPTION_KEY;
  const key = value ? parseAes256Key(value) : null;

  if (!key) {
    throw new Error(
      'Configure META_TOKENS_ENCRYPTION_KEY (a mesma chave usada para cifrar os tokens atuais) antes de rodar esta migration.',
    );
  }

  return key;
}

export function encryptToken(
  key: Buffer,
  value: string,
  aad: Buffer,
): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
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

export function decryptToken(
  key: Buffer,
  token: EncryptedToken,
  aad: Buffer,
  credentialId: string,
): string {
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(token.iv, 'base64'),
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(token.authTag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(token.encryptedValue, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error(
      `Não foi possível decifrar o token da credencial ${credentialId}. Confira se META_TOKENS_ENCRYPTION_KEY é a chave usada para gravá-lo.`,
    );
  }
}
