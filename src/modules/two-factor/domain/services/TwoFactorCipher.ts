import type { EncryptedTwoFactorSecret } from '../types/EncryptedTwoFactorSecret';

export interface TwoFactorCipher {
  encrypt(secret: string, userId: string): EncryptedTwoFactorSecret;
  decrypt(secret: EncryptedTwoFactorSecret, userId: string): string;
}
