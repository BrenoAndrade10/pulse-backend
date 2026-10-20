import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IntegrationAccountType } from '../../domain/enums/IntegrationAccountType';
import { IntegrationProvider } from '../../domain/enums/IntegrationProvider';

/** Índices, FK composta e CHECKs ficam na migration CreateIntegrationAccounts. */
@Entity('integration_accounts')
export class IntegrationAccountOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  expertId: string;

  @Column({ type: 'uuid' })
  credentialId: string;

  @Column({ type: 'varchar', length: 32 })
  provider: IntegrationProvider;

  @Column({ type: 'varchar', length: 48 })
  type: IntegrationAccountType;

  @Column({ type: 'varchar', length: 255 })
  externalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @Column({ type: 'timestamp' })
  connectedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  disconnectedAt?: Date | null;

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
