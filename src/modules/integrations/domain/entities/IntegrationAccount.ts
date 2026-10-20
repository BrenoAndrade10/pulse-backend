import type { IntegrationAccountType } from '../enums/IntegrationAccountType';
import type { IntegrationProvider } from '../enums/IntegrationProvider';

export type IntegrationAccountProps = {
  id: string;
  tenantId: string;
  expertId: string;
  credentialId: string;
  provider: IntegrationProvider;
  type: IntegrationAccountType;
  /** Id do ativo no provedor (ex.: id da conta do Instagram, act_123). */
  externalId: string;
  displayName?: string;
  /** Campos específicos de cada provedor. Nunca guarde segredos aqui. */
  metadata: Record<string, unknown>;
  connectedAt: Date;
  disconnectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export class IntegrationAccount {
  constructor(private readonly props: IntegrationAccountProps) {}

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get expertId(): string {
    return this.props.expertId;
  }

  get credentialId(): string {
    return this.props.credentialId;
  }

  get provider(): IntegrationProvider {
    return this.props.provider;
  }

  get type(): IntegrationAccountType {
    return this.props.type;
  }

  get externalId(): string {
    return this.props.externalId;
  }

  get displayName(): string | undefined {
    return this.props.displayName;
  }

  get metadata(): Record<string, unknown> {
    return this.props.metadata;
  }

  get connectedAt(): Date {
    return this.props.connectedAt;
  }

  get disconnectedAt(): Date | undefined {
    return this.props.disconnectedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
