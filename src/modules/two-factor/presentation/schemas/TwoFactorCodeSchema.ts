import * as yup from 'yup';

export const twoFactorCodeSchema = yup
  .object({
    code: yup
      .string()
      .matches(/^\d{6}$/, 'Informe um código de 6 dígitos.')
      .required('O código é obrigatório.'),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.');
