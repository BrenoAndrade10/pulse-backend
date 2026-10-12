import { Environment } from '../../../../config/Environment';
import {
  InstagramOAuthError,
  type InstagramLongLivedToken,
  type InstagramOAuthGateway,
  type InstagramProfile,
  type InstagramShortLivedToken,
} from '../../domain/services/InstagramOAuthGateway';

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_URL = 'https://graph.instagram.com';
const REQUEST_TIMEOUT_MS = 10_000;

type ShortLivedTokenResponse = {
  access_token?: string;
  user_id?: string | number;
  permissions?: string | string[];
};

/**
 * Cliente do "Login da empresa no Instagram" (Instagram API with Instagram
 * Login). Referência: developers.facebook.com/docs/instagram-platform/
 * instagram-api-with-instagram-login/business-login
 */
export class InstagramOAuthClient implements InstagramOAuthGateway {
  isConfigured(): boolean {
    const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI } =
      Environment.vars;

    return Boolean(
      INSTAGRAM_APP_ID && INSTAGRAM_APP_SECRET && INSTAGRAM_REDIRECT_URI,
    );
  }

  buildAuthorizationUrl(state: string): string {
    const url = new URL(AUTHORIZE_URL);

    url.searchParams.set('client_id', this.config.appId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.config.scopes);
    url.searchParams.set('state', state);

    return url.toString();
  }

  async exchangeCode(code: string): Promise<InstagramShortLivedToken> {
    const form = new FormData();

    form.set('client_id', this.config.appId);
    form.set('client_secret', this.config.appSecret);
    form.set('grant_type', 'authorization_code');
    // Precisa ser idêntica à usada na autorização.
    form.set('redirect_uri', this.config.redirectUri);
    form.set('code', code);

    const payload = await this.request<
      ShortLivedTokenResponse & { data?: ShortLivedTokenResponse[] }
    >(TOKEN_URL, { method: 'POST', body: form });

    // A documentação atual devolve { data: [ {...} ] }; versões antigas, o objeto direto.
    const token: ShortLivedTokenResponse | undefined = payload.data
      ? payload.data[0]
      : payload;

    if (!token?.access_token || token.user_id === undefined) {
      throw new InstagramOAuthError('Resposta inesperada na troca do código.');
    }

    return {
      accessToken: token.access_token,
      appScopedUserId: String(token.user_id),
      permissions: (Array.isArray(token.permissions)
        ? token.permissions
        : (token.permissions ?? '').split(',')
      )
        .map((permission) => permission.trim())
        .filter(Boolean),
    };
  }

  async exchangeForLongLivedToken(
    shortLivedToken: string,
  ): Promise<InstagramLongLivedToken> {
    const url = new URL(`${GRAPH_URL}/access_token`);

    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', this.config.appSecret);
    url.searchParams.set('access_token', shortLivedToken);

    const payload = await this.request<{
      access_token?: string;
      expires_in?: number;
    }>(url.toString(), { method: 'GET' });

    if (!payload.access_token || typeof payload.expires_in !== 'number') {
      throw new InstagramOAuthError(
        'Resposta inesperada na troca por token de longa duração.',
      );
    }

    return {
      accessToken: payload.access_token,
      expiresInSeconds: payload.expires_in,
    };
  }

  async getProfile(accessToken: string): Promise<InstagramProfile> {
    const url = new URL(`${GRAPH_URL}/${this.config.apiVersion}/me`);

    url.searchParams.set('fields', 'user_id,username');
    url.searchParams.set('access_token', accessToken);

    const payload = await this.request<{
      user_id?: string | number;
      username?: string;
    }>(url.toString(), { method: 'GET' });

    if (payload.user_id === undefined || !payload.username) {
      throw new InstagramOAuthError('Resposta inesperada ao buscar o perfil.');
    }

    return { userId: String(payload.user_id), username: payload.username };
  }

  private get config() {
    if (!this.isConfigured()) {
      throw new InstagramOAuthError('Login com Instagram não configurado.');
    }

    const vars = Environment.vars;

    return {
      appId: vars.INSTAGRAM_APP_ID!,
      appSecret: vars.INSTAGRAM_APP_SECRET!,
      redirectUri: vars.INSTAGRAM_REDIRECT_URI!,
      scopes: vars.INSTAGRAM_SCOPES,
      apiVersion: vars.INSTAGRAM_GRAPH_API_VERSION,
    };
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new InstagramOAuthError('Falha de rede ao chamar a Meta.');
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      // Só a mensagem de erro da Meta: a URL tem tokens e segredos.
      throw new InstagramOAuthError(
        `Meta respondeu ${response.status}: ${this.extractErrorMessage(payload)}`,
      );
    }

    return (payload ?? {}) as T;
  }

  private extractErrorMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return 'sem detalhes';

    const body = payload as {
      error_message?: unknown;
      error?: { message?: unknown };
    };
    const message = body.error_message ?? body.error?.message;

    return typeof message === 'string' ? message : 'sem detalhes';
  }
}
