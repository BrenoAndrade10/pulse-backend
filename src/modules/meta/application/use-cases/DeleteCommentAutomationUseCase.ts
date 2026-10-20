import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { COMMENT_AUTOMATIONS_REPOSITORY } from '../../domain/repositories/CommentAutomationsRepository';
import type { CommentAutomationsRepository } from '../../domain/repositories/CommentAutomationsRepository';

/** Remove a regra do Reel. O histórico de DMs enviadas continua guardado. */
@Injectable()
export class DeleteCommentAutomationUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly expertsRepository: ExpertsRepository,

    @Inject(COMMENT_AUTOMATIONS_REPOSITORY)
    private readonly automationsRepository: CommentAutomationsRepository,
  ) {}

  async execute(input: {
    tenantId: string | null;
    expertId: string;
    mediaId: string;
  }): Promise<void> {
    if (!input.tenantId) throw new DomainError(403, 'TENANT_REQUIRED');

    const expert = await this.expertsRepository.findByTenantIdAndId(
      input.tenantId,
      input.expertId,
    );
    if (!expert) throw DomainError.expertNotFound();

    // Idempotente: excluir o que já não existe não é erro.
    await this.automationsRepository.delete(
      input.tenantId,
      input.expertId,
      input.mediaId,
    );
  }
}
