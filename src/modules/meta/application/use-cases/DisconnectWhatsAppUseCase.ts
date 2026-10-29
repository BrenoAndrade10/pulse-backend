import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { IntegrationAccountType } from '../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationProvider } from '../../../integrations/domain/enums/IntegrationProvider';
import { INTEGRATION_ACCOUNTS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { WhatsAppIntegrationAccountsRepository } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import { INTEGRATION_CREDENTIALS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import type { DeletableIntegrationCredentialsRepository } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import { INTEGRATION_TOKEN_CIPHER } from '../../../integrations/domain/services/IntegrationTokenCipher';
import type { IntegrationTokenCipher } from '../../../integrations/domain/services/IntegrationTokenCipher';
import { WhatsAppGraphClient } from '../../infra/http/WhatsAppGraphClient';

@Injectable()
export class DisconnectWhatsAppUseCase {
  private readonly logger = new Logger(DisconnectWhatsAppUseCase.name);

  constructor(
    private readonly graph: WhatsAppGraphClient,
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,
    @Inject(INTEGRATION_ACCOUNTS_REPOSITORY)
    private readonly accounts: WhatsAppIntegrationAccountsRepository,
    @Inject(INTEGRATION_CREDENTIALS_REPOSITORY)
    private readonly credentials: DeletableIntegrationCredentialsRepository,
    @Inject(INTEGRATION_TOKEN_CIPHER)
    private readonly cipher: IntegrationTokenCipher,
  ) {}

  async execute(tenantId: string | null, expertId: string): Promise<void> {
    if (!tenantId) throw new DomainError(403, 'TENANT_REQUIRED');
    if (!(await this.experts.findByTenantIdAndId(tenantId, expertId))) {
      throw DomainError.expertNotFound();
    }

    const [credential, accounts] = await Promise.all([
      this.credentials.findActiveWithAccessToken(
        tenantId,
        expertId,
        IntegrationProvider.WHATSAPP,
      ),
      this.accounts.findConnectedByExpert(
        tenantId,
        expertId,
        IntegrationProvider.WHATSAPP,
      ),
    ]);
    const account = accounts.find(
      (item) => item.type === IntegrationAccountType.PHONE_NUMBER,
    );
    const wabaId =
      typeof account?.metadata.wabaId === 'string'
        ? account.metadata.wabaId
        : undefined;

    if (credential?.accessToken && wabaId) {
      try {
        const usedElsewhere = await this.accounts.existsConnectedWhatsAppWaba(
          wabaId,
          expertId,
        );
        if (!usedElsewhere) {
          const accessToken = this.cipher.decrypt(credential.accessToken, {
            tenantId,
            expertId,
            credentialId: credential.id,
            provider: credential.provider,
            purpose: 'access_token',
          });
          await this.graph.unsubscribe(wabaId, accessToken);
        }
      } catch {
        this.logger.warn(
          `Falha ao remover assinatura WhatsApp do expert ${expertId}`,
        );
      }
    }

    await this.credentials.deleteActive(
      tenantId,
      expertId,
      IntegrationProvider.WHATSAPP,
    );
  }
}
