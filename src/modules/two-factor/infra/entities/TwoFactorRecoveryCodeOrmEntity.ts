import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('two_factor_recovery_codes')
@Index('IDX_two_factor_recovery_codes_user', ['userId'])
export class TwoFactorRecoveryCodeOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  codeHash: string;

  @Column({ type: 'timestamp', nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => "timezone('utc', now())",
  })
  createdAt: Date;
}
