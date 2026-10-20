import { randomBytes } from 'node:crypto';
import { Environment } from '../../../../../config/Environment';
import { DomainError } from '../../../../../shared/errors/DomainError';
import { UuidV7IdGenerator } from '../../../../../shared/infra/ids/UuidV7IdGenerator';
import { Expert } from '../../../../experts/domain/entities/Expert';
import { ExpertStatus } from '../../../../experts/domain/enums/ExpertStatus';
import type { ExpertsRepository } from '../../../../experts/domain/repositories/ExpertsRepository';
import type { IntegrationAccount } from '../../../../integrations/domain/entities/IntegrationAccount';
import type { IntegrationCredential } from '../../../../integrations/domain/entities/IntegrationCredential';
import { IntegrationAccountType } from '../../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationCredentialStatus } from '../../../../integrations/domain/enums/IntegrationCredentialStatus';
import { IntegrationProvider } from '../../../../integrations/domain/enums/IntegrationProvider';
import type { IntegrationCredentialsRepository } from '../../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import { IntegrationTokenEncryptionService } from '../../../../integrations/infra/crypto/IntegrationTokenEncryptionService';
import type {
  InstagramOAuthState,
  OAuthStateStore,
} from '../../../domain/repositories/OAuthStateStore';
import {
  InstagramOAuthError,
  type InstagramOAuthGateway,
} from '../../../domain/services/InstagramOAuthGateway';
import { CompleteInstagramConnectionUseCase } from '../CompleteInstagramConnectionUseCase';
import { StartInstagramConnectionUseCase } from '../StartInstagramConnectionUseCase';

class InMemoryStateStore implements OAuthStateStore {
  readonly states = new Map<string, InstagramOAuthState>();

  save(state: string, payload: InstagramOAuthState): Promise<void> {
    this.states.set(state, payload);
    return Promise.resolve();
  }

  consume(state: string): Promise<InstagramOAuthState | null> {
    const payload = this.states.get(state) ?? null;
    this.states.delete(state);
    return Promise.resolve(payload);
  }
}

class InMemoryExpertsRepository implements ExpertsRepository {
  readonly experts: Expert[] = [];

  create(expert: Expert): Promise<Expert> {
    this.experts.push(expert);
    return Promise.resolve(expert);
  }

  findById(id: string): Promise<Expert | null> {
    return Promise.resolve(this.experts.find((e) => e.id === id) ?? null);
  }

  findByTenantId(tenantId: string): Promise<Expert[]> {
    return Promise.resolve(this.experts.filter((e) => e.tenantId === tenantId));
  }
}

class InMemoryCredentialsRepository implements IntegrationCredentialsRepository {
  readonly credentials: IntegrationCredential[] = [];
  readonly accounts: IntegrationAccount[] = [];

  replaceActive(
    credential: IntegrationCredential,
    accounts: IntegrationAccount[],
  ): Promise<void> {
    this.credentials.push(credential);
    this.accounts.push(...accounts);
    return Promise.resolve();
  }

  revokeActive(): Promise<boolean> {
    return Promise.resolve(false);
  }

  findActiveWithAccessToken(): Promise<IntegrationCredential | null> {
    return Promise.resolve(null);
  }

  findActiveByTenantId(): Promise<IntegrationCredential[]> {
    return Promise.resolve([]);
  }
}

function fakeGateway(
  overrides: Partial<InstagramOAuthGateway> = {},
): InstagramOAuthGateway {
  return {
    isConfigured: () => true,
    buildAuthorizationUrl: (state) =>
      `https://www.instagram.com/oauth/authorize?state=${state}`,
    exchangeCode: jest.fn().mockResolvedValue({
      accessToken: 'short-lived-token',
      appScopedUserId: '111',
      permissions: ['instagram_business_basic'],
    }),
    exchangeForLongLivedToken: jest.fn().mockResolvedValue({
      accessToken: 'long-lived-token',
      expiresInSeconds: 5_184_000,
    }),
    getProfile: jest
      .fn()
      .mockResolvedValue({ userId: '178414', username: 'carlaexpert' }),
    ...overrides,
  };
}

