import { LaunchStatus } from '../enums/LaunchStatus';
import { LaunchType } from '../enums/LaunchType';

export type LaunchProps = {
  id: string;
  tenantId: string;
  expertId: string;
  slug: string;
  type: LaunchType;
  name: string;
  description?: string;
  status: LaunchStatus;
  startsAt?: Date;
  endsAt?: Date;
  timezone: string;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateLaunchProps = {
  expertId?: string;
  slug?: string;
  type?: LaunchType;
  name?: string;
  description?: string | null;
  status?: LaunchStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  timezone?: string;
};

export class Launch {
  constructor(private readonly props: LaunchProps) {}

  update(input: UpdateLaunchProps, updatedBy: string): void {
    if (input.expertId !== undefined) this.props.expertId = input.expertId;
    if (input.slug !== undefined) this.props.slug = input.slug;
    if (input.type !== undefined) this.props.type = input.type;
    if (input.name !== undefined) this.props.name = input.name;
    if (input.description !== undefined) {
      this.props.description = input.description ?? undefined;
    }
    if (input.status !== undefined) this.props.status = input.status;
    if (input.startsAt !== undefined) {
      this.props.startsAt = input.startsAt ?? undefined;
    }
    if (input.endsAt !== undefined) {
      this.props.endsAt = input.endsAt ?? undefined;
    }
    if (input.timezone !== undefined) this.props.timezone = input.timezone;
    this.props.updatedBy = updatedBy;
    this.props.updatedAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get expertId(): string {
    return this.props.expertId;
  }
  get slug(): string {
    return this.props.slug;
  }
  get type(): LaunchType {
    return this.props.type;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get status(): LaunchStatus {
    return this.props.status;
  }
  get startsAt(): Date | undefined {
    return this.props.startsAt;
  }
  get endsAt(): Date | undefined {
    return this.props.endsAt;
  }
  get timezone(): string {
    return this.props.timezone;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  get createdBy(): string | null {
    return this.props.createdBy;
  }
  get updatedBy(): string | null {
    return this.props.updatedBy;
  }
  get deletedBy(): string | null {
    return this.props.deletedBy;
  }
  get version(): number {
    return this.props.version;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
