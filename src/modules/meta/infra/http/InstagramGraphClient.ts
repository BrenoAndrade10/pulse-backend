import { Injectable } from '@nestjs/common';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';

const GRAPH_URL = 'https://graph.instagram.com';
const REQUEST_TIMEOUT_MS = 15_000;
const INVALID_TOKEN_CODE = 190;

export type InstagramGraphParams = Record<string, string | number | boolean>;

@Injectable()
export class InstagramGraphClient {
  get<TResponse>(
    path: string,
    params: InstagramGraphParams,
    accessToken: string,
  ): Promise<TResponse> {
    const url = this.url(path, params);
    url.searchParams.set('access_token', accessToken);

    return this.request<TResponse>(url, { method: 'GET' });
  }

  async subscribeToComments(accessToken: string): Promise<void> {
    const url = this.url('/me/subscribed_apps', {
      subscribed_fields: 'comments',
    });
    url.searchParams.set('access_token', accessToken);

    await this.request(url, { method: 'POST' });
  }

  async sendPrivateReply(input: {
    instagramUserId: string;
    commentId: string;
    text: string;
    button?: { label: string; url: string };
    accessToken: string;
  }): Promise<{ messageId: string | null }> {
    const url = this.url(
      `/${encodeURIComponent(input.instagramUserId)}/messages`,
    );
    const response = await this.request<{ message_id?: unknown }>(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { comment_id: input.commentId },
        message: input.button
          ? {
              attachment: {
                type: 'template',
                payload: {
                  template_type: 'button',
                  text: input.text,
                  buttons: [
                    {
                      type: 'web_url',
                      url: input.button.url,
                      title: input.button.label,
                    },
                  ],
                },
              },
            }
          : { text: input.text },
      }),
    });

    return {
      messageId:
        typeof response?.message_id === 'string' ? response.message_id : null,
    };
  }

  async replyToComment(input: {
    commentId: string;
    text: string;
    accessToken: string;
  }): Promise<void> {
    const url = this.url(`/${encodeURIComponent(input.commentId)}/replies`);
    url.searchParams.set('access_token', input.accessToken);

    await this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input.text }),
    });
  }

  private url(path: string, params: InstagramGraphParams = {}): URL {
    Environment.assertInitialized();

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(
      `${GRAPH_URL}/${Environment.vars.INSTAGRAM_GRAPH_API_VERSION}${normalizedPath}`,
    );

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    return url;
  }

  private async request<TResponse>(
    url: URL,
    init: RequestInit,
  ): Promise<TResponse> {
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new DomainError(502, 'INSTAGRAM_GRAPH_API_UNAVAILABLE');
    }

    const data: unknown = await response
      .json()
      .catch((): undefined => undefined);

    if (!response.ok) {
      const error = this.extractError(data);

      if (error.code === INVALID_TOKEN_CODE) {
        throw new DomainError(409, 'INSTAGRAM_ACCESS_TOKEN_INVALID');
      }

      throw new DomainError(502, 'INSTAGRAM_GRAPH_API_ERROR', {
        message:
          error.message ??
          `Erro ao chamar a Instagram Graph API: ${response.status}`,
        ...(error.code !== undefined && { code: error.code }),
      });
    }

    return data as TResponse;
  }

  private extractError(data: unknown): { code?: number; message?: string } {
    const error = (data as { error?: { code?: unknown; message?: unknown } })
      ?.error;

    return {
      code: typeof error?.code === 'number' ? error.code : undefined,
      message: typeof error?.message === 'string' ? error.message : undefined,
    };
  }
}
