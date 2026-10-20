import { AppError } from './AppError';

export class DomainError extends AppError {
  constructor(
    public readonly statusCode: number,
    public readonly reason: string | null,
    public readonly data: object | null = null,
  ) {
    super(reason ?? 'DOMAIN_ERROR');
  }

  static userNotFound(): DomainError {
    return new DomainError(404, 'USER_NOT_FOUND');
  }

  static tenantNotFound(): DomainError {
    return new DomainError(404, 'TENANT_NOT_FOUND');
  }

  static expertNotFound(): DomainError {
    return new DomainError(404, 'EXPERT_NOT_FOUND');
  }

  static launchNotFound(): DomainError {
    return new DomainError(404, 'LAUNCH_NOT_FOUND');
  }

  static forbidden(): DomainError {
    return new DomainError(403, 'FORBIDDEN');
  }

  static validationFailed(data: object | null = null): DomainError {
    return new DomainError(400, 'VALIDATION_FAILED', data);
  }
}
