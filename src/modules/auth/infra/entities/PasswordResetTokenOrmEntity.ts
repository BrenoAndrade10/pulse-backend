import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('password_reset_tokens')
export class PasswordResetTokenOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => "timezone('utc', now())",
  })
  createdAt: Date;
}
