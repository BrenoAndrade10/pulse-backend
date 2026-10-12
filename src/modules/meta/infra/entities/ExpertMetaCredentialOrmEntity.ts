import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('expert_meta_credentials')
@Index('IDX_expert_meta_credentials_tenant_expert_active', [
  'tenantId',
  'expertId',
  'isActive',
])
@Index('IDX_expert_meta_credentials_tenant_instagram_user', [
  'tenantId',
  'instagramUserId',
])
export class ExpertMetaCredentialOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  expertId: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  metaUserId?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  instagramUserId?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  instagramUsername?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pageId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pageName?: string;

  @Column({ type: 'text' })
  accessTokenEncrypted: string;

  @Column({ type: 'varchar', length: 64 })
  accessTokenIv: string;

  @Column({ type: 'varchar', length: 64 })
  accessTokenAuthTag: string;

  @Column({ type: 'text', nullable: true })
  refreshTokenEncrypted?: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  refreshTokenIv?: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  refreshTokenAuthTag?: string;

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt?: Date;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  scopes: string[];

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
