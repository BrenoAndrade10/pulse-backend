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

  static linkNotFound(): DomainError {
    return new DomainError(404, 'LINK_NOT_FOUND');
  }

  static forbidden(): DomainError {
    return new DomainError(403, 'FORBIDDEN');
  }

  static validationFailed(data: object | null = null): DomainError {
    return new DomainError(400, 'VALIDATION_FAILED', data);
  }

  static linkDestinationInvalid(): DomainError {
    return new DomainError(400, 'LINK_DESTINATION_INVALID');
  }

  static linkDestinationInsecure(): DomainError {
    return new DomainError(400, 'LINK_DESTINATION_INSECURE');
  }

  static linkDestinationBlocked(): DomainError {
    return new DomainError(400, 'LINK_DESTINATION_BLOCKED');
  }

  static linkDestinationTooLong(): DomainError {
    return new DomainError(400, 'LINK_DESTINATION_TOO_LONG');
  }

  static linkCodeGenerationFailed(): DomainError {
    return new DomainError(503, 'LINK_CODE_GENERATION_FAILED');
  }
}
