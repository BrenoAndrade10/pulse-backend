import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_two_factor')
export class UserTwoFactorOrmEntity {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ type: 'text' })
  secretEncrypted: string;

  @Column({ type: 'varchar', length: 32 })
  secretIv: string;

  @Column({ type: 'varchar', length: 32 })
  secretAuthTag: string;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date | null;

  @Column({ type: 'bigint', nullable: true })
  lastUsedStep?: string | null;

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