describe('Instagram connection', () => {
  const ids = new UuidV7IdGenerator();
  const tenantId = ids.generate();
  const userId = ids.generate();
  let expert: Expert;
  let stateStore: InMemoryStateStore;
  let experts: InMemoryExpertsRepository;
  let credentials: InMemoryCredentialsRepository;
  const cipher = new IntegrationTokenEncryptionService();

  beforeEach(() => {
    Environment.vars = {
      META_TOKENS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    } as typeof Environment.vars;

    const now = new Date();
    expert = new Expert({
      id: ids.generate(),
      tenantId,
      name: 'Carla Expert',
      email: 'carla@example.com',
      status: ExpertStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    stateStore = new InMemoryStateStore();
    experts = new InMemoryExpertsRepository();
    credentials = new InMemoryCredentialsRepository();
    void experts.create(expert);
  });

  const start = (gateway = fakeGateway()) =>
    new StartInstagramConnectionUseCase(experts, stateStore, gateway, cipher);

  const complete = (gateway = fakeGateway()) =>
    new CompleteInstagramConnectionUseCase(
      stateStore,
      gateway,
      experts,
      credentials,
      cipher,
      ids,
    );

  const startAndGetState = async () => {
    const { authorizationUrl } = await start().execute({
      tenantId,
      userId,
      expertId: expert.id,
    });

    return new URL(authorizationUrl).searchParams.get('state')!;
  };

  const expectDomainError = async (
    promise: Promise<unknown>,
    statusCode: number,
    reason: string,
  ) => {
    const error: unknown = await promise.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ statusCode, reason });
  };

  describe('StartInstagramConnectionUseCase', () => {
    it('issues an unguessable, single-use state bound to tenant, user and expert', async () => {
      const state = await startAndGetState();

      expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(stateStore.states.get(state)).toEqual({
        tenantId,
        userId,
        expertId: expert.id,
      });
    });

    it('hides experts from other tenants', async () => {
      await expectDomainError(
        start().execute({
          tenantId: ids.generate(),
          userId,
          expertId: expert.id,
        }),
        404,
        'EXPERT_NOT_FOUND',
      );
    });

    it('requires an active tenant', async () => {
      await expectDomainError(
        start().execute({ tenantId: null, userId, expertId: expert.id }),
        403,
        'TENANT_REQUIRED',
      );
    });

    it('fails before redirecting when the login is not configured', async () => {
      await expectDomainError(
        start(fakeGateway({ isConfigured: () => false })).execute({
          tenantId,
          userId,
          expertId: expert.id,
        }),
        503,
        'INSTAGRAM_LOGIN_NOT_CONFIGURED',
      );
    });

    it('fails before redirecting when the encryption key is missing', async () => {
      Environment.vars.META_TOKENS_ENCRYPTION_KEY = undefined;

      await expectDomainError(
        start().execute({ tenantId, userId, expertId: expert.id }),
        500,
        'META_TOKENS_ENCRYPTION_KEY_NOT_CONFIGURED',
      );
      expect(stateStore.states.size).toBe(0);
    });
  });

  describe('CompleteInstagramConnectionUseCase', () => {
    it('stores the long-lived token encrypted and marks the expert as connected', async () => {
      const exchangeCode = jest.fn().mockResolvedValue({
        accessToken: 'short-lived-token',
        appScopedUserId: '111',
        permissions: ['instagram_business_basic'],
      });
      const state = await startAndGetState();

      const result = await complete(fakeGateway({ exchangeCode })).execute({
        state,
        code: 'auth-code#_',
      });

      expect(result).toEqual({
        status: 'connected',
        expertId: expert.id,
        username: 'carlaexpert',
      });
      // O sufixo "#_" adicionado pela Meta é removido antes da troca.
      expect(exchangeCode).toHaveBeenCalledWith('auth-code');

      const [credential] = credentials.credentials;
      expect(credential).toMatchObject({
        tenantId,
        expertId: expert.id,
        provider: IntegrationProvider.INSTAGRAM,
        externalUserId: '111',
        status: IntegrationCredentialStatus.ACTIVE,
      });
      // A conta (sem segredo) fica separada da credencial e aponta para ela.
      expect(credentials.accounts).toHaveLength(1);
      expect(credentials.accounts[0]).toMatchObject({
        tenantId,
        expertId: expert.id,
        credentialId: credential.id,
        provider: IntegrationProvider.INSTAGRAM,
        type: IntegrationAccountType.INSTAGRAM_ACCOUNT,
        externalId: '178414',
        displayName: 'carlaexpert',
      });
      expect(credential.accessToken!.encryptedValue).not.toContain(
        'long-lived-token',
      );
      const owner = {
        tenantId,
        expertId: expert.id,
        credentialId: credential.id,
        provider: IntegrationProvider.INSTAGRAM,
        purpose: 'access_token' as const,
      };
      expect(cipher.decrypt(credential.accessToken!, owner)).toBe(
        'long-lived-token',
      );
      // Preso ao registro: não decifra como se fosse de outro expert.
      expect(() =>
        cipher.decrypt(credential.accessToken!, {
          ...owner,
          expertId: 'other-expert',
        }),
      ).toThrow(DomainError);
      expect(credential.tokenExpiresAt!.getTime()).toBeGreaterThan(
        Date.now() + 59 * 24 * 3600 * 1000,
      );
    });

    it('rejects unknown, missing or reused states', async () => {
      await expect(
        complete().execute({ state: 'forged', code: 'x' }),
      ).resolves.toEqual({
        status: 'failed',
        expertId: null,
        reason: 'invalid_state',
      });
      await expect(complete().execute({ code: 'x' })).resolves.toMatchObject({
        reason: 'invalid_state',
      });

      const state = await startAndGetState();
      await complete().execute({ state, code: 'x' });

      await expect(
        complete().execute({ state, code: 'x' }),
      ).resolves.toMatchObject({ reason: 'invalid_state' });
      expect(credentials.credentials).toHaveLength(1);
    });

    it('reports a denied authorization without calling Meta', async () => {
      const exchangeCode = jest.fn();
      const state = await startAndGetState();

      const result = await complete(fakeGateway({ exchangeCode })).execute({
        state,
        error: 'access_denied',
      });

      expect(result).toEqual({
        status: 'failed',
        expertId: expert.id,
        reason: 'denied',
      });
      expect(exchangeCode).not.toHaveBeenCalled();
    });

    it('does not store anything when the token exchange fails', async () => {
      const state = await startAndGetState();
      const gateway = fakeGateway({
        exchangeCode: jest
          .fn()
          .mockRejectedValue(new InstagramOAuthError('Meta respondeu 400')),
      });

      await expect(
        complete(gateway).execute({ state, code: 'x' }),
      ).resolves.toMatchObject({ status: 'failed', reason: 'exchange_failed' });
      expect(credentials.credentials).toHaveLength(0);
    });

    it('refuses to connect an expert that moved to another tenant', async () => {
      const state = await startAndGetState();
      experts.experts.length = 0;

      await expect(
        complete().execute({ state, code: 'x' }),
      ).resolves.toMatchObject({ reason: 'expert_not_found' });
      expect(credentials.credentials).toHaveLength(0);
    });
  });
});
