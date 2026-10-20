import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Índices e CHECKs ficam na migration CreateInstagramCommentAutomations. */
@Entity('instagram_comment_automations')
export class CommentAutomationOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  expertId: string;

  @Column({ type: 'varchar', length: 64 })
  mediaId: string;

  @Column({ type: 'jsonb' })
  keywords: string[];

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  buttonLabel?: string | null;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  buttonUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  commentReply?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

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
