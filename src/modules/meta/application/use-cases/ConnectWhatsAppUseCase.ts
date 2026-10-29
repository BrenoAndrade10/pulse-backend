/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { DomainError } from '../../../../shared/errors/DomainError';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { IntegrationAccount } from '../../../integrations/domain/entities/IntegrationAccount';
import { IntegrationCredential } from '../../../integrations/domain/entities/IntegrationCredential';
import { IntegrationAccountType } from '../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationCredentialStatus } from '../../../integrations/domain/enums/IntegrationCredentialStatus';
import { IntegrationProvider } from '../../../integrations/domain/enums/IntegrationProvider';
import { INTEGRATION_ACCOUNTS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { WhatsAppIntegrationAccountsRepository } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import { INTEGRATION_CREDENTIALS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import type { IntegrationCredentialsRepository } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import { INTEGRATION_TOKEN_CIPHER } from '../../../integrations/domain/services/IntegrationTokenCipher';
import type { IntegrationTokenCipher } from '../../../integrations/domain/services/IntegrationTokenCipher';
import { MetaConfigService } from '../../infra/config/MetaConfigService';
import { WhatsAppGraphClient } from '../../infra/http/WhatsAppGraphClient';
import { WhatsAppConnectionSecurity } from '../../infra/security/WhatsAppConnectionSecurity';
import type { WhatsAppConnectionOutput } from './GetWhatsAppConnectionUseCase';

const REQUIRED_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
];

export type ConnectWhatsAppInput = {
  tenantId: string | null;
  expertId: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
};

@Injectable()
export class ConnectWhatsAppUseCase {
  private readonly logger = new Logger(ConnectWhatsAppUseCase.name);

  constructor(
    private readonly config: MetaConfigService,
    private readonly graph: WhatsAppGraphClient,
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,
    @Inject(INTEGRATION_ACCOUNTS_REPOSITORY)
    private readonly accounts: WhatsAppIntegrationAccountsRepository,
    @Inject(INTEGRATION_CREDENTIALS_REPOSITORY)
    private readonly credentials: IntegrationCredentialsRepository,
    @Inject(INTEGRATION_TOKEN_CIPHER)
    private readonly cipher: IntegrationTokenCipher,
    @Inject(ID_GENERATOR)
    private readonly ids: IdGenerator,
    private readonly security: WhatsAppConnectionSecurity,
  ) {}

  async execute(
    input: ConnectWhatsAppInput,
  ): Promise<WhatsAppConnectionOutput> {
    this.assertConfigured();
    if (!input.tenantId) throw new DomainError(403, 'TENANT_REQUIRED');
    if (
      !(await this.experts.findByTenantIdAndId(input.tenantId, input.expertId))
    ) {
      throw DomainError.expertNotFound();
    }

    const lock = await this.security.acquire(input.phoneNumberId);
    if (!lock) {
      throw new DomainError(409, 'WHATSAPP_CONNECTION_IN_PROGRESS');
    }

    try {
      return await this.connect(
        input as ConnectWhatsAppInput & {
          tenantId: string;
        },
      );
    } finally {
      await this.security.release(input.phoneNumberId, lock).catch(() => {
        this.logger.warn(
          `Falha ao liberar lock de conexão WhatsApp do número ${input.phoneNumberId}`,
        );
      });
    }
  }

  private async connect(
    input: ConnectWhatsAppInput & { tenantId: string },
  ): Promise<WhatsAppConnectionOutput> {
    const accessToken = await this.graph.exchangeCode(input.code);
    const details = await this.graph.debugToken(accessToken);
    if (!this.isAuthorized(details, input.wabaId)) {
      throw new DomainError(403, 'WHATSAPP_ACCOUNT_NOT_AUTHORIZED');
    }

    const phone = (
      await this.graph.listPhoneNumbers(input.wabaId, accessToken)
    ).find((item) => item.id === input.phoneNumberId);
    if (!phone) {
      throw new DomainError(403, 'WHATSAPP_ACCOUNT_NOT_AUTHORIZED');
    }

    const connected = await this.accounts.findConnectedByExternalId(
      IntegrationProvider.WHATSAPP,
      IntegrationAccountType.PHONE_NUMBER,
      input.phoneNumberId,
    );

    if (
      connected.some(
        (account) =>
          account.tenantId !== input.tenantId ||
          account.expertId !== input.expertId,
      )
    ) {
      throw new DomainError(409, 'WHATSAPP_NUMBER_ALREADY_CONNECTED');
    }

    await this.graph.subscribe(input.wabaId, accessToken);
    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.graph.register(input.phoneNumberId, pin, accessToken);

    const now = new Date();
    const credentialId = this.ids.generate();
    const owner = {
      tenantId: input.tenantId,
      expertId: input.expertId,
      provider: IntegrationProvider.WHATSAPP,
    };
    const context = { ...owner, credentialId };

    try {
      await this.credentials.replaceActive(
        new IntegrationCredential({
          ...owner,
          id: credentialId,
          externalUserId: input.wabaId,
          accessToken: this.cipher.encrypt(accessToken, {
            ...context,
            purpose: 'access_token',
          }),
          refreshToken: this.cipher.encrypt(pin, {
            ...context,
            purpose: 'refresh_token',
          }),
          scopes: REQUIRED_SCOPES,
          status: IntegrationCredentialStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        }),
        [
          new IntegrationAccount({
            ...owner,
            id: this.ids.generate(),
            credentialId,
            type: IntegrationAccountType.PHONE_NUMBER,
            externalId: phone.id,
            displayName: phone.displayPhoneNumber ?? undefined,
            metadata: {
              wabaId: input.wabaId,
              displayPhoneNumber: phone.displayPhoneNumber,
              verifiedName: phone.verifiedName,
              qualityRating: phone.qualityRating,
            },
            connectedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        ],
      );
    } catch (error) {
      await this.unsubscribeIfUnused(input.wabaId, accessToken);
      throw error;
    }

    return {
      status: 'connected',
      phoneNumberId: phone.id,
      displayPhoneNumber: phone.displayPhoneNumber,
      verifiedName: phone.verifiedName,
      qualityRating: phone.qualityRating,
      connectedAt: now,
    };
  }

  private async unsubscribeIfUnused(
    wabaId: string,
    accessToken: string,
  ): Promise<void> {
    try {
      if (!(await this.accounts.existsConnectedWhatsAppWaba(wabaId))) {
        await this.graph.unsubscribe(wabaId, accessToken);
      }
    } catch {
      this.logger.warn(
        `Falha ao compensar assinatura WhatsApp do WABA ${wabaId}`,
      );
    }
  }

  private assertConfigured(): void {
    if (!this.config.appId || !this.config.appSecret) {
      throw new DomainError(503, 'WHATSAPP_NOT_CONFIGURED');
    }
    this.cipher.assertConfigured();
  }

  private isAuthorized(
    details: Awaited<ReturnType<WhatsAppGraphClient['debugToken']>>,
    wabaId: string,
  ): boolean {
    return (
      details.isValid &&
      details.appId === this.config.appId &&
      REQUIRED_SCOPES.every((required) =>
        details.granularScopes.some(
          ({ scope, targetIds }) =>
            scope === required && targetIds.includes(wabaId),
        ),
      )
    );
  }
}
