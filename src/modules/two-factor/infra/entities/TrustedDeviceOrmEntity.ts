import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('trusted_devices')
@Index('IDX_trusted_devices_user_expiration', ['userId', 'expiresAt'])
export class TrustedDeviceOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp' })
  lastUsedAt: Date;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => "timezone('utc', now())",
  })
  createdAt: Date;
}
