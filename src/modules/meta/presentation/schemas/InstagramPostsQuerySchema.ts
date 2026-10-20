import * as yup from 'yup';

export const instagramPostsQuerySchema = yup
  .object({
    limit: yup
      .number()
      .integer('O limite deve ser um número inteiro.')
      .min(1, 'O limite mínimo é 1.')
      .max(100, 'O limite máximo é 100.')
      .optional(),
    after: yup.string().trim().max(2048).optional(),
  })
  .required()
  .noUnknown(true, 'Informe apenas parâmetros permitidos.');

export type InstagramPostsQuery = yup.InferType<
  typeof instagramPostsQuerySchema
>;
