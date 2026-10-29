export const RECOVERY_CODES_REPOSITORY = Symbol('RECOVERY_CODES_REPOSITORY');

export type RecoveryCodeRecord = {
  id: string;
  userId: string;
  codeHash: string;
  createdAt: Date;
};

export interface RecoveryCodesRepository {
  countUnused(userId: string): Promise<number>;
  replaceForUser(userId: string, codes: RecoveryCodeRecord[]): Promise<void>;
  consume(userId: string, codeHash: string, now: Date): Promise<boolean>;
  deleteForUser(userId: string): Promise<void>;
}
