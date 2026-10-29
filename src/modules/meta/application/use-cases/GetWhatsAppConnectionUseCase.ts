import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { IntegrationAccountType } from '../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationProvider } from '../../../integrations/domain/enums/IntegrationProvider';
import { INTEGRATION_ACCOUNTS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { IntegrationAccountsRepository } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import { MetaConfigService } from '../../infra/config/MetaConfigService';

export type WhatsAppConnectionOutput =
  | {
      status: 'connected';
      phoneNumberId: string;
      displayPhoneNumber: string | null;
      verifiedName: string | null;
      qualityRating: string | null;
      connectedAt: Date;
    }
  | { status: 'disconnected' };

@Injectable()
export class GetWhatsAppConnectionUseCase {
  constructor(
    private readonly config: MetaConfigService,
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,
    @Inject(INTEGRATION_ACCOUNTS_REPOSITORY)
    private readonly accounts: IntegrationAccountsRepository,
  ) {}

  async execute(
    tenantId: string | null,
    expertId: string,
  ): Promise<WhatsAppConnectionOutput> {
    if (!this.config.appId || !this.config.appSecret) {
      throw new DomainError(503, 'WHATSAPP_NOT_CONFIGURED');
    }
    if (!tenantId) throw new DomainError(403, 'TENANT_REQUIRED');
    if (!(await this.experts.findByTenantIdAndId(tenantId, expertId))) {
      throw DomainError.expertNotFound();
    }

    const account = (
      await this.accounts.findConnectedByExpert(
        tenantId,
        expertId,
        IntegrationProvider.WHATSAPP,
      )
    ).find((item) => item.type === IntegrationAccountType.PHONE_NUMBER);
    if (!account) return { status: 'disconnected' };

    return {
      status: 'connected',
      phoneNumberId: account.externalId,
      displayPhoneNumber: this.metadataString(
        account.metadata.displayPhoneNumber,
      ),
      verifiedName: this.metadataString(account.metadata.verifiedName),
      qualityRating: this.metadataString(account.metadata.qualityRating),
      connectedAt: account.connectedAt,
    };
  }

  private metadataString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }
}
