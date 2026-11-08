export const INSTAGRAM_OAUTH_GATEWAY = Symbol('INSTAGRAM_OAUTH_GATEWAY');

export type MetaUserAccessToken = {
  accessToken: string;
  expiresInSeconds: number;
};

export type InstagramAuthorizedAccount = {
  authorizingUserId: string;
  permissions: string[];
  accessToken: string;
  userId: string;
  username: string;
  pageId: string;
  pageName: string;
  pageTasks: string[];
};

export interface InstagramOAuthGateway {
  isConfigured(): boolean;
  buildAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<MetaUserAccessToken>;
  exchangeForLongLivedToken(
    shortLivedToken: string,
  ): Promise<MetaUserAccessToken>;
  getAuthorizedAccount(
    userAccessToken: string,
  ): Promise<InstagramAuthorizedAccount>;
}

export type InstagramOAuthFailure =
  | 'exchange_failed'
  | 'missing_permissions'
  | 'no_instagram_account'
  | 'multiple_instagram_accounts';

export class InstagramOAuthError extends Error {
  constructor(
    public readonly reason: InstagramOAuthFailure,
    message: string,
  ) {
    super(message);
    this.name = 'InstagramOAuthError';
  }
}
