import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DomainError } from '../../../../shared/errors/DomainError';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { OAUTH_STATE_STORE } from '../../domain/repositories/OAuthStateStore';
import type { OAuthStateStore } from '../../domain/repositories/OAuthStateStore';
import { INSTAGRAM_OAUTH_GATEWAY } from '../../domain/services/InstagramOAuthGateway';
import type { InstagramOAuthGateway } from '../../domain/services/InstagramOAuthGateway';
import { META_TOKEN_CIPHER } from '../../domain/services/MetaTokenCipher';
import type { MetaTokenCipher } from '../../domain/services/MetaTokenCipher';

/** Tempo para o usuário concluir o login no Instagram. */
export const OAUTH_STATE_TTL_SECONDS = 600;

export type StartInstagramConnectionInput = {
  tenantId: string | null;
  userId: string;
  expertId: string;
};

@Injectable()
export class StartInstagramConnectionUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly expertsRepository: ExpertsRepository,

    @Inject(OAUTH_STATE_STORE)
    private readonly stateStore: OAuthStateStore,

    @Inject(INSTAGRAM_OAUTH_GATEWAY)
    private readonly instagram: InstagramOAuthGateway,

    @Inject(META_TOKEN_CIPHER)
    private readonly cipher: MetaTokenCipher,
  ) {}

  async execute(
    input: StartInstagramConnectionInput,
  ): Promise<{ authorizationUrl: string }> {
    // Falha aqui, antes de mandar o usuário à Meta, e não só no callback.
    if (!this.instagram.isConfigured()) {
      throw new DomainError(503, 'INSTAGRAM_LOGIN_NOT_CONFIGURED');
    }

    this.cipher.assertConfigured();

    if (!input.tenantId) {
      throw new DomainError(403, 'TENANT_REQUIRED');
    }

    const expert = await this.expertsRepository.findById(input.expertId);

    // Expert de outra empresa responde como inexistente.
    if (!expert || expert.tenantId !== input.tenantId) {
      throw new DomainError(404, 'EXPERT_NOT_FOUND');
    }

    const state = randomBytes(32).toString('base64url');

    await this.stateStore.save(
      state,
      {
        tenantId: input.tenantId,
        userId: input.userId,
        expertId: expert.id,
      },
      OAUTH_STATE_TTL_SECONDS,
    );

    return { authorizationUrl: this.instagram.buildAuthorizationUrl(state) };
  }
}
