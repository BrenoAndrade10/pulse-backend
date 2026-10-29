import * as yup from 'yup';

const challengeToken = yup
  .string()
  .matches(/^[A-Za-z0-9_-]{43}$/)
  .required();
const code = yup
  .string()
  .matches(/^\d{6}$/)
  .required();

export const emailChallengeVerifySchema = yup
  .object({
    challengeToken,
    code,
    trustDevice: yup.boolean().required(),
  })
  .required()
  .noUnknown();

export const emailChallengeResendSchema = yup
  .object({ challengeToken })
  .required()
  .noUnknown();

export const challengeVerifySchema = yup
  .object({
    challengeToken,
    code: yup
      .string()
      .matches(/^\d{6}$/)
      .optional(),
    recoveryCode: yup.string().max(32).optional(),
    trustDevice: yup.boolean().required(),
  })
  .test('one-code', 'Informe exatamente um código.', (value) =>
    Boolean(value && Boolean(value.code) !== Boolean(value.recoveryCode)),
  )
  .required()
  .noUnknown();
