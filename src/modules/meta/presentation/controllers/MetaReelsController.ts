import { Controller, Get, Param, Query } from '@nestjs/common';
import { ValidationError } from 'yup';
import { DomainError } from '../../../../shared/errors/DomainError';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import { ListInstagramReelsUseCase } from '../../application/use-cases/ListInstagramReelsUseCase';
import {
  instagramPostsQuerySchema,
  type InstagramPostsQuery,
} from '../schemas/InstagramPostsQuerySchema';

@Controller('experts/:expertId/instagram')
export class MetaReelsController {
  constructor(private readonly listInstagramPosts: ListInstagramReelsUseCase) {}

  /** Todas as mídias (fotos, carrosséis, vídeos e Reels), uma página da Meta. */
  @Get('posts')
  async listPosts(
    @Param('expertId') expertId: string,
    @Query() query: unknown,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    if (!isUuidV7(expertId)) {
      throw DomainError.validationFailed({
        errors: ['Informe um expertId válido.'],
      });
    }
    const input = await this.validate(query);
    return this.listInstagramPosts.execute({
      tenantId: auth.tenantId,
      expertId,
      limit: input.limit,
      after: input.after,
    });
  }

  private async validate(query: unknown): Promise<InstagramPostsQuery> {
    try {
      return await instagramPostsQuerySchema.validate(query, {
        abortEarly: false,
        stripUnknown: false,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw DomainError.validationFailed({ errors: error.errors });
      }
      throw error;
    }
  }
}
