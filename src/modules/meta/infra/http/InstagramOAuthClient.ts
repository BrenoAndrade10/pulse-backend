import { Environment } from '../../../../config/Environment';
import {
  InstagramOAuthError,
  type InstagramAuthorizedAccount,
  type InstagramOAuthGateway,
  type MetaUserAccessToken,
} from '../../domain/services/InstagramOAuthGateway';

const AUTHORIZE_URL = 'https://www.facebook.com/dialog/oauth';
const GRAPH_URL = 'https://graph.facebook.com';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PAGE_BATCHES = 20;

export const INSTAGRAM_REQUIRED_PERMISSIONS = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_messages',
] as const;

const REQUIRED_PAGE_TASKS: ReadonlyArray<readonly [string, string]> = [
  ['MESSAGING', 'PROFILE_PLUS_MESSAGING'],
  ['MODERATE', 'PROFILE_PLUS_MODERATE'],
];

type PageAccount = {
  id?: string;
  name?: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: { id?: string };
};

type PageAccountsResponse = {
  data?: PageAccount[];
  paging?: { cursors?: { after?: string } };
};

export class InstagramOAuthClient implements InstagramOAuthGateway {
  isConfigured(): boolean {
    const {
      META_APP_ID,
      META_APP_SECRET,
      INSTAGRAM_CONFIG_ID,
      INSTAGRAM_REDIRECT_URI,
    } = Environment.vars;

    return Boolean(
      META_APP_ID &&
      META_APP_SECRET &&
      INSTAGRAM_CONFIG_ID &&
      INSTAGRAM_REDIRECT_URI,
    );
  }

  buildAuthorizationUrl(state: string): string {
    const url = new URL(AUTHORIZE_URL);

    url.searchParams.set('client_id', this.config.appId);
    url.searchParams.set('config_id', this.config.configId);
    url.searchParams.set('display', 'popup');
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('override_default_response_type', 'true');
    url.searchParams.set('state', state);

    return url.toString();
  }

  exchangeCode(code: string): Promise<MetaUserAccessToken> {
    return this.exchangeToken({
      grant_type: 'authorization_code',
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      redirect_uri: this.config.redirectUri,
      code,
    });
  }

  exchangeForLongLivedToken(
    shortLivedToken: string,
  ): Promise<MetaUserAccessToken> {
    return this.exchangeToken({
      grant_type: 'fb_exchange_token',
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      fb_exchange_token: shortLivedToken,
    });
  }

  async getAuthorizedAccount(
    userAccessToken: string,
  ): Promise<InstagramAuthorizedAccount> {
    const permissions = await this.getGrantedPermissions(userAccessToken);
    const missing = INSTAGRAM_REQUIRED_PERMISSIONS.filter(
      (permission) => !permissions.includes(permission),
    );

    if (missing.length > 0) {
      throw new InstagramOAuthError(
        'missing_permissions',
        `Permissões obrigatórias não concedidas: ${missing.join(', ')}.`,
      );
    }

    const [authorizingUser, pages] = await Promise.all([
      this.graphGet<{ id?: string }>('/me', { fields: 'id' }, userAccessToken),
      this.getPageAccounts(userAccessToken),
    ]);
    const accounts = new Map<
      string,
      {
        accessToken: string;
        pageId: string;
        pageName: string;
        pageTasks: string[];
      }
    >();

    for (const page of pages) {
      const instagramId = page.instagram_business_account?.id;

      if (!page.id || !page.name || !page.access_token || !instagramId) {
        continue;
      }

      accounts.set(instagramId, {
        accessToken: page.access_token,
        pageId: page.id,
        pageName: page.name,
        pageTasks: Array.isArray(page.tasks) ? page.tasks : [],
      });
    }

    if (!authorizingUser.id || accounts.size === 0) {
      throw new InstagramOAuthError(
        'no_instagram_account',
        'Nenhuma conta profissional vinculada a uma Página foi autorizada.',
      );
    }

    if (accounts.size > 1) {
      throw new InstagramOAuthError(
        'multiple_instagram_accounts',
        'Mais de uma conta profissional foi autorizada.',
      );
    }

    const [userId, page] = [...accounts.entries()][0];
    const missingTasks = REQUIRED_PAGE_TASKS.filter(
      (alternatives) =>
        !alternatives.some((task) => page.pageTasks.includes(task)),
    );

    if (missingTasks.length > 0) {
      throw new InstagramOAuthError(
        'missing_permissions',
        `Tarefas obrigatórias da Página ausentes: ${missingTasks
          .map(([task]) => task)
          .join(', ')}.`,
      );
    }

    const profile = await this.graphGet<{ id?: string; username?: string }>(
      `/${encodeURIComponent(userId)}`,
      { fields: 'id,username' },
      page.accessToken,
    );

    if (profile.id !== userId || !profile.username) {
      throw new InstagramOAuthError(
        'exchange_failed',
        'A Meta retornou uma conta profissional inválida.',
      );
    }

    return {
      authorizingUserId: authorizingUser.id,
      permissions,
      accessToken: page.accessToken,
      userId,
      username: profile.username,
      pageId: page.pageId,
      pageName: page.pageName,
      pageTasks: page.pageTasks,
    };
  }

