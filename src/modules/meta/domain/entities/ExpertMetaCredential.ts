export type EncryptedToken = {
  encryptedValue: string;
  iv: string;
  authTag: string;
};

export type ExpertMetaCredentialProps = {
  id: string;
  tenantId: string;
  expertId: string;
  metaUserId?: string;
  instagramUserId?: string;
  instagramUsername?: string;
  pageId?: string;
  pageName?: string;
  accessToken: EncryptedToken;
  refreshToken?: EncryptedToken;
  tokenExpiresAt?: Date;
  scopes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class ExpertMetaCredential {
  constructor(private readonly props: ExpertMetaCredentialProps) {}

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get expertId(): string {
    return this.props.expertId;
  }

  get metaUserId(): string | undefined {
    return this.props.metaUserId;
  }

  get instagramUserId(): string | undefined {
    return this.props.instagramUserId;
  }

  get instagramUsername(): string | undefined {
    return this.props.instagramUsername;
  }

  get pageId(): string | undefined {
    return this.props.pageId;
  }

  get pageName(): string | undefined {
    return this.props.pageName;
  }

  get accessToken(): EncryptedToken {
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

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
