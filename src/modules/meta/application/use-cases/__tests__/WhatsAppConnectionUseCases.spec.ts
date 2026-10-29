import { Environment } from '../../../../../config/Environment';
import type { IdGenerator } from '../../../../../shared/domain/IdGenerator';
import type { ExpertsRepository } from '../../../../experts/domain/repositories/ExpertsRepository';
import { IntegrationAccount } from '../../../../integrations/domain/entities/IntegrationAccount';
import { IntegrationCredential } from '../../../../integrations/domain/entities/IntegrationCredential';
import { IntegrationAccountType } from '../../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationCredentialStatus } from '../../../../integrations/domain/enums/IntegrationCredentialStatus';
import { IntegrationProvider } from '../../../../integrations/domain/enums/IntegrationProvider';
import type { IntegrationAccountsRepository } from '../../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { WhatsAppIntegrationAccountsRepository } from '../../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { IntegrationCredentialsRepository } from '../../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import type { DeletableIntegrationCredentialsRepository } from '../../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import type { IntegrationTokenCipher } from '../../../../integrations/domain/services/IntegrationTokenCipher';
import { MetaConfigService } from '../../../infra/config/MetaConfigService';
import type { WhatsAppGraphClient } from '../../../infra/http/WhatsAppGraphClient';
import type { WhatsAppConnectionSecurity } from '../../../infra/security/WhatsAppConnectionSecurity';
import { ConnectWhatsAppUseCase } from '../ConnectWhatsAppUseCase';
import { DisconnectWhatsAppUseCase } from '../DisconnectWhatsAppUseCase';
import { GetWhatsAppConnectionUseCase } from '../GetWhatsAppConnectionUseCase';

const encrypted = { encryptedValue: 'value', iv: 'iv', authTag: 'tag' };
const now = new Date('2026-10-20T12:00:00Z');

