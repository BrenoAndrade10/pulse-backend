import { Inject, Injectable, Logger } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { IntegrationAccount } from '../../../integrations/domain/entities/IntegrationAccount';
import { IntegrationCredential } from '../../../integrations/domain/entities/IntegrationCredential';
import { IntegrationAccountType } from '../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationCredentialStatus } from '../../../integrations/domain/enums/IntegrationCredentialStatus';
import { IntegrationProvider } from '../../../integrations/domain/enums/IntegrationProvider';
import { INTEGRATION_ACCOUNTS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { IntegrationAccountsRepository } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import { INTEGRATION_CREDENTIALS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import type { IntegrationCredentialsRepository } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import { OAUTH_STATE_STORE } from '../../domain/repositories/OAuthStateStore';
import type { OAuthStateStore } from '../../domain/repositories/OAuthStateStore';
import {
  INSTAGRAM_OAUTH_GATEWAY,
  InstagramOAuthError,
} from '../../domain/services/InstagramOAuthGateway';
import type { InstagramOAuthGateway } from '../../domain/services/InstagramOAuthGateway';
import { INTEGRATION_TOKEN_CIPHER } from '../../../integrations/domain/services/IntegrationTokenCipher';
import type { IntegrationTokenCipher } from '../../../integrations/domain/services/IntegrationTokenCipher';

export type CompleteInstagramConnectionInput = {
  state?: string;
  code?: string;
  error?: string;
};

/** Motivos expostos ao frontend na URL de retorno (nunca detalhes internos). */
export type InstagramConnectionFailure =
  | 'invalid_state'
  | 'denied'
  | 'expert_not_found'
  | 'exchange_failed'
  | 'missing_permissions'
  | 'no_instagram_account'
  | 'multiple_instagram_accounts'
  | 'account_already_connected';

export type CompleteInstagramConnectionOutput =
  | { status: 'connected'; expertId: string; username: string }
  | {
      status: 'failed';
      expertId: string | null;
      reason: InstagramConnectionFailure;
    };

@Injectable()
export class CompleteInstagramConnectionUseCase {
  private readonly logger = new Logger(CompleteInstagramConnectionUseCase.name);

  constructor(
    @Inject(OAUTH_STATE_STORE)
    private readonly stateStore: OAuthStateStore,

    @Inject(INSTAGRAM_OAUTH_GATEWAY)
    private readonly instagram: InstagramOAuthGateway,

    @Inject(EXPERTS_REPOSITORY)
    private readonly expertsRepository: ExpertsRepository,

    @Inject(INTEGRATION_CREDENTIALS_REPOSITORY)
    private readonly credentialsRepository: IntegrationCredentialsRepository,

    @Inject(INTEGRATION_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: IntegrationAccountsRepository,

    @Inject(INTEGRATION_TOKEN_CIPHER)
    private readonly cipher: IntegrationTokenCipher,

    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(
    input: CompleteInstagramConnectionInput,
  ): Promise<CompleteInstagramConnectionOutput> {
    // Sem `state` válido não há como saber quem iniciou: protege contra CSRF
    // e contra reuso (o state é apagado na leitura).
    const origin = input.state
      ? await this.stateStore.consume(input.state)
      : null;

    if (!origin) {
      return { status: 'failed', expertId: null, reason: 'invalid_state' };
    }

    const fail = (reason: InstagramConnectionFailure) => ({
      status: 'failed' as const,
      expertId: origin.expertId,
      reason,
    });

    if (input.error || !input.code) {
      return fail('denied');
    }

    // O expert pode ter sido removido ou trocado de empresa no meio do fluxo.
    const expert = await this.expertsRepository.findById(origin.expertId);

    if (!expert || expert.tenantId !== origin.tenantId) {
      return fail('expert_not_found');
    }

    try {
      // A Meta acrescenta "#_" ao final do código, que não faz parte dele.
      const code = input.code.replace(/#_$/, '');
      const exchanged = await this.instagram.exchangeCode(code);
      const userToken =
        exchanged.expiresInSeconds >= 30 * 24 * 60 * 60
          ? exchanged
          : await this.instagram.exchangeForLongLivedToken(
              exchanged.accessToken,
            );
      const account = await this.instagram.getAuthorizedAccount(
        userToken.accessToken,
      );
      const connectedAccounts =
        await this.accountsRepository.findConnectedByExternalId(
          IntegrationProvider.INSTAGRAM,
          IntegrationAccountType.INSTAGRAM_ACCOUNT,
          account.userId,
        );

      if (
        connectedAccounts.some(
          (connected) =>
            connected.tenantId !== origin.tenantId ||
            connected.expertId !== origin.expertId,
        )
      ) {
        return fail('account_already_connected');
      }

      const now = new Date();
      const owner = {
        tenantId: origin.tenantId,
        expertId: origin.expertId,
        provider: IntegrationProvider.INSTAGRAM,
      };
      const credentialId = this.idGenerator.generate();

      await this.credentialsRepository.replaceActive(
        new IntegrationCredential({
          ...owner,
          id: credentialId,
          externalUserId: account.authorizingUserId,
          accessToken: this.cipher.encrypt(account.accessToken, {
            ...owner,
            credentialId,
            purpose: 'access_token',
          }),
          tokenExpiresAt: new Date(
            now.getTime() + userToken.expiresInSeconds * 1000,
          ),
          scopes: account.permissions,
          status: IntegrationCredentialStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        }),
        [
          new IntegrationAccount({
            ...owner,
            id: this.idGenerator.generate(),
            credentialId,
            type: IntegrationAccountType.INSTAGRAM_ACCOUNT,
            externalId: account.userId,
            displayName: account.username,
            metadata: {
              pageId: account.pageId,
              pageName: account.pageName,
              pageTasks: account.pageTasks,
              authFlow: 'facebook_login_for_business',
            },
            connectedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        ],
      );

      return {
        status: 'connected',
        expertId: origin.expertId,
        username: account.username,
      };
    } catch (error) {
      if (error instanceof InstagramOAuthError) {
        this.logger.warn(
          `Falha ao conectar Instagram do expert ${origin.expertId}: ${error.message}`,
        );

        return fail(error.reason);
      }

      if (
        error instanceof DomainError &&
        error.reason === 'INSTAGRAM_ACCOUNT_ALREADY_CONNECTED'
      ) {
        return fail('account_already_connected');
      }

      throw error;
    }
  }
}
