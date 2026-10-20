import type { IntegrationCredentialStatus } from '../enums/IntegrationCredentialStatus';
import type { IntegrationProvider } from '../enums/IntegrationProvider';
import type { EncryptedToken } from '../types/EncryptedToken';

export type IntegrationCredentialProps = {
  id: string;
  tenantId: string;
  expertId: string;
  provider: IntegrationProvider;
  /** Id do usuário que autorizou, no provedor (ex.: app-scoped user id da Meta). */
  externalUserId?: string;
  /**
   * Só vem preenchido nas consultas que precisam chamar o provedor, e nunca
   * em credenciais revogadas (o token é apagado ao reconectar ou desconectar).
   */
  accessToken?: EncryptedToken;
  refreshToken?: EncryptedToken;
  tokenExpiresAt?: Date;
  scopes: string[];
  status: IntegrationCredentialStatus;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export class IntegrationCredential {
  constructor(private readonly props: IntegrationCredentialProps) {}

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get expertId(): string {
    return this.props.expertId;
  }

  get provider(): IntegrationProvider {
    return this.props.provider;
  }

  get externalUserId(): string | undefined {
    return this.props.externalUserId;
  }

  get accessToken(): EncryptedToken | undefined {
    return this.props.accessToken;
  }

  get refreshToken(): EncryptedToken | undefined {
    return this.props.refreshToken;
  }

  get tokenExpiresAt(): Date | undefined {
    return this.props.tokenExpiresAt;
  }

  get scopes(): string[] {
    return this.props.scopes;
  }

  get status(): IntegrationCredentialStatus {
    return this.props.status;
  }

  get revokedAt(): Date | undefined {
    return this.props.revokedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isExpired(now = new Date()): boolean {
    return (
      this.props.tokenExpiresAt !== undefined &&
      this.props.tokenExpiresAt.getTime() <= now.getTime()
    );
  }
}
