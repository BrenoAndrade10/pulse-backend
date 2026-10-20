import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { LaunchStatus } from '../../domain/enums/LaunchStatus';
import { LaunchType } from '../../domain/enums/LaunchType';

@Entity('launches')
@Index('IDX_launches_tenant_status', ['tenantId', 'status'])
@Index('IDX_launches_tenant_expert', ['tenantId', 'expertId'])
@Index('IDX_launches_tenant_slug_active', ['tenantId', 'slug'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
@Index('IDX_launches_tenant_deleted', ['tenantId', 'deletedAt'])
@Check(
  'CHK_launches_date_range',
  '"startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" >= "startsAt"',
)
export class LaunchOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  expertId: string;

  @Column({ type: 'varchar', length: 180 })
  slug: string;

  @Column({ type: 'varchar', length: 50, default: LaunchType.OTHER })
  type: LaunchType;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, default: LaunchStatus.DRAFT })
  status: LaunchStatus;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt?: Date;

  @Column({ type: 'varchar', length: 100, default: 'UTC' })
  timezone: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  plannedBudget: string | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  revenueGoal: string | null;

  @Column({ type: 'integer', nullable: true })
  leadGoal: number | null;

  @Column({ type: 'integer', nullable: true })
  salesGoal: number | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  deletedBy: string | null;

  @VersionColumn({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
