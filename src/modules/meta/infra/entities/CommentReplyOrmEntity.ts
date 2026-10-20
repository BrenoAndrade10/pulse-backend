import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CommentReplyStatus } from '../../domain/enums/CommentReplyStatus';

/** Índices e CHECKs ficam na migration CreateInstagramCommentReplies. */
@Entity('instagram_comment_replies')
export class CommentReplyOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  expertId: string;

  /** Fica nulo se a automação for excluída; o registro continua impedindo DM repetida. */
  @Column({ type: 'uuid', nullable: true })
  automationId: string | null;

  @Column({ type: 'varchar', length: 64 })
  mediaId: string;

  @Column({ type: 'varchar', length: 64 })
  commentId: string;

  @Column({ type: 'varchar', length: 64 })
  commenterId: string;

  @Column({ type: 'varchar', length: 50 })
  matchedKeyword: string;

  @Column({ type: 'varchar', length: 16 })
  status: CommentReplyStatus;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorReason?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  publicReplyStatus?: CommentReplyStatus | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  publicReplyError?: string | null;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => "timezone('utc', now())",
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => "timezone('utc', now())",
  })
  updatedAt: Date;
}
