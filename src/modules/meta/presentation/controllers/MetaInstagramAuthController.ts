import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Public } from '../../../../shared/presentation/decorators/Public';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import {
  CompleteInstagramConnectionUseCase,
  type CompleteInstagramConnectionOutput,
} from '../../application/use-cases/CompleteInstagramConnectionUseCase';
import {
  ListInstagramConnectionsUseCase,
  type InstagramConnectionOutput,
} from '../../application/use-cases/ListInstagramConnectionsUseCase';
import { RevokeInstagramConnectionUseCase } from '../../application/use-cases/RevokeInstagramConnectionUseCase';
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
    private readonly listConnections: ListInstagramConnectionsUseCase,
    private readonly revokeConnection: RevokeInstagramConnectionUseCase,
  ) {}

  /** Status das conexões dos experts da empresa, lido do banco. */
  @Get('connections')
  connections(
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<InstagramConnectionOutput[]> {
    return this.listConnections.execute({ tenantId: auth.tenantId });
  }

  /** Desconecta o expert e apaga o token guardado. */
  @Delete('connections/:expertId')
  @HttpCode(204)
  async revoke(
    @Param('expertId') expertId: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<void> {
    if (!isUuidV7(expertId)) {
      throw DomainError.validationFailed({
        errors: ['Informe um expertId válido.'],
      });
    }

    await this.revokeConnection.execute({ tenantId: auth.tenantId, expertId });
  }

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

    url.hash = 'instagram';

    return url.toString();
  }

  private single(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }
}
