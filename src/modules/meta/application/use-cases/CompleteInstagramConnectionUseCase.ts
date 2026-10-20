import { Inject, Injectable, Logger } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { IntegrationAccount } from '../../../integrations/domain/entities/IntegrationAccount';
import { IntegrationCredential } from '../../../integrations/domain/entities/IntegrationCredential';
import { IntegrationAccountType } from '../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationCredentialStatus } from '../../../integrations/domain/enums/IntegrationCredentialStatus';
import { IntegrationProvider } from '../../../integrations/domain/enums/IntegrationProvider';
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
  'invalid_state' | 'denied' | 'expert_not_found' | 'exchange_failed';

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
      const shortLived = await this.instagram.exchangeCode(code);
      const longLived = await this.instagram.exchangeForLongLivedToken(
        shortLived.accessToken,
      );
      const profile = await this.instagram.getProfile(longLived.accessToken);
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
          externalUserId: shortLived.appScopedUserId,
          accessToken: this.cipher.encrypt(longLived.accessToken, {
            ...owner,
            credentialId,
            purpose: 'access_token',
          }),
          tokenExpiresAt: new Date(
            now.getTime() + longLived.expiresInSeconds * 1000,
          ),
          scopes: shortLived.permissions,
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
            externalId: profile.userId,
            displayName: profile.username,
            metadata: {},
            connectedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        ],
      );

      return {
        status: 'connected',
        expertId: origin.expertId,
        username: profile.username,
      };
    } catch (error) {
      if (error instanceof InstagramOAuthError) {
        this.logger.warn(
          `Falha ao conectar Instagram do expert ${origin.expertId}: ${error.message}`,
        );

        return fail('exchange_failed');
      }

      throw error;
    }
  }
}
