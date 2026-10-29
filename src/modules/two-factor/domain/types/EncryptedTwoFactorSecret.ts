export type EncryptedTwoFactorSecret = {
  encryptedValue: string;
  iv: string;
  authTag: string;
};
