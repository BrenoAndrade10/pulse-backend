import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { MetaConfigService } from '../config/MetaConfigService';

const REQUEST_TIMEOUT_MS = 10_000;
const INCORRECT_TWO_STEP_PIN_CODE = 133005;

type MetaError = { error?: { code?: unknown } };

export type WhatsAppTokenDetails = {
  isValid: boolean;
  appId: string | null;
  granularScopes: Array<{ scope: string; targetIds: string[] }>;
};

export type WhatsAppPhoneNumber = {
  id: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
};

@Injectable()
export class WhatsAppGraphClient {
  constructor(private readonly config: MetaConfigService) {}

  async exchangeCode(code: string): Promise<string> {
    const appId = this.required(this.config.appId);
    const appSecret = this.required(this.config.appSecret);
    const data = await this.request<{ access_token?: unknown }>(
      '/oauth/access_token',
      {
        method: 'POST',
        form: { client_id: appId, client_secret: appSecret, code },
      },
    );

    if (typeof data.access_token !== 'string' || !data.access_token) {
      throw new DomainError(502, 'WHATSAPP_GRAPH_API_ERROR');
    }
    return data.access_token;
  }

  async debugToken(accessToken: string): Promise<WhatsAppTokenDetails> {
    const appId = this.required(this.config.appId);
    const appSecret = this.required(this.config.appSecret);
    const response = await this.request<{
      data?: {
        is_valid?: unknown;
        app_id?: unknown;
        granular_scopes?: unknown;
      };
    }>('/debug_token', {
      method: 'GET',
      params: {
        input_token: accessToken,
        access_token: `${appId}|${appSecret}`,
      },
    });
    const data = response.data;
    const scopes = Array.isArray(data?.granular_scopes)
      ? data.granular_scopes
          .filter(
            (scope): scope is { scope: string; target_ids?: unknown } =>
              typeof scope === 'object' &&
              scope !== null &&
              typeof (scope as { scope?: unknown }).scope === 'string',
          )
          .map((scope) => ({
            scope: scope.scope,
            targetIds: Array.isArray(scope.target_ids)
              ? scope.target_ids.filter(
                  (id): id is string => typeof id === 'string',
                )
              : [],
          }))
      : [];

    return {
      isValid: data?.is_valid === true,
      appId: typeof data?.app_id === 'string' ? data.app_id : null,
      granularScopes: scopes,
    };
  }

  async listPhoneNumbers(
    wabaId: string,
    accessToken: string,
  ): Promise<WhatsAppPhoneNumber[]> {
    const phones: WhatsAppPhoneNumber[] = [];
    let after: string | undefined;

    for (let page = 0; page < 10; page += 1) {
      const response = await this.request<{
        data?: unknown;
        paging?: { cursors?: { after?: unknown } };
      }>(`/${encodeURIComponent(wabaId)}/phone_numbers`, {
        method: 'GET',
        accessToken,
        params: {
          fields: 'id,display_phone_number,verified_name,quality_rating',
          ...(after ? { after } : {}),
        },
      });
      phones.push(...this.parsePhoneNumbers(response.data));
      const nextAfter = response.paging?.cursors?.after;
      if (typeof nextAfter !== 'string' || !nextAfter) break;
      after = nextAfter;
    }

    return phones;
  }

  private parsePhoneNumbers(data: unknown): WhatsAppPhoneNumber[] {
    if (!Array.isArray(data)) return [];
    return data.flatMap((item) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as { id?: unknown }).id !== 'string'
      ) {
        return [];
      }
      const phone = item as Record<string, unknown>;
      return [
        {
          id: phone.id as string,
          displayPhoneNumber:
            typeof phone.display_phone_number === 'string'
              ? phone.display_phone_number
              : null,
          verifiedName:
            typeof phone.verified_name === 'string'
              ? phone.verified_name
              : null,
          qualityRating:
            typeof phone.quality_rating === 'string'
              ? phone.quality_rating
              : null,
        },
      ];
    });
  }

  async subscribe(wabaId: string, accessToken: string): Promise<void> {
    await this.request(`/${encodeURIComponent(wabaId)}/subscribed_apps`, {
      method: 'POST',
      accessToken,
    });
  }

  async unsubscribe(wabaId: string, accessToken: string): Promise<void> {
    await this.request(`/${encodeURIComponent(wabaId)}/subscribed_apps`, {
      method: 'DELETE',
      accessToken,
    });
  }

  async register(
    phoneNumberId: string,
    pin: string,
    accessToken: string,
  ): Promise<void> {
    await this.request(`/${encodeURIComponent(phoneNumberId)}/register`, {
      method: 'POST',
      accessToken,
      body: { messaging_product: 'whatsapp', pin },
    });
  }

  private required(value: string | undefined): string {
    if (!value) throw new DomainError(503, 'WHATSAPP_NOT_CONFIGURED');
    return value;
  }

  private async request<TResponse = unknown>(
    path: string,
    options: {
      method: 'GET' | 'POST' | 'DELETE';
      params?: Record<string, string>;
      accessToken?: string;
      body?: Record<string, unknown>;
      form?: Record<string, string>;
    },
  ): Promise<TResponse> {
    const url = new URL(`${this.config.whatsappGraphApiBaseUrl}${path}`);
    Object.entries(options.params ?? {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method,
        headers: {
          ...(options.accessToken
            ? { Authorization: `Bearer ${options.accessToken}` }
            : {}),
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.form
            ? { 'Content-Type': 'application/x-www-form-urlencoded' }
            : {}),
        },
        ...(options.body
          ? { body: JSON.stringify(options.body) }
          : options.form
            ? { body: new URLSearchParams(options.form).toString() }
            : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new DomainError(502, 'WHATSAPP_GRAPH_API_UNAVAILABLE');
    }

    const data: unknown = await response
      .json()
      .catch((): undefined => undefined);
    if (!response.ok) {
      const code = this.errorCode(data);
      if (code === INCORRECT_TWO_STEP_PIN_CODE) {
        throw new DomainError(409, 'WHATSAPP_NUMBER_HAS_TWO_STEP_PIN');
      }
      throw new DomainError(502, 'WHATSAPP_GRAPH_API_ERROR');
    }
    return data as TResponse;
  }

  private errorCode(data: unknown): number | null {
    const code = (data as MetaError | undefined)?.error?.code;
    return typeof code === 'number' ? code : null;
  }
}
