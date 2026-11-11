import { Injectable } from '@nestjs/common';
import { Environment } from '../../../../config/Environment';

@Injectable()
export class LinkShortUrlBuilder {
  private readonly baseUrl: string;

  constructor() {
    const configuredUrl = Environment.vars?.API_PUBLIC_URL?.trim();
    if (configuredUrl) {
      const url = new URL(configuredUrl);
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        throw new Error(
          'API_PUBLIC_URL deve usar HTTPS em produção para links curtos.',
        );
      }
      this.baseUrl = url.toString();
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'API_PUBLIC_URL é obrigatório em produção para links curtos.',
      );
    }

    const port = Environment.vars?.PORT ?? (Number(process.env.PORT) || 3000);
    this.baseUrl = `http://localhost:${port}`;
  }

  build(code: string): string {
    return new URL(`/l/${code}`, this.baseUrl).toString();
  }
}
