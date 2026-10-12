export const AUTH_SETTINGS = Symbol('AUTH_SETTINGS');

export type AuthSettings = {
  accessTokenTtlSeconds: number;
  refreshTokenIdleTtlSeconds: number;
  sessionAbsoluteTtlSeconds: number;
  refreshTokenGracePeriodSeconds: number;
};
