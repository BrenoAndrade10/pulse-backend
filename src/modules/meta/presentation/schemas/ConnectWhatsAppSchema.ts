import * as yup from 'yup';

const id = yup
  .string()
  .matches(/^\d{1,32}$/)
  .required();

export const connectWhatsAppSchema = yup
  .object({
    code: yup.string().max(2048).required(),
    wabaId: id,
    phoneNumberId: id,
  })
  .noUnknown(true)
  .required();
