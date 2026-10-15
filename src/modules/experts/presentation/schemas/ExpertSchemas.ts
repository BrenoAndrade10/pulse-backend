import * as yup from 'yup';
import { ExpertStatus } from '../../domain/enums/ExpertStatus';

const name = yup.string().trim().min(2).max(180);
const email = yup.string().trim().lowercase().email().max(255);

export const createExpertSchema = yup
  .object({
    name: name.required('O nome é obrigatório.'),
    commercialName: name.optional(),
    email: email.required('O e-mail é obrigatório.'),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.');

export const updateExpertSchema = yup
  .object({
    name: name.optional(),
    commercialName: name.nullable().optional(),
    email: email.optional(),
    status: yup
      .mixed<ExpertStatus>()
      .oneOf(Object.values(ExpertStatus), 'Informe um status válido.')
      .optional(),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.')
  .test(
    'at-least-one-field',
    'Informe ao menos um campo para atualização.',
    (value) => value != null && Object.keys(value).length > 0,
  );

export type CreateExpertSchemaInput = yup.InferType<typeof createExpertSchema>;
export type UpdateExpertSchemaInput = yup.InferType<typeof updateExpertSchema>;
