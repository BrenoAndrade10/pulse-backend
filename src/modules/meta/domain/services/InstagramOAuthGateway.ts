export const INSTAGRAM_OAUTH_GATEWAY = Symbol('INSTAGRAM_OAUTH_GATEWAY');

export type InstagramShortLivedToken = {
  accessToken: string;
  appScopedUserId: string;
  permissions: string[];
};

export type InstagramLongLivedToken = {
  accessToken: string;
  expiresInSeconds: number;
};

export type InstagramProfile = {
  userId: string;
  username: string;
};

export interface InstagramOAuthGateway {
  isConfigured(): boolean;
  buildAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<InstagramShortLivedToken>;
  exchangeForLongLivedToken(
    shortLivedToken: string,
  ): Promise<InstagramLongLivedToken>;
  getProfile(accessToken: string): Promise<InstagramProfile>;
}

export class InstagramOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstagramOAuthError';
  }
}
