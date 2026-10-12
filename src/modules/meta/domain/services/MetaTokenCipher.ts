import type { EncryptedToken } from '../entities/ExpertMetaCredential';

export const META_TOKEN_CIPHER = Symbol('META_TOKEN_CIPHER');

export interface MetaTokenCipher {
  /** Lança erro se a chave de criptografia não estiver configurada. */
  assertConfigured(): void;
  encrypt(value: string): EncryptedToken;
  decrypt(token: EncryptedToken): string;
}
