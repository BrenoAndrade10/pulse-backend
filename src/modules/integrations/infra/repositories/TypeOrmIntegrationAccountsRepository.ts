import { Injectable } from '@nestjs/common';
import { IsNull, type Repository } from 'typeorm';
import type { IntegrationAccount } from '../../domain/entities/IntegrationAccount';
import type { IntegrationAccountType } from '../../domain/enums/IntegrationAccountType';
import type { IntegrationProvider } from '../../domain/enums/IntegrationProvider';
import type { IntegrationAccountsRepository } from '../../domain/repositories/IntegrationAccountsRepository';
import { IntegrationAccountOrmEntity } from '../entities/IntegrationAccountOrmEntity';
import { IntegrationAccountMapper } from '../mappers/IntegrationAccountMapper';

@Injectable()
export class TypeOrmIntegrationAccountsRepository implements IntegrationAccountsRepository {
  constructor(
    private readonly repository: Repository<IntegrationAccountOrmEntity>,
  ) {}

  async findConnectedByExpert(
    tenantId: string,
    expertId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationAccount[]> {
    const accounts = await this.repository.find({
      where: { tenantId, expertId, provider, disconnectedAt: IsNull() },
    });

    return accounts.map((account) =>
      IntegrationAccountMapper.toDomain(account),
    );
  }

  async findConnectedByExternalId(
    provider: IntegrationProvider,
    type: IntegrationAccountType,
    externalId: string,
  ): Promise<IntegrationAccount[]> {
    const accounts = await this.repository.find({
      where: { provider, type, externalId, disconnectedAt: IsNull() },
    });

    return accounts.map((account) =>
      IntegrationAccountMapper.toDomain(account),
    );
  }

  async findConnectedByTenant(
    tenantId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationAccount[]> {
    const accounts = await this.repository.find({
      where: { tenantId, provider, disconnectedAt: IsNull() },
    });

    return accounts.map((account) =>
      IntegrationAccountMapper.toDomain(account),
    );
  }
}
