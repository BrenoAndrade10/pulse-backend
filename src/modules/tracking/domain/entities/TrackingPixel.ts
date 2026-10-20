export type TrackingPixelProps = {
  id: string;
  tenantId: string;
  expertId: string;
  /** Chave pública que vai no script do site; não é segredo. */
  publicKey: string;
  /** Domínios que podem enviar eventos (vale também para subdomínios). */
  allowedDomains: string[];
  /** Atualizado pelo coletor a cada evento recebido. */
  lastEventAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Pixel de rastreamento de um expert: um por expert. */
export class TrackingPixel {
  constructor(private readonly props: TrackingPixelProps) {}

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get expertId(): string {
    return this.props.expertId;
  }

  get publicKey(): string {
    return this.props.publicKey;
  }

  get allowedDomains(): string[] {
    return this.props.allowedDomains;
  }

  get lastEventAt(): Date | undefined {
    return this.props.lastEventAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  allowsDomain(hostname: string): boolean {
    return this.props.allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  }
}
