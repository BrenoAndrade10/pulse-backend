import type { PipeTransform } from '@nestjs/common';
import type { ValidateOptions } from 'yup';
import { validateWith } from '../validators/validateWith';

type ValidatableSchema<T> = {
  validate(value: unknown, options: object): Promise<T>;
};

export class YupValidationPipe<T = unknown> implements PipeTransform {
  constructor(
    private readonly schema: ValidatableSchema<T>,
    private readonly options?: ValidateOptions,
  ) {}

  transform(value: unknown): Promise<T> {
    return validateWith(this.schema, value, this.options);
  }
}
