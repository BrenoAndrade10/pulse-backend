import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantStatus } from '../../domain/enums/TenantStatus';

@Entity('tenants')
@Index('IDX_tenants_status', ['status'])
export class TenantOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 50, default: TenantStatus.ACTIVE })
  status: TenantStatus;

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
