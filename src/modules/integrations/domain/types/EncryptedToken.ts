export type EncryptedToken = {
  encryptedValue: string;
  iv: string;
  authTag: string;
};
