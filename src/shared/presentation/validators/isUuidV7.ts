import { validate, version } from 'uuid';

export function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && validate(value) && version(value) === 7;
}
