import * as yup from 'yup';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkPurpose } from '../../domain/enums/LinkPurpose';
import { LinkStatus } from '../../domain/enums/LinkStatus';

const uuidV7 = yup
  .string()
  .trim()
  .typeError('Informe um identificador válido.')
  .test('uuid-v7', 'Informe um identificador válido.', (value) =>
    value == null ? true : isUuidV7(value),
  );

export const linkIdSchema = uuidV7.required('Informe um id válido.');

const utmValue = yup
  .string()
  .trim()
  .max(120, 'O parâmetro UTM deve ter no máximo 120 caracteres.')
  .nullable()
  .optional();

export const createLinkSchema = yup
  .object({
    name: yup
      .string()
      .trim()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(120, 'O nome deve ter no máximo 120 caracteres.')
      .required('Informe o nome.'),
    destinationUrl: yup
      .string()
      .trim()
      .max(2048, 'O destino deve ter no máximo 2048 caracteres.')
      .required('Informe o destino.'),
    channel: yup
      .mixed<LinkChannel>()
      .oneOf(Object.values(LinkChannel), 'Informe um canal válido.')
      .default(LinkChannel.OTHER),
    purpose: yup
      .mixed<LinkPurpose>()
      .oneOf(Object.values(LinkPurpose), 'Informe uma finalidade válida.')
      .default(LinkPurpose.OTHER),
    placement: yup.string().trim().max(64).nullable().optional(),
    campaign: yup.string().trim().max(120).nullable().optional(),
    utm: yup
      .object({
        source: utmValue,
        medium: utmValue,
        campaign: utmValue,
        content: utmValue,
        term: utmValue,
      })
      .noUnknown(true, 'Informe apenas campos UTM permitidos.')
      .optional()
      .default(undefined),
    expertId: uuidV7.nullable().optional(),
    launchId: uuidV7.nullable().optional(),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.')
  .test(
    'launch-requires-expert',
    'Informe o expert quando informar o lançamento.',
    (value) => !value?.launchId || value.expertId != null,
  );

export type CreateLinkInput = yup.InferType<typeof createLinkSchema>;

export const updateLinkSchema = yup
  .object({
    name: yup
      .string()
      .trim()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(120, 'O nome deve ter no máximo 120 caracteres.')
      .optional(),
    destinationUrl: yup
      .string()
      .trim()
      .max(2048, 'O destino deve ter no máximo 2048 caracteres.')
      .optional(),
    status: yup
      .mixed<LinkStatus>()
      .oneOf(Object.values(LinkStatus), 'Informe um status válido.')
      .optional(),
    purpose: yup
      .mixed<LinkPurpose>()
      .oneOf(Object.values(LinkPurpose), 'Informe uma finalidade válida.')
      .optional(),
    channel: yup
      .mixed<LinkChannel>()
      .oneOf(Object.values(LinkChannel), 'Informe um canal válido.')
      .optional(),
    placement: yup.string().trim().max(64).nullable().optional(),
    campaign: yup.string().trim().max(120).nullable().optional(),
    utm: yup
      .object({
        source: utmValue,
        medium: utmValue,
        campaign: utmValue,
        content: utmValue,
        term: utmValue,
      })
      .noUnknown(true, 'Informe apenas campos UTM permitidos.')
      .optional()
      .default(undefined),
    expertId: uuidV7.nullable().optional(),
    launchId: uuidV7.nullable().optional(),
    regenerateUtm: yup.boolean().default(false),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.')
  .test(
    'at-least-one-field',
    'Informe ao menos um campo para atualização.',
    (value) =>
      value != null &&
      Object.entries(value).some(
        ([key, fieldValue]) => key !== 'regenerateUtm' || fieldValue === true,
      ),
  );

export type UpdateLinkInput = yup.InferType<typeof updateLinkSchema>;

export const listLinksQuerySchema = yup
  .object({
    expertId: uuidV7.optional(),
    launchId: uuidV7.optional(),
    channel: yup
      .mixed<LinkChannel>()
      .oneOf(Object.values(LinkChannel), 'Informe um canal válido.')
      .optional(),
    status: yup
      .mixed<LinkStatus>()
      .oneOf(Object.values(LinkStatus), 'Informe um status válido.')
      .optional(),
    search: yup
      .string()
      .trim()
      .max(120, 'A busca deve ter no máximo 120 caracteres.')
      .optional(),
    limit: yup
      .number()
      .transform((_value: unknown, originalValue: unknown) =>
        originalValue === '' || originalValue === undefined
          ? undefined
          : Number(originalValue),
      )
      .typeError('Informe um limite válido.')
      .integer('O limite deve ser um número inteiro.')
      .min(1, 'O limite deve ser no mínimo 1.')
      .max(100, 'O limite deve ser no máximo 100.')
      .default(20),
    cursor: yup
      .string()
      .trim()
      .max(200, 'O cursor deve ter no máximo 200 caracteres.')
      .optional(),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.');

export type ListLinksQuery = yup.InferType<typeof listLinksQuerySchema>;
