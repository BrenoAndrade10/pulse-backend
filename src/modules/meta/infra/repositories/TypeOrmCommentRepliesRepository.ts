import { Injectable } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import type { CommentReply } from '../../domain/entities/CommentReply';
import { CommentReplyStatus } from '../../domain/enums/CommentReplyStatus';
import type {
  CommentRepliesRepository,
  CommentReplyStats,
} from '../../domain/repositories/CommentRepliesRepository';
import { CommentReplyOrmEntity } from '../entities/CommentReplyOrmEntity';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmCommentRepliesRepository implements CommentRepliesRepository {
  constructor(private readonly repository: Repository<CommentReplyOrmEntity>) {}

  async claim(reply: CommentReply): Promise<boolean> {
    try {
      await this.repository.insert({
        id: reply.id,
        tenantId: reply.tenantId,
        expertId: reply.expertId,
        automationId: reply.automationId,
        mediaId: reply.mediaId,
        commentId: reply.commentId,
        commenterId: reply.commenterId,
        matchedKeyword: reply.matchedKeyword,
        status: reply.status,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      });

      return true;
    } catch (error) {
      // Comentário já reservado: a Meta reenviou o mesmo webhook.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        return false;
      }

      throw error;
    }
  }

  async markSent(id: string, sentAt: Date): Promise<void> {
    await this.repository.update(id, {
      status: CommentReplyStatus.SENT,
      sentAt,
      errorReason: null,
    });
  }

  async markFailed(id: string, reason: string): Promise<void> {
    await this.repository.update(id, {
      status: CommentReplyStatus.FAILED,
      errorReason: reason.slice(0, 64),
    });
  }

  async markPublicReply(
    id: string,
    result: { sent: true } | { sent: false; reason: string },
  ): Promise<void> {
    await this.repository.update(id, {
      publicReplyStatus: result.sent
        ? CommentReplyStatus.SENT
        : CommentReplyStatus.FAILED,
      publicReplyError: result.sent ? null : result.reason.slice(0, 64),
    });
  }

  async statsByAutomation(
    tenantId: string,
    expertId: string,
  ): Promise<Map<string, CommentReplyStats>> {
    const rows = await this.repository
      .createQueryBuilder('reply')
      .select('reply.automationId', 'automationId')
      .addSelect('COUNT(*)', 'sent')
      .addSelect('MAX(reply.sentAt)', 'lastSentAt')
      .where('reply.tenantId = :tenantId', { tenantId })
      .andWhere('reply.expertId = :expertId', { expertId })
      .andWhere('reply.status = :status', { status: CommentReplyStatus.SENT })
      .andWhere('reply.automationId IS NOT NULL')
      .groupBy('reply.automationId')
      .getRawMany<{
        automationId: string;
        sent: string;
        lastSentAt: Date | null;
      }>();

    return new Map(
      rows.map((row) => [
        row.automationId,
        { sent: Number(row.sent), lastSentAt: row.lastSentAt },
      ]),
    );
  }
}
