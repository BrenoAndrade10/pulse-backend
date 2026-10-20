import type { CommentReply } from '../entities/CommentReply';

export const COMMENT_REPLIES_REPOSITORY = Symbol('COMMENT_REPLIES_REPOSITORY');

export type CommentReplyStats = { sent: number; lastSentAt: Date | null };

export interface CommentRepliesRepository {
  /**
   * Reserva o comentário antes de enviar a DM. Devolve false se ele já foi
   * reservado (webhook repetido), o que impede uma segunda mensagem.
   */
  claim(reply: CommentReply): Promise<boolean>;
  markSent(id: string, sentAt: Date): Promise<void>;
  markFailed(id: string, reason: string): Promise<void>;
  markPublicReply(
    id: string,
    result: { sent: true } | { sent: false; reason: string },
  ): Promise<void>;
  statsByAutomation(
    tenantId: string,
    expertId: string,
  ): Promise<Map<string, CommentReplyStats>>;
}
