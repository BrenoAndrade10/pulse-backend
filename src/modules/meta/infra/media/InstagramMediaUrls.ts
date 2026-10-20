import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Environment } from '../../../../config/Environment';

/** Rota pública do proxy (MetaMediaProxyController). */
export const MEDIA_PROXY_PATH = '/meta/media';
const TTL_SECONDS = 3600;
const ALLOWED_HOSTS = ['cdninstagram.com', 'fbcdn.net'];

/** Só HTTPS em CDNs da Meta: o proxy nunca busca outro endereço. */
export function isMetaCdnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      ALLOWED_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

/**
 * A CDN do Instagram responde com `Cross-Origin-Resource-Policy:
 * same-origin`, e o navegador não exibe a mídia em outro site. As mídias
 * passam pelo nosso proxy, com links assinados: o `<img>` não envia o token
 * de login, e só links gerados aqui (com validade curta) são aceitos.
 */
@Injectable()
export class InstagramMediaUrls {
  /** Link do proxy para uma URL da CDN; `undefined` se não for da Meta. */
  sign(url: string | undefined, now = Date.now()): string | undefined {
    if (!url || !isMetaCdnUrl(url)) return undefined;

    const encoded = Buffer.from(url, 'utf8').toString('base64url');
    const expiresAt = Math.floor(now / 1000) + TTL_SECONDS;
    const params = new URLSearchParams({
      u: encoded,
      e: String(expiresAt),
      s: this.signature(encoded, expiresAt),
    });

    return `${MEDIA_PROXY_PATH}?${params}`;
  }

  /** URL original da CDN, ou `null` se o link foi alterado ou expirou. */
  verify(
    encoded: unknown,
    expiresAt: unknown,
    signature: unknown,
    now = Date.now(),
  ): string | null {
    if (
      typeof encoded !== 'string' ||
      typeof expiresAt !== 'string' ||
      typeof signature !== 'string' ||
      !/^\d{1,12}$/.test(expiresAt) ||
      Number(expiresAt) * 1000 < now
    ) {
      return null;
    }

    const expected = Buffer.from(
      this.signature(encoded, Number(expiresAt)),
      'base64url',
    );
    const received = Buffer.from(signature, 'base64url');

    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      return null;
    }

    const url = Buffer.from(encoded, 'base64url').toString('utf8');
    return isMetaCdnUrl(url) ? url : null;
  }

  private signature(encoded: string, expiresAt: number): string {
    return createHmac('sha256', this.key())
      .update(`${encoded}.${expiresAt}`)
      .digest('base64url');
  }

  /** Derivada do JWT_SECRET com rótulo próprio: não serve para assinar JWT. */
  private key(): Buffer {
    Environment.assertInitialized();

    return createHmac('sha256', Environment.vars.JWT_SECRET)
      .update('instagram-media-proxy:v1')
      .digest();
  }
}
