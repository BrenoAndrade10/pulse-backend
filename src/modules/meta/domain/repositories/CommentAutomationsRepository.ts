import type { CommentAutomation } from '../entities/CommentAutomation';

export const COMMENT_AUTOMATIONS_REPOSITORY = Symbol(
  'COMMENT_AUTOMATIONS_REPOSITORY',
);

export interface CommentAutomationsRepository {
  /** Cria ou substitui a regra do Reel (uma por expert e mídia). */
  upsert(automation: CommentAutomation): Promise<CommentAutomation>;
  findByExpert(
    tenantId: string,
    expertId: string,
  ): Promise<CommentAutomation[]>;
  findByMedia(
    tenantId: string,
    expertId: string,
    mediaId: string,
  ): Promise<CommentAutomation | null>;
  delete(tenantId: string, expertId: string, mediaId: string): Promise<boolean>;
}
