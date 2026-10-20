import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { IntegrationProvider } from '../../../integrations/domain/enums/IntegrationProvider';
import { INTEGRATION_CREDENTIALS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import type { IntegrationCredentialsRepository } from '../../../integrations/domain/repositories/IntegrationCredentialsRepository';
import { INTEGRATION_TOKEN_CIPHER } from '../../../integrations/domain/services/IntegrationTokenCipher';
import type { IntegrationTokenCipher } from '../../../integrations/domain/services/IntegrationTokenCipher';

/** Token do Instagram do expert, decifrado só no momento de chamar a Meta. */
@Injectable()
export class InstagramAccessTokens {
  constructor(
    @Inject(INTEGRATION_CREDENTIALS_REPOSITORY)
    private readonly credentialsRepository: IntegrationCredentialsRepository,

    @Inject(INTEGRATION_TOKEN_CIPHER)
    private readonly cipher: IntegrationTokenCipher,
  ) {}

  /** Lança 409 se o expert não tem conexão ativa ou se ela expirou. */
  async forExpert(tenantId: string, expertId: string): Promise<string> {
    const credential =
      await this.credentialsRepository.findActiveWithAccessToken(
        tenantId,
        expertId,
        IntegrationProvider.INSTAGRAM,
      );

    if (!credential?.accessToken) {
      throw new DomainError(409, 'INSTAGRAM_NOT_CONNECTED');
    }
    if (credential.isExpired()) {
      throw new DomainError(409, 'INSTAGRAM_ACCESS_TOKEN_EXPIRED');
    }

    return this.cipher.decrypt(credential.accessToken, {
      tenantId,
      expertId,
      credentialId: credential.id,
      provider: credential.provider,
      purpose: 'access_token',
    });
  }
}
