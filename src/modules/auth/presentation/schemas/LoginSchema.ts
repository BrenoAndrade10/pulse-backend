import * as yup from 'yup';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';

export const loginSchema = yup
  .object({
    email: yup
      .string()
      .trim()
      .lowercase()
      .email('Informe um e-mail válido.')
      .max(255)
      .required('O e-mail é obrigatório.'),
    // Limite alto o bastante para senhas fortes e baixo o bastante para não
    // virar vetor de DoS no argon2.
    password: yup.string().max(256).required('A senha é obrigatória.'),
    rememberMe: yup.boolean().default(false),
    tenantId: yup
      .string()
      .trim()
      .test('uuid-v7', 'Informe um tenantId válido.', (value) =>
        value === undefined ? true : isUuidV7(value),
      )
      .optional(),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.');

export type LoginSchemaInput = yup.InferType<typeof loginSchema>;