  private async exchangeToken(
    fields: Record<string, string>,
  ): Promise<MetaUserAccessToken> {
    const form = new URLSearchParams(fields);
    const payload = await this.request<{
      access_token?: string;
      expires_in?: number;
    }>(`${this.graphBaseUrl}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    if (
      !payload.access_token ||
      typeof payload.expires_in !== 'number' ||
      payload.expires_in <= 0
    ) {
      throw new InstagramOAuthError(
        'exchange_failed',
        'Resposta inesperada na troca do código.',
      );
    }

    return {
      accessToken: payload.access_token,
      expiresInSeconds: payload.expires_in,
    };
  }

  private async getGrantedPermissions(accessToken: string): Promise<string[]> {
    const payload = await this.graphGet<{
      data?: Array<{ permission?: string; status?: string }>;
    }>('/me/permissions', {}, accessToken);

    return (payload.data ?? [])
      .filter((item) => item.status === 'granted')
      .map((item) => item.permission)
      .filter((permission): permission is string => Boolean(permission));
  }

  private async getPageAccounts(accessToken: string): Promise<PageAccount[]> {
    const pages: PageAccount[] = [];
    let after: string | undefined;

    for (let batch = 0; batch < MAX_PAGE_BATCHES; batch += 1) {
      const response = await this.graphGet<PageAccountsResponse>(
        '/me/accounts',
        {
          fields: 'id,name,access_token,tasks,instagram_business_account{id}',
          ...(after ? { after } : {}),
        },
        accessToken,
      );

      pages.push(...(response.data ?? []));
      after = response.paging?.cursors?.after;
      if (!after) break;
    }

    if (after) {
      throw new InstagramOAuthError(
        'exchange_failed',
        'A Meta retornou mais Páginas do que foi possível validar.',
      );
    }

    return pages;
  }

  private graphGet<T>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
  ): Promise<T> {
    const url = new URL(`${this.graphBaseUrl}${path}`);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return this.request<T>(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  private get graphBaseUrl(): string {
    return `${GRAPH_URL}/${this.config.apiVersion}`;
  }

  private get config() {
    if (!this.isConfigured()) {
      throw new InstagramOAuthError(
        'exchange_failed',
        'Login unificado da Meta não configurado.',
      );
    }

    const vars = Environment.vars;

    return {
      appId: vars.META_APP_ID!,
      appSecret: vars.META_APP_SECRET!,
      configId: vars.INSTAGRAM_CONFIG_ID!,
      redirectUri: vars.INSTAGRAM_REDIRECT_URI!,
      apiVersion: vars.META_GRAPH_API_VERSION,
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
      throw new InstagramOAuthError(
        'exchange_failed',
        'Falha de rede ao chamar a Meta.',
      );
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const code = this.extractErrorCode(payload);
      throw new InstagramOAuthError(
        'exchange_failed',
        `Meta respondeu ${response.status}${code ? ` (código ${code})` : ''}.`,
      );
    }

    return (payload ?? {}) as T;
  }

  private extractErrorCode(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;

    const code = (payload as { error?: { code?: unknown } }).error?.code;
    return typeof code === 'number' || typeof code === 'string'
      ? String(code)
      : null;
  }
}
