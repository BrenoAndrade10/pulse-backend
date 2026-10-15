import { ExpertStatus } from '../enums/ExpertStatus';

export type ExpertProps = {
  id: string;
  tenantId: string;
  name: string;
  commercialName?: string;
  email: string;
  status: ExpertStatus;
  createdAt: Date;
  updatedAt: Date;
};

export class Expert {
  constructor(private readonly props: ExpertProps) {}

  update(input: {
    name?: string;
    commercialName?: string | null;
    email?: string;
    status?: ExpertStatus;
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.commercialName !== undefined) {
      this.props.commercialName = input.commercialName ?? undefined;
    }
    if (input.email !== undefined) this.props.email = input.email;
    if (input.status !== undefined) this.props.status = input.status;
    this.props.updatedAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get commercialName(): string | undefined {
    return this.props.commercialName;
  }

  get email(): string {
    return this.props.email;
  }

  get status(): ExpertStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
