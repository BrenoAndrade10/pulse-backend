import * as yup from 'yup';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import { LaunchStatus } from '../../domain/enums/LaunchStatus';
import { LaunchType } from '../../domain/enums/LaunchType';

const uuidV7 = yup
  .string()
  .trim()
  .typeError('Informe um identificador válido.')
  .test('uuid-v7', 'Informe um identificador válido.', (value) =>
    value === undefined ? true : isUuidV7(value),
  );
const dateTime = yup.string().datetime({
  allowOffset: true,
  message: 'Informe uma data ISO 8601 válida.',
});
const slug = yup
  .string()
  .trim()
  .lowercase()
  .min(2, 'O slug deve ter pelo menos 2 caracteres.')
  .max(180, 'O slug deve ter no máximo 180 caracteres.')
  .matches(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use apenas letras minúsculas, números e hífens no slug.',
  );
const timezone = yup
  .string()
  .trim()
  .max(100, 'O fuso horário deve ter no máximo 100 caracteres.')
  .test('timezone', 'Informe um timezone IANA válido.', (value) => {
    if (value === undefined) return true;
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  });

export const createLaunchSchema = yup
  .object({
    expertId: uuidV7.required('Informe o expert.'),
    slug: slug.required('Informe o slug.'),
    type: yup
      .mixed<LaunchType>()
      .oneOf(Object.values(LaunchType), 'Informe um tipo válido.')
      .optional(),
    name: yup
      .string()
      .trim()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(180, 'O nome deve ter no máximo 180 caracteres.')
      .required('Informe o nome.'),
    description: yup
      .string()
      .trim()
      .max(10_000, 'A descrição deve ter no máximo 10.000 caracteres.')
      .nullable()
      .optional(),
    status: yup
      .mixed<LaunchStatus>()
      .oneOf(Object.values(LaunchStatus), 'Informe um status válido.')
      .optional(),
    startsAt: dateTime.nullable().optional(),
    endsAt: dateTime.nullable().optional(),
    timezone: timezone.optional(),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.');

export const updateLaunchSchema = yup
  .object({
    expertId: uuidV7.optional(),
    slug: slug.optional(),
    type: yup
      .mixed<LaunchType>()
      .oneOf(Object.values(LaunchType), 'Informe um tipo válido.')
      .optional(),
    name: yup
      .string()
      .trim()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(180, 'O nome deve ter no máximo 180 caracteres.')
      .optional(),
    description: yup
      .string()
      .trim()
      .max(10_000, 'A descrição deve ter no máximo 10.000 caracteres.')
      .nullable()
      .optional(),
    status: yup
      .mixed<LaunchStatus>()
      .oneOf(Object.values(LaunchStatus), 'Informe um status válido.')
      .optional(),
    startsAt: dateTime.nullable().optional(),
    endsAt: dateTime.nullable().optional(),
    timezone: timezone.optional(),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.')
  .test(
    'at-least-one-field',
    'Informe ao menos um campo para atualização.',
    (value) => value != null && Object.keys(value).length > 0,
  );

export type CreateLaunchSchemaInput = yup.InferType<typeof createLaunchSchema>;
export type UpdateLaunchSchemaInput = yup.InferType<typeof updateLaunchSchema>;
