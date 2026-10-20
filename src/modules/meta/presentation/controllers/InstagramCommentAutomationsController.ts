import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
} from '@nestjs/common';
import { ValidationError } from 'yup';
import { DomainError } from '../../../../shared/errors/DomainError';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import { DeleteCommentAutomationUseCase } from '../../application/use-cases/DeleteCommentAutomationUseCase';
import {
  ListCommentAutomationsUseCase,
  type CommentAutomationWithStats,
} from '../../application/use-cases/ListCommentAutomationsUseCase';
import { SaveCommentAutomationUseCase } from '../../application/use-cases/SaveCommentAutomationUseCase';
import {
  isInstagramMediaId,
  saveCommentAutomationSchema,
  type SaveCommentAutomationSchemaInput,
} from '../schemas/CommentAutomationSchema';

/** DM automática por Reel: palavra-chave no comentário → resposta privada. */
@Controller('experts/:expertId/instagram/automations')
export class InstagramCommentAutomationsController {
  constructor(
    private readonly listAutomations: ListCommentAutomationsUseCase,
    private readonly saveAutomation: SaveCommentAutomationUseCase,
    private readonly deleteAutomation: DeleteCommentAutomationUseCase,
  ) {}

  @Get()
  async list(
    @Param('expertId') expertId: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateExpertId(expertId);
    const automations = await this.listAutomations.execute({
      tenantId: auth.tenantId,
      expertId,
    });
    return automations.map((item) => this.toResponse(item));
  }

  @Put(':mediaId')
  async save(
    @Param('expertId') expertId: string,
    @Param('mediaId') mediaId: string,
    @Body() body: unknown,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateExpertId(expertId);
    this.validateMediaId(mediaId);
    const input = await this.validate(body);
    const automation = await this.saveAutomation.execute({
      tenantId: auth.tenantId,
      expertId,
      mediaId,
      ...input,
    });
    const [saved] = (
      await this.listAutomations.execute({ tenantId: auth.tenantId, expertId })
    ).filter((item) => item.automation.id === automation.id);

    return this.toResponse(
      saved ?? { automation, stats: { sent: 0, lastSentAt: null } },
    );
  }

  @Delete(':mediaId')
  @HttpCode(204)
  async delete(
    @Param('expertId') expertId: string,
    @Param('mediaId') mediaId: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<void> {
    this.validateExpertId(expertId);
    this.validateMediaId(mediaId);
    await this.deleteAutomation.execute({
      tenantId: auth.tenantId,
      expertId,
      mediaId,
    });
  }

  private toResponse({ automation, stats }: CommentAutomationWithStats) {
    return {
      id: automation.id,
      mediaId: automation.mediaId,
      keywords: automation.keywords,
      message: automation.message,
      button: automation.button ?? null,
      commentReply: automation.commentReply ?? null,
      isActive: automation.isActive,
      sentCount: stats.sent,
      lastSentAt: stats.lastSentAt,
      updatedAt: automation.updatedAt,
    };
  }

  private validateExpertId(expertId: string): void {
    if (!isUuidV7(expertId)) {
      throw DomainError.validationFailed({
        errors: ['Informe um expertId válido.'],
      });
    }
  }

  private validateMediaId(mediaId: string): void {
    if (!isInstagramMediaId(mediaId)) {
      throw DomainError.validationFailed({
        errors: ['Informe um Reel válido.'],
      });
    }
  }

  private async validate(
    body: unknown,
  ): Promise<SaveCommentAutomationSchemaInput> {
    try {
      return await saveCommentAutomationSchema.validate(body, {
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
