import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExpertStatus } from '../../domain/enums/ExpertStatus';

@Entity('experts')
@Index('IDX_experts_tenant_status', ['tenantId', 'status'])
@Index('IDX_experts_tenant_email', ['tenantId', 'email'], { unique: true })
export class ExpertOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  commercialName?: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50, default: ExpertStatus.ACTIVE })
  status: ExpertStatus;

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
