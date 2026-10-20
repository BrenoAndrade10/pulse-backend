import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IntegrationCredentialStatus } from '../../domain/enums/IntegrationCredentialStatus';
import { IntegrationProvider } from '../../domain/enums/IntegrationProvider';

/** Índices e CHECKs ficam na migration CreateIntegrationCredentials. */
@Entity('integration_credentials')
export class IntegrationCredentialOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  expertId: string;

  @Column({ type: 'varchar', length: 32 })
  provider: IntegrationProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalUserId?: string | null;

  // Colunas do token ficam fora dos SELECTs por padrão: só quem chama o
  // provedor pede o token explicitamente.
  @Column({ type: 'text', nullable: true, select: false })
  accessTokenEncrypted?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  accessTokenIv?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  accessTokenAuthTag?: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  refreshTokenEncrypted?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  refreshTokenIv?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  refreshTokenAuthTag?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  tokenExpiresAt?: Date | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  scopes: string[];

  @Column({ type: 'varchar', length: 16 })
  status: IntegrationCredentialStatus;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date | null;

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
