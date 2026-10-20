import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { CommentAutomation } from '../../domain/entities/CommentAutomation';
import { COMMENT_AUTOMATIONS_REPOSITORY } from '../../domain/repositories/CommentAutomationsRepository';
import type { CommentAutomationsRepository } from '../../domain/repositories/CommentAutomationsRepository';
import { uniqueKeywords } from '../../domain/services/commentKeywords';
import { InstagramGraphClient } from '../../infra/http/InstagramGraphClient';
import { InstagramAccessTokens } from '../services/InstagramAccessTokens';

export type SaveCommentAutomationInput = {
  tenantId: string | null;
  expertId: string;
  mediaId: string;
  keywords: string[];
  message: string;
  button?: { label: string; url: string } | null;
  commentReply?: string | null;
  isActive: boolean;
};

/** Cria ou atualiza a regra de DM automática de um Reel. */
@Injectable()
export class SaveCommentAutomationUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly expertsRepository: ExpertsRepository,

    @Inject(COMMENT_AUTOMATIONS_REPOSITORY)
    private readonly automationsRepository: CommentAutomationsRepository,

    private readonly accessTokens: InstagramAccessTokens,
    private readonly instagramGraphClient: InstagramGraphClient,

    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: SaveCommentAutomationInput): Promise<CommentAutomation> {
    if (!input.tenantId) throw new DomainError(403, 'TENANT_REQUIRED');

    const expert = await this.expertsRepository.findByTenantIdAndId(
      input.tenantId,
      input.expertId,
    );
    if (!expert) throw DomainError.expertNotFound();

    const keywords = uniqueKeywords(input.keywords);
    if (keywords.length === 0) {
      throw DomainError.validationFailed({
        errors: ['Informe pelo menos uma palavra-chave.'],
      });
    }

    // Sem a inscrição a Meta não avisa dos comentários e a regra nunca
    // dispararia: ativar só funciona com a conta inscrita.
    if (input.isActive) {
      const accessToken = await this.accessTokens.forExpert(
        input.tenantId,
        input.expertId,
      );
      await this.instagramGraphClient.subscribeToComments(accessToken);
    }

    const existing = await this.automationsRepository.findByMedia(
      input.tenantId,
      input.expertId,
      input.mediaId,
    );
    const now = new Date();

    return this.automationsRepository.upsert(
      new CommentAutomation({
        id: existing?.id ?? this.idGenerator.generate(),
        tenantId: input.tenantId,
        expertId: input.expertId,
        mediaId: input.mediaId,
        keywords,
        message: input.message.trim(),
        button: input.button
          ? { label: input.button.label.trim(), url: input.button.url.trim() }
          : undefined,
        commentReply: input.commentReply?.trim() || undefined,
        isActive: input.isActive,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }),
    );
  }
}
