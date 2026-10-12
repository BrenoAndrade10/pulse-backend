import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Environment } from '../../../../config/Environment';
import { Public } from '../../../../shared/presentation/decorators/Public';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import {
  CompleteInstagramConnectionUseCase,
  type CompleteInstagramConnectionOutput,
} from '../../application/use-cases/CompleteInstagramConnectionUseCase';
import { StartInstagramConnectionUseCase } from '../../application/use-cases/StartInstagramConnectionUseCase';
import { startInstagramConnectionSchema } from '../schemas/StartInstagramConnectionSchema';

/**
 * Login da empresa no Instagram, por expert.
 *
 * 1. O frontend chama POST /meta/instagram/authorizations com o expert e
 *    redireciona o usuário para a `authorizationUrl` devolvida.
 * 2. A Meta devolve o usuário para GET /meta/instagram/callback (a URL de
 *    redirecionamento cadastrada no app), que salva o token criptografado e
 *    manda o usuário de volta à tela do expert no frontend.
 */
@Controller('meta/instagram')
export class MetaInstagramAuthController {
  constructor(
    private readonly startConnection: StartInstagramConnectionUseCase,
    private readonly completeConnection: CompleteInstagramConnectionUseCase,
  ) {}

  @Post('authorizations')
  async start(
    @Body() body: unknown,
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<{ authorizationUrl: string }> {
    const input = await startInstagramConnectionSchema.validate(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    return this.startConnection.execute({
      tenantId: auth.tenantId,
      userId: auth.userId,
      expertId: input.expertId,
    });
  }

  /** Pública: quem chega aqui é o navegador vindo da Meta, sem Bearer token. */
  @Public()
  @Get('callback')
  async callback(
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.completeConnection.execute({
      state: this.single(query.state),
      code: this.single(query.code),
      error: this.single(query.error),
    });

    // A URL de chegada carregava o código de autorização.
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.redirect(302, this.frontendUrlFor(result));
  }

  /** Destino sempre no frontend configurado: nunca vem da requisição. */
  private frontendUrlFor(result: CompleteInstagramConnectionOutput): string {
    const path = result.expertId
      ? `/experts/${encodeURIComponent(result.expertId)}`
      : '/experts';
    const url = new URL(path, Environment.vars.FRONTEND_URL);

    if (result.status === 'connected') {
      url.searchParams.set('instagram', 'connected');
    } else {
      url.searchParams.set('instagram', 'error');
      url.searchParams.set('reason', result.reason);
    }

    url.hash = 'facebook';

    return url.toString();
  }

  private single(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }
}
