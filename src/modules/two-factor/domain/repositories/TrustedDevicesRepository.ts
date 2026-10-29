export const TRUSTED_DEVICES_REPOSITORY = Symbol('TRUSTED_DEVICES_REPOSITORY');

export type TrustedDeviceRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  label: string;
  expiresAt: Date;
  lastUsedAt: Date;
  createdAt: Date;
};

export interface TrustedDevicesRepository {
  create(device: TrustedDeviceRecord): Promise<void>;
  validateAndTouch(
    tokenHash: string,
    userId: string,
    now: Date,
  ): Promise<TrustedDeviceRecord | null>;
  listByUserId(userId: string): Promise<TrustedDeviceRecord[]>;
  revoke(userId: string, deviceId: string): Promise<boolean>;
  deleteForUser(userId: string): Promise<void>;
}
