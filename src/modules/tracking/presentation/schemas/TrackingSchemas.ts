import * as yup from 'yup';
import { MAX_PAGE_URL_LENGTH } from '../../domain/services/pageUrl';

export const startTrackingSetupSchema = yup
  .object({
    url: yup
      .string()
      .trim()
      .max(MAX_PAGE_URL_LENGTH, 'O link da página é longo demais.')
      .required('Informe o link da página.'),
  })
  .noUnknown('Campo não permitido.');

export type StartTrackingSetupSchemaInput = yup.InferType<
  typeof startTrackingSetupSchema
>;