describe('WhatsApp connection use cases', () => {
  let experts: jest.Mocked<Pick<ExpertsRepository, 'findByTenantIdAndId'>>;
  let accounts: jest.Mocked<
    Pick<
      WhatsAppIntegrationAccountsRepository,
      | 'findConnectedByExternalId'
      | 'findConnectedByExpert'
      | 'existsConnectedWhatsAppWaba'
    >
  >;
  let credentials: jest.Mocked<
    Pick<
      DeletableIntegrationCredentialsRepository,
      'replaceActive' | 'findActiveWithAccessToken' | 'deleteActive'
    >
  >;
  let cipher: jest.Mocked<IntegrationTokenCipher>;
  let graph: jest.Mocked<
    Pick<
      WhatsAppGraphClient,
      | 'exchangeCode'
      | 'debugToken'
      | 'listPhoneNumbers'
      | 'subscribe'
      | 'register'
      | 'unsubscribe'
    >
  >;
  let ids: IdGenerator;
  let config: MetaConfigService;
  let encryptMock: jest.Mock;
  let security: jest.Mocked<
    Pick<WhatsAppConnectionSecurity, 'acquire' | 'release'>
  >;

  beforeEach(() => {
    Environment.vars = {
      META_APP_ID: 'app-id',
      META_APP_SECRET: 'app-secret',
      META_GRAPH_API_VERSION: 'v25.0',
    } as typeof Environment.vars;
    config = new MetaConfigService();
    experts = { findByTenantIdAndId: jest.fn().mockResolvedValue({}) };
    accounts = {
      findConnectedByExternalId: jest.fn().mockResolvedValue([]),
      findConnectedByExpert: jest.fn().mockResolvedValue([]),
      existsConnectedWhatsAppWaba: jest.fn().mockResolvedValue(false),
    };
    credentials = {
      replaceActive: jest.fn().mockResolvedValue(undefined),
      findActiveWithAccessToken: jest.fn().mockResolvedValue(null),
      deleteActive: jest.fn().mockResolvedValue(true),
    };
    encryptMock = jest.fn().mockReturnValue(encrypted);
    cipher = {
      assertConfigured: jest.fn(),
      encrypt: encryptMock,
      decrypt: jest.fn().mockReturnValue('token'),
    };
    graph = {
      exchangeCode: jest.fn().mockResolvedValue('token'),
      debugToken: jest.fn().mockResolvedValue({
        isValid: true,
        appId: 'app-id',
        granularScopes: [
          {
            scope: 'whatsapp_business_management',
            targetIds: ['123'],
          },
          {
            scope: 'whatsapp_business_messaging',
            targetIds: ['123'],
          },
        ],
      }),
      listPhoneNumbers: jest.fn().mockResolvedValue([
        {
          id: '456',
          displayPhoneNumber: '+55 11 99999-9999',
          verifiedName: 'Pulse',
          qualityRating: 'GREEN',
        },
      ]),
      subscribe: jest.fn().mockResolvedValue(undefined),
      register: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    };
    let sequence = 0;
    ids = { generate: () => `019a-id-${++sequence}` };
    security = {
      acquire: jest.fn().mockResolvedValue('lock-token'),
      release: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('validates ownership and persists encrypted token and pin', async () => {
    const useCase = new ConnectWhatsAppUseCase(
      config,
      graph as unknown as WhatsAppGraphClient,
      experts as unknown as ExpertsRepository,
      accounts as unknown as WhatsAppIntegrationAccountsRepository,
      credentials as unknown as IntegrationCredentialsRepository,
      cipher,
      ids,
      security as unknown as WhatsAppConnectionSecurity,
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-id',
        expertId: 'expert-id',
        code: 'code',
        wabaId: '123',
        phoneNumberId: '456',
      }),
    ).resolves.toMatchObject({ status: 'connected', phoneNumberId: '456' });
    expect(graph.subscribe).toHaveBeenCalledWith('123', 'token');
    expect(graph.register).toHaveBeenCalledWith(
      '456',
      expect.stringMatching(/^\d{6}$/),
      'token',
    );
    expect(encryptMock).toHaveBeenCalledTimes(2);
    expect(credentials.replaceActive).toHaveBeenCalledWith(
      expect.any(IntegrationCredential),
      [expect.any(IntegrationAccount)],
    );
    expect(security.release).toHaveBeenCalledWith('456', 'lock-token');
  });

  it('rejects when another connection owns the phone lock', async () => {
    security.acquire.mockResolvedValue(null);
    const useCase = new ConnectWhatsAppUseCase(
      config,
      graph as unknown as WhatsAppGraphClient,
      experts as unknown as ExpertsRepository,
      accounts as unknown as WhatsAppIntegrationAccountsRepository,
      credentials as unknown as IntegrationCredentialsRepository,
      cipher,
      ids,
      security as unknown as WhatsAppConnectionSecurity,
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-id',
        expertId: 'expert-id',
        code: 'code',
        wabaId: '123',
        phoneNumberId: '456',
      }),
    ).rejects.toMatchObject({ reason: 'WHATSAPP_CONNECTION_IN_PROGRESS' });
    expect(graph.exchangeCode).not.toHaveBeenCalled();
  });

  it('unsubscribes an unused WABA when persistence fails', async () => {
    credentials.replaceActive.mockRejectedValue(new Error('database down'));
    const useCase = new ConnectWhatsAppUseCase(
      config,
      graph as unknown as WhatsAppGraphClient,
      experts as unknown as ExpertsRepository,
      accounts as unknown as WhatsAppIntegrationAccountsRepository,
      credentials as unknown as IntegrationCredentialsRepository,
      cipher,
      ids,
      security as unknown as WhatsAppConnectionSecurity,
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-id',
        expertId: 'expert-id',
        code: 'code',
        wabaId: '123',
        phoneNumberId: '456',
      }),
    ).rejects.toThrow('database down');
    expect(graph.unsubscribe).toHaveBeenCalledWith('123', 'token');
    expect(security.release).toHaveBeenCalledWith('456', 'lock-token');
  });

  it('rejects a token without both granular scopes for the WABA', async () => {
    graph.debugToken.mockResolvedValue({
      isValid: true,
      appId: 'app-id',
      granularScopes: [],
    });
    const useCase = new ConnectWhatsAppUseCase(
      config,
      graph as unknown as WhatsAppGraphClient,
      experts as unknown as ExpertsRepository,
      accounts as unknown as WhatsAppIntegrationAccountsRepository,
      credentials as unknown as DeletableIntegrationCredentialsRepository,
      cipher,
      ids,
      security as unknown as WhatsAppConnectionSecurity,
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-id',
        expertId: 'expert-id',
        code: 'code',
        wabaId: '123',
        phoneNumberId: '456',
      }),
    ).rejects.toMatchObject({ reason: 'WHATSAPP_ACCOUNT_NOT_AUTHORIZED' });
    expect(graph.subscribe).not.toHaveBeenCalled();
  });

  it('reads connection status only from repositories', async () => {
    accounts.findConnectedByExpert.mockResolvedValue([
      new IntegrationAccount({
        id: 'account-id',
        tenantId: 'tenant-id',
        expertId: 'expert-id',
        credentialId: 'credential-id',
        provider: IntegrationProvider.WHATSAPP,
        type: IntegrationAccountType.PHONE_NUMBER,
        externalId: '456',
        metadata: {
          displayPhoneNumber: '+55 11 99999-9999',
          verifiedName: 'Pulse',
          qualityRating: 'GREEN',
        },
        connectedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    ]);
    const useCase = new GetWhatsAppConnectionUseCase(
      config,
      experts as unknown as ExpertsRepository,
      accounts as unknown as IntegrationAccountsRepository,
    );

    await expect(useCase.execute('tenant-id', 'expert-id')).resolves.toEqual({
      status: 'connected',
      phoneNumberId: '456',
      displayPhoneNumber: '+55 11 99999-9999',
      verifiedName: 'Pulse',
      qualityRating: 'GREEN',
      connectedAt: now,
    });
    expect(graph.listPhoneNumbers).not.toHaveBeenCalled();
  });

  it('continues revocation when Graph unsubscription fails', async () => {
    const credential = new IntegrationCredential({
      id: 'credential-id',
      tenantId: 'tenant-id',
      expertId: 'expert-id',
      provider: IntegrationProvider.WHATSAPP,
      accessToken: encrypted,
      scopes: [],
      status: IntegrationCredentialStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    credentials.findActiveWithAccessToken.mockResolvedValue(credential);
    accounts.findConnectedByExpert.mockResolvedValue([
      new IntegrationAccount({
        id: 'account-id',
        tenantId: 'tenant-id',
        expertId: 'expert-id',
        credentialId: 'credential-id',
        provider: IntegrationProvider.WHATSAPP,
        type: IntegrationAccountType.PHONE_NUMBER,
        externalId: '456',
        metadata: { wabaId: '123' },
        connectedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    ]);
    graph.unsubscribe.mockRejectedValue(new Error('Meta unavailable'));
    const useCase = new DisconnectWhatsAppUseCase(
      graph as unknown as WhatsAppGraphClient,
      experts as unknown as ExpertsRepository,
      accounts as unknown as WhatsAppIntegrationAccountsRepository,
      credentials as unknown as DeletableIntegrationCredentialsRepository,
      cipher,
    );

    await expect(useCase.execute('tenant-id', 'expert-id')).resolves.toBe(
      undefined,
    );
    expect(credentials.deleteActive).toHaveBeenCalledWith(
      'tenant-id',
      'expert-id',
      IntegrationProvider.WHATSAPP,
    );
  });
});
