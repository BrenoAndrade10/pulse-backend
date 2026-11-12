import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../../../shared/presentation/decorators/Public';
import { ResolveLinkRedirectUseCase } from '../../application/use-cases/ResolveLinkRedirectUseCase';

const CODE_PATTERN = /^[a-z0-9]{7,16}$/;
const UNAVAILABLE_HTML =
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Link indisponível</title></head><body><h1>Este link não está disponível.</h1></body></html>';
const INACTIVE_HTML =
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Link desativado</title></head><body><h1>Este link foi desativado.</h1></body></html>';

@Public()
@Controller('l')
export class LinkRedirectController {
  constructor(private readonly resolve: ResolveLinkRedirectUseCase) {}

  @Get(':code')
  async redirect(
    @Param('code') code: string,
    @Query() query: Record<string, string | string[] | undefined>,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (!CODE_PATTERN.test(code)) {
      this.sendUnavailable(response, 404, UNAVAILABLE_HTML);
      return;
    }
    const result = await this.resolve.execute({
      code,
      query,
      ip: request.ip ?? '',
      userAgent: request.get('user-agent') ?? '',
      referrer: request.get('referer') ?? '',
      now: new Date(),
    });
    if (result.kind === 'redirect') {
      response
        .status(302)
        .set({
          Location: result.url,
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'X-Content-Type-Options': 'nosniff',
        })
        .end();
      return;
    }
    this.sendUnavailable(
      response,
      result.kind === 'inactive' ? 410 : 404,
      result.kind === 'inactive' ? INACTIVE_HTML : UNAVAILABLE_HTML,
    );
  }

  private sendUnavailable(
    response: Response,
    status: number,
    html: string,
  ): void {
    response
      .status(status)
      .set({
        'Cache-Control': 'no-store',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      })
      .type('html')
      .send(html);
  }
}
