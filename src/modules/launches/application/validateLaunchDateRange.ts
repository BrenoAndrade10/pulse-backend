import { DomainError } from '../../../shared/errors/DomainError';

export function validateLaunchDateRange(startsAt?: Date, endsAt?: Date): void {
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    throw DomainError.validationFailed({
      errors: ['A data final não pode ser anterior à data inicial.'],
    });
  }
}
