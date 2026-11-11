import { ValidationError, type ValidateOptions } from 'yup';
import { DomainError } from '../../errors/DomainError';

type ValidatableSchema<T> = {
  validate(value: unknown, options: object): Promise<T>;
};

export async function validateWith<T>(
  schema: ValidatableSchema<T>,
  value: unknown,
  options: ValidateOptions = {},
): Promise<T> {
  try {
    return await schema.validate(value, {
      abortEarly: false,
      stripUnknown: false,
      ...options,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      throw DomainError.validationFailed({ errors: error.errors });
    }
    throw error;
  }
}
