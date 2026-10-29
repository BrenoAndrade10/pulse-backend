import * as yup from 'yup';

export const passwordSchema = yup
  .string()
  .required('A senha é obrigatória.')
  .min(6, 'A senha deve conter pelo menos 6 caracteres.')
  .max(256, 'A senha deve conter no máximo 256 caracteres.');
