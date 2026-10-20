import { Injectable } from '@nestjs/common';
import { In, IsNull, type EntityManager, type Repository } from 'typeorm';
import type { IntegrationAccount } from '../../domain/entities/IntegrationAccount';
import type { IntegrationCredential } from '../../domain/entities/IntegrationCredential';
import { IntegrationCredentialStatus } from '../../domain/enums/IntegrationCredentialStatus';
import type { IntegrationProvider } from '../../domain/enums/IntegrationProvider';
import type { IntegrationCredentialsRepository } from '../../domain/repositories/IntegrationCredentialsRepository';
import { IntegrationAccountOrmEntity } from '../entities/IntegrationAccountOrmEntity';
import { IntegrationCredentialOrmEntity } from '../entities/IntegrationCredentialOrmEntity';
import { IntegrationAccountMapper } from '../mappers/IntegrationAccountMapper';
import { IntegrationCredentialMapper } from '../mappers/IntegrationCredentialMapper';

/** Colunas com `select: false` que só `findActiveWithAccessToken` carrega. */
const ACCESS_TOKEN_COLUMNS = [
  'credential.accessTokenEncrypted',
  'credential.accessTokenIv',
  'credential.accessTokenAuthTag',
];

/** Valores que revogam uma credencial: desativa e apaga todo o segredo. */
const revocation = (
  revokedAt: Date,
): Partial<IntegrationCredentialOrmEntity> => ({
  status: IntegrationCredentialStatus.REVOKED,
  revokedAt,
  accessTokenEncrypted: null,
  accessTokenIv: null,
  accessTokenAuthTag: null,
  refreshTokenEncrypted: null,
  refreshTokenIv: null,
  refreshTokenAuthTag: null,
});

@Injectable()
export class TypeOrmIntegrationCredentialsRepository implements IntegrationCredentialsRepository {
  constructor(
    private readonly repository: Repository<IntegrationCredentialOrmEntity>,
  ) {}

  async replaceActive(
    credential: IntegrationCredential,
    accounts: IntegrationAccount[],
  ): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      await this.revokeIn(
        manager,
        credential.tenantId,
        credential.expertId,
        credential.provider,
        credential.createdAt,
      );
      await manager
        .getRepository(IntegrationCredentialOrmEntity)
        .insert(IntegrationCredentialMapper.toPersistence(credential));

      if (accounts.length > 0) {
        // `save` em vez de `insert`: o tipo do insert não aceita jsonb genérico.
        await manager
          .getRepository(IntegrationAccountOrmEntity)
          .save(accounts.map((a) => IntegrationAccountMapper.toPersistence(a)));
      }
    });
  }

  revokeActive(
    tenantId: string,
    expertId: string,
    provider: IntegrationProvider,
    revokedAt: Date,
  ): Promise<boolean> {
    return this.repository.manager.transaction((manager) =>
      this.revokeIn(manager, tenantId, expertId, provider, revokedAt),
    );
  }

  async findActiveWithAccessToken(
    tenantId: string,
    expertId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationCredential | null> {
    const credential = await this.repository
      .createQueryBuilder('credential')
      .addSelect(ACCESS_TOKEN_COLUMNS)
      .where('credential.tenantId = :tenantId', { tenantId })
      .andWhere('credential.expertId = :expertId', { expertId })
      .andWhere('credential.provider = :provider', { provider })
      .andWhere('credential.status = :status', {
        status: IntegrationCredentialStatus.ACTIVE,
      })
      .getOne();

    return credential ? IntegrationCredentialMapper.toDomain(credential) : null;
  }

  async findActiveByTenantId(
    tenantId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationCredential[]> {
    const credentials = await this.repository.find({
      where: { tenantId, provider, status: IntegrationCredentialStatus.ACTIVE },
    });

    return credentials.map((credential) =>
      IntegrationCredentialMapper.toDomain(credential),
    );
  }

  /** Revoga as credenciais ativas e desconecta as contas delas. */
  private async revokeIn(
    manager: EntityManager,
    tenantId: string,
    expertId: string,
    provider: IntegrationProvider,
    revokedAt: Date,
  ): Promise<boolean> {
    const credentials = manager.getRepository(IntegrationCredentialOrmEntity);
    const active = await credentials.find({
      select: { id: true },
      where: {
        tenantId,
        expertId,
        provider,
        status: IntegrationCredentialStatus.ACTIVE,
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (active.length === 0) return false;

    const ids = active.map((credential) => credential.id);

    await manager
      .getRepository(IntegrationAccountOrmEntity)
      .update(
        { credentialId: In(ids), disconnectedAt: IsNull() },
        { disconnectedAt: revokedAt },
      );
    await credentials.update({ id: In(ids) }, revocation(revokedAt));

    return true;
  }
}
