import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { MetaConfigService } from '../config/MetaConfigService';

export type MetaGraphParams = Record<string, string | number | boolean>;
export type MetaGraphBody = Record<string, unknown>;

@Injectable()
export class MetaGraphClient {
  constructor(private readonly metaConfigService: MetaConfigService) {}

  async get<TResponse>(
    path: string,
    params: MetaGraphParams = {},
    accessToken = this.metaConfigService.accessToken,
  ): Promise<TResponse> {
    const url = this.buildUrl(path, params);

    return this.request<TResponse>(url, {
      method: 'GET',
      headers: {
        Authorization: this.formatBearerToken(accessToken),
      },
    });
  }

  async post<TResponse>(
    path: string,
    body: MetaGraphBody,
    accessToken = this.metaConfigService.accessToken,
  ): Promise<TResponse> {
    const url = this.buildUrl(path);

    return this.request<TResponse>(url, {
      method: 'POST',
      headers: {
        Authorization: this.formatBearerToken(accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  private buildUrl(path: string, params: MetaGraphParams = {}): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(
      `${this.metaConfigService.graphApiBaseUrl}${normalizedPath}`,
    );

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  private async request<TResponse>(
    url: string,
    init: RequestInit,
  ): Promise<TResponse> {
    const response = await fetch(url, init);
    const data: unknown = await response
      .json()
      .catch((): undefined => undefined);

    if (!response.ok) {
      const message =
        this.extractMetaErrorMessage(data) ??
        `Erro ao chamar a Meta Graph API: ${response.status}`;

      throw new DomainError(502, 'META_GRAPH_API_ERROR', { message });
    }

    return data as TResponse;
  }

  private formatBearerToken(accessToken?: string): string {
    if (!accessToken) {
      throw new DomainError(500, 'META_ACCESS_TOKEN_NOT_CONFIGURED');
    }

    return `Bearer ${accessToken}`;
  }

  private extractMetaErrorMessage(data: unknown): string | undefined {
    if (!data || typeof data !== 'object' || !('error' in data)) {
      return undefined;
    }

    const error = (data as { error?: { message?: unknown } }).error;

    return typeof error?.message === 'string' ? error.message : undefined;
  }
}
