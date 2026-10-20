import * as yup from 'yup';
import {
  MAX_BUTTON_LABEL_LENGTH,
  MAX_BUTTON_MESSAGE_LENGTH,
  MAX_BUTTON_URL_LENGTH,
  MAX_COMMENT_REPLY_LENGTH,
  MAX_KEYWORD_LENGTH,
  MAX_KEYWORDS,
  MAX_REPLY_MESSAGE_LENGTH,
} from '../../domain/services/commentKeywords';

const isHttpsUrl = (value: string | undefined) => {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/** Id de mídia do Instagram: só dígitos. */
export const isInstagramMediaId = (value: string): boolean =>
  /^\d{1,32}$/.test(value);

export const saveCommentAutomationSchema = yup
  .object({
    keywords: yup
      .array(
        yup
          .string()
          .trim()
          .min(1, 'Palavra-chave vazia.')
          .max(
            MAX_KEYWORD_LENGTH,
            `Cada palavra-chave deve ter no máximo ${MAX_KEYWORD_LENGTH} caracteres.`,
          )
          .required(),
      )
      .min(1, 'Informe pelo menos uma palavra-chave.')
      .max(MAX_KEYWORDS, `Informe no máximo ${MAX_KEYWORDS} palavras-chave.`)
      .required('Informe as palavras-chave.'),
    message: yup
      .string()
      .trim()
      .min(1, 'Informe a mensagem da DM.')
      .max(
        MAX_REPLY_MESSAGE_LENGTH,
        `A mensagem deve ter no máximo ${MAX_REPLY_MESSAGE_LENGTH} caracteres.`,
      )
      .required('Informe a mensagem da DM.')
      .when('button', {
        is: (button: unknown) => Boolean(button),
        then: (schema) =>
          schema.max(
            MAX_BUTTON_MESSAGE_LENGTH,
            `Com botão, a mensagem deve ter no máximo ${MAX_BUTTON_MESSAGE_LENGTH} caracteres.`,
          ),
      }),
    button: yup
      .object({
        label: yup
          .string()
          .trim()
          .min(1, 'Informe o texto do botão.')
          .max(
            MAX_BUTTON_LABEL_LENGTH,
            `O texto do botão deve ter no máximo ${MAX_BUTTON_LABEL_LENGTH} caracteres.`,
          )
          .required('Informe o texto do botão.'),
        url: yup
          .string()
          .trim()
          .max(MAX_BUTTON_URL_LENGTH, 'O link do botão é longo demais.')
          .test('https-url', 'Use um link que comece com https://.', isHttpsUrl)
          .required('Informe o link do botão.'),
      })
      .noUnknown('Campo não permitido.')
      .nullable()
      .default(null),
    commentReply: yup
      .string()
      .trim()
      .max(
        MAX_COMMENT_REPLY_LENGTH,
        `A resposta do comentário deve ter no máximo ${MAX_COMMENT_REPLY_LENGTH} caracteres.`,
      )
      .nullable()
      .default(null)
      .transform((value: string | null) => (value ? value : null)),
    isActive: yup.boolean().required('Informe se a automação está ativa.'),
  })
  .noUnknown('Campo não permitido.');

export type SaveCommentAutomationSchemaInput = yup.InferType<
  typeof saveCommentAutomationSchema
>;
