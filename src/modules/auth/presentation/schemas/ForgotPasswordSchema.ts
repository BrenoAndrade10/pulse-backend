import * as yup from 'yup';

export const forgotPasswordSchema = yup
  .object({
    email: yup
      .string()
      .trim()
      .lowercase()
      .email('Informe um e-mail válido.')
      .max(254)
      .required('O e-mail é obrigatório.'),
  })
  .noUnknown(true, 'Informe apenas campos permitidos.')
  .required();
