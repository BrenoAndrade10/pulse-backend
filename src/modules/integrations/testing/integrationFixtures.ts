import { IntegrationAccount } from '../domain/entities/IntegrationAccount';
import type { IntegrationAccountProps } from '../domain/entities/IntegrationAccount';
import { IntegrationCredential } from '../domain/entities/IntegrationCredential';
import type { IntegrationCredentialProps } from '../domain/entities/IntegrationCredential';
import { IntegrationAccountType } from '../domain/enums/IntegrationAccountType';
import { IntegrationCredentialStatus } from '../domain/enums/IntegrationCredentialStatus';
import { IntegrationProvider } from '../domain/enums/IntegrationProvider';

/** Credencial ativa do Instagram para testes. */
export function makeInstagramCredential(
  overrides: Partial<IntegrationCredentialProps> = {},
): IntegrationCredential {
  const now = new Date();

  return new IntegrationCredential({
    id: 'credential-a',
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    provider: IntegrationProvider.INSTAGRAM,
    accessToken: { encryptedValue: 'value', iv: 'iv', authTag: 'tag' },
    tokenExpiresAt: new Date(now.getTime() + 86_400_000),
    scopes: ['instagram_business_basic'],
    status: IntegrationCredentialStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

/** Conta do Instagram conectada para testes. */
export function makeInstagramAccount(
  overrides: Partial<IntegrationAccountProps> = {},
): IntegrationAccount {
  const now = new Date();

  return new IntegrationAccount({
    id: 'account-a',
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    credentialId: 'credential-a',
    provider: IntegrationProvider.INSTAGRAM,
    type: IntegrationAccountType.INSTAGRAM_ACCOUNT,
    externalId: 'ig-user',
    displayName: 'expert',
    metadata: {},
    connectedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}
