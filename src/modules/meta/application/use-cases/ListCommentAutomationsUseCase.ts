import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import type { CommentAutomation } from '../../domain/entities/CommentAutomation';
import { COMMENT_AUTOMATIONS_REPOSITORY } from '../../domain/repositories/CommentAutomationsRepository';
import type { CommentAutomationsRepository } from '../../domain/repositories/CommentAutomationsRepository';
import { COMMENT_REPLIES_REPOSITORY } from '../../domain/repositories/CommentRepliesRepository';
import type {
  CommentRepliesRepository,
  CommentReplyStats,
} from '../../domain/repositories/CommentRepliesRepository';

export type CommentAutomationWithStats = {
  automation: CommentAutomation;
  stats: CommentReplyStats;
};

@Injectable()
export class ListCommentAutomationsUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly expertsRepository: ExpertsRepository,

    @Inject(COMMENT_AUTOMATIONS_REPOSITORY)
    private readonly automationsRepository: CommentAutomationsRepository,

    @Inject(COMMENT_REPLIES_REPOSITORY)
    private readonly repliesRepository: CommentRepliesRepository,
  ) {}

  async execute(input: {
    tenantId: string | null;
    expertId: string;
  }): Promise<CommentAutomationWithStats[]> {
    if (!input.tenantId) throw new DomainError(403, 'TENANT_REQUIRED');

    const expert = await this.expertsRepository.findByTenantIdAndId(
      input.tenantId,
      input.expertId,
    );
    if (!expert) throw DomainError.expertNotFound();

    const [automations, stats] = await Promise.all([
      this.automationsRepository.findByExpert(input.tenantId, input.expertId),
      this.repliesRepository.statsByAutomation(input.tenantId, input.expertId),
    ]);

    return automations.map((automation) => ({
      automation,
      stats: stats.get(automation.id) ?? { sent: 0, lastSentAt: null },
    }));
  }
}
