export const INSTAGRAM_OAUTH_GATEWAY = Symbol('INSTAGRAM_OAUTH_GATEWAY');

export type InstagramShortLivedToken = {
  accessToken: string;
  /** ID do usuário com escopo do app, devolvido na troca do código. */
  appScopedUserId: string;
  permissions: string[];
};

export type InstagramLongLivedToken = {
  accessToken: string;
  expiresInSeconds: number;
};

export type InstagramProfile = {
  /** ID da conta profissional do Instagram, usado nas chamadas da API. */
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

/** Falha ao falar com a Meta. A mensagem nunca contém tokens nem códigos. */
export class InstagramOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstagramOAuthError';
  }
}
