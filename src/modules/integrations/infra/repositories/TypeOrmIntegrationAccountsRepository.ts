import { Injectable } from '@nestjs/common';
import { IsNull, type Repository } from 'typeorm';
import type { IntegrationAccount } from '../../domain/entities/IntegrationAccount';
import { IntegrationAccountType } from '../../domain/enums/IntegrationAccountType';
import { IntegrationProvider } from '../../domain/enums/IntegrationProvider';
import type { WhatsAppIntegrationAccountsRepository } from '../../domain/repositories/IntegrationAccountsRepository';
import { IntegrationAccountOrmEntity } from '../entities/IntegrationAccountOrmEntity';
import { IntegrationAccountMapper } from '../mappers/IntegrationAccountMapper';

@Injectable()
export class TypeOrmIntegrationAccountsRepository implements WhatsAppIntegrationAccountsRepository {
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

  async existsConnectedWhatsAppWaba(
    wabaId: string,
    excludeExpertId?: string,
  ): Promise<boolean> {
    const query = this.repository
      .createQueryBuilder('account')
      .where('account.provider = :provider', {
        provider: IntegrationProvider.WHATSAPP,
      })
      .andWhere('account.type = :type', {
        type: IntegrationAccountType.PHONE_NUMBER,
      })
      .andWhere('account.disconnectedAt IS NULL')
      .andWhere("account.metadata ->> 'wabaId' = :wabaId", { wabaId });

    if (excludeExpertId) {
      query.andWhere('account.expertId != :excludeExpertId', {
        excludeExpertId,
      });
    }

    return query.getExists();
  }
}
