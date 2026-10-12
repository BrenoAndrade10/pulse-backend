import { UserRole } from '../../../users/domain/enums/UserRole';

export type TenantUserProps = {
  id: string;
  tenantId: string;
  userId: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

export class TenantUser {
  constructor(private readonly props: TenantUserProps) {}

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
