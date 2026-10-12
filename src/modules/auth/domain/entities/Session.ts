export type SessionProps = {
  id: string;
  userId: string;
  tenantId: string | null;
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  rotatedAt: Date | null;
  ip: string | null;
  userAgent: string | null;
  /** true: cookie persistente ("lembrar de mim"); false: cookie de sessão do navegador. */
  rememberMe: boolean;
  createdAt: Date;
  expiresAt: Date;
};

export class Session {
  constructor(private readonly props: SessionProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get tenantId(): string | null {
    return this.props.tenantId;
  }

  get refreshTokenHash(): string {
    return this.props.refreshTokenHash;
  }

  get previousRefreshTokenHash(): string | null {
    return this.props.previousRefreshTokenHash;
  }

  get rotatedAt(): Date | null {
    return this.props.rotatedAt;
  }

  get ip(): string | null {
    return this.props.ip;
  }

  get userAgent(): string | null {
    return this.props.userAgent;
  }

  get rememberMe(): boolean {
    return this.props.rememberMe;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  wasRotatedWithin(now: Date, seconds: number): boolean {
    if (!this.props.rotatedAt) {
      return false;
    }

    return now.getTime() - this.props.rotatedAt.getTime() <= seconds * 1000;
  }

  remainingTtlSeconds(now: Date, idleTtlSeconds: number): number {
    const secondsUntilExpiration = Math.floor(
      (this.props.expiresAt.getTime() - now.getTime()) / 1000,
    );

    return Math.max(1, Math.min(idleTtlSeconds, secondsUntilExpiration));
  }
}
