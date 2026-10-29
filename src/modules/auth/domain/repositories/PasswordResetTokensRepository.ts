export const PASSWORD_RESET_TOKENS_REPOSITORY = Symbol(
  'PASSWORD_RESET_TOKENS_REPOSITORY',
);

export type CreatePasswordResetTokenInput = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export type ConsumedPasswordReset = {
  userId: string;
  email: string;
  firstName: string;
};

export interface PasswordResetTokensRepository {
  replaceForUser(input: CreatePasswordResetTokenInput): Promise<void>;
  findValid(tokenHash: string): Promise<ConsumedPasswordReset | null>;
  consumeAndUpdatePassword(
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<ConsumedPasswordReset | null>;
}
