import * as yup from 'yup';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';

export const startInstagramConnectionSchema = yup
  .object({
    expertId: yup
      .string()
      .trim()
      .required('Informe o expert.')
      .test('uuid-v7', 'Informe um expertId válido.', (value) =>
        isUuidV7(value),
      ),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.');
