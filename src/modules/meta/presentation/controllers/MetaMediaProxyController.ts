import { Controller, Get, Headers, Logger, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Public } from '../../../../shared/presentation/decorators/Public';
import {
  InstagramMediaUrls,
  isMetaCdnUrl,
} from '../../infra/media/InstagramMediaUrls';

const HEADERS_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const FORWARDED_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'last-modified',
  'etag',
];

/**
 * Entrega fotos e vídeos do Instagram pelo nosso domínio (ver
 * InstagramMediaUrls). Pública porque `<img>` e `<video>` não enviam o token;
 * só links assinados por nós e ainda válidos são aceitos.
 */
@Public()
@Controller('meta/media')
export class MetaMediaProxyController {
  private readonly logger = new Logger(MetaMediaProxyController.name);

  constructor(private readonly mediaUrls: InstagramMediaUrls) {}

  @Get()
  async proxy(
    @Query('u') encoded: unknown,
    @Query('e') expiresAt: unknown,
    @Query('s') signature: unknown,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const url = this.mediaUrls.verify(encoded, expiresAt, signature);
    if (!url) throw new DomainError(403, 'MEDIA_LINK_INVALID');

    const abort = new AbortController();
    response.on('close', () => abort.abort());

    const upstream = await this.fetchFromMeta(url, range, abort);
    const contentType = upstream.headers.get('content-type') ?? '';
    const isImage = contentType.startsWith('image/');

    if (!isImage && !contentType.startsWith('video/')) {
      abort.abort();
      throw new DomainError(502, 'MEDIA_TYPE_NOT_ALLOWED');
    }
    if (
      isImage &&
      Number(upstream.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES
    ) {
      abort.abort();
      throw new DomainError(502, 'MEDIA_TOO_LARGE');
    }

    response.status(upstream.status);
    FORWARDED_HEADERS.forEach((name) => {
      const value = upstream.headers.get(name);
      if (value) response.setHeader(name, value);
    });
    // O front fica em outra origem: sem isso o navegador bloquearia de novo.
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');

    if (!upstream.body) {
      response.end();
      return;
    }

    Readable.fromWeb(upstream.body as WebReadableStream)
      .on('error', (error) => {
        if (!abort.signal.aborted) {
          this.logger.warn(`Falha ao repassar mídia: ${String(error)}`);
        }
        response.destroy();
      })
      .pipe(response);
  }

  /** Segue redirecionamentos só para CDNs da Meta. */
  private async fetchFromMeta(
    url: string,
    range: string | undefined,
    abort: AbortController,
  ): Promise<globalThis.Response> {
    const timer = setTimeout(() => abort.abort(), HEADERS_TIMEOUT_MS);
    let current = url;

    try {
      for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
        const upstream = await fetch(current, {
          redirect: 'manual',
          signal: abort.signal,
          headers: range && /^bytes=[\d,\s-]+$/.test(range) ? { range } : {},
        });

        if (upstream.status >= 300 && upstream.status < 400) {
          const location = upstream.headers.get('location');
          const next = location ? new URL(location, current).toString() : null;
          if (!next || !isMetaCdnUrl(next)) break;
          current = next;
          continue;
        }

        if (!upstream.ok) {
          // A Meta expira os links da CDN: 403/404 aqui é mídia que já não vale.
          throw new DomainError(
            upstream.status === 403 || upstream.status === 404 ? 404 : 502,
            'MEDIA_UNAVAILABLE',
          );
        }

        return upstream;
      }
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError(502, 'MEDIA_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }

    throw new DomainError(502, 'MEDIA_UNAVAILABLE');
  }
}
