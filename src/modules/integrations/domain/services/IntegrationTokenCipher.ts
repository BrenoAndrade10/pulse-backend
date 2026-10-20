import type { IntegrationProvider } from '../enums/IntegrationProvider';
import type { EncryptedToken } from '../types/EncryptedToken';

export const INTEGRATION_TOKEN_CIPHER = Symbol('INTEGRATION_TOKEN_CIPHER');

/**
 * Dono do token cifrado. Entra na cifra como dado associado (AAD): o token só
 * decifra no mesmo registro em que foi gravado, então copiar o valor cifrado
 * para outro expert, empresa ou provedor no banco não funciona.
 */
export type IntegrationTokenContext = {
  tenantId: string;
  expertId: string;
  credentialId: string;
  provider: IntegrationProvider;
  purpose: 'access_token' | 'refresh_token';
};

export interface IntegrationTokenCipher {
  /** Lança erro se a chave de criptografia não estiver configurada. */
  assertConfigured(): void;
  encrypt(value: string, context: IntegrationTokenContext): EncryptedToken;
  decrypt(token: EncryptedToken, context: IntegrationTokenContext): string;
}
