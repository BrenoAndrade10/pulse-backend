export const TWO_FACTOR_REPOSITORY = Symbol('TWO_FACTOR_REPOSITORY');

export type PendingTwoFactorSecret = {
  userId: string;
  secretEncrypted: string;
  secretIv: string;
  secretAuthTag: string;
  now: Date;
};

export type TwoFactorState = {
  userId: string;
  secretEncrypted: string;
  secretIv: string;
  secretAuthTag: string;
  confirmedAt: Date | null;
  lastUsedStep: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RecoveryCodeReplacement = {
  id: string;
  userId: string;
  codeHash: string;
  createdAt: Date;
};

export type ConfirmTwoFactorInput = {
  userId: string;
  expectedSecretEncrypted: string;
  setupValidAfter: Date;
  step: number;
  now: Date;
  recoveryCodes: RecoveryCodeReplacement[];
};

export type RegenerateRecoveryCodesInput = {
  userId: string;
  step: number;
  now: Date;
  recoveryCodes: RecoveryCodeReplacement[];
};

export interface TwoFactorRepository {
  findByUserId(userId: string): Promise<TwoFactorState | null>;
  upsertPending(input: PendingTwoFactorSecret): Promise<void>;
  updateLastUsedStep(userId: string, step: number, now: Date): Promise<boolean>;
  confirmAndReplaceRecoveryCodes(
    input: ConfirmTwoFactorInput,
  ): Promise<boolean>;
  regenerateRecoveryCodes(
    input: RegenerateRecoveryCodesInput,
  ): Promise<boolean>;
  deleteForUser(userId: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
