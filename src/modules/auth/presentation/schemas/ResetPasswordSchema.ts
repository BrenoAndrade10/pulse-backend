import * as yup from 'yup';
import { passwordSchema } from '../../../users/presentation/schemas/PasswordSchema';

export const resetPasswordSchema = yup
  .object({
    token: yup
      .string()
      .matches(/^[A-Za-z0-9_-]{43}$/, 'Token inválido.')
      .required('O token é obrigatório.'),
    password: passwordSchema,
  })
  .noUnknown(true, 'Informe apenas campos permitidos.')
  .required();
