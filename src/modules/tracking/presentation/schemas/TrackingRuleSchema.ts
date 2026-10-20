import * as yup from 'yup';

const ATTRIBUTE_NAME = /^[a-z][a-z0-9:_-]{0,39}$/;
const MAX_ATTRIBUTES = 10;
const MAX_FIELDS = 20;

const isAttributeRecord = (value: unknown): boolean => {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const entries = Object.entries(value);
  return (
    entries.length <= MAX_ATTRIBUTES &&
    entries.every(
      ([name, attribute]) =>
        ATTRIBUTE_NAME.test(name) &&
        typeof attribute === 'string' &&
        attribute.length <= 200,
    )
  );
};

export const createTrackingRuleSchema = yup
  .object({
    scope: yup
      .mixed<'page' | 'site'>()
      .oneOf(['page', 'site'], 'Escolha onde o evento vale.')
      .required('Escolha onde o evento vale.'),
    trigger: yup
      .mixed<'click' | 'submit'>()
      .oneOf(['click', 'submit'], 'Escolha o que dispara o evento.')
      .required('Escolha o que dispara o evento.'),
    eventName: yup
      .string()
      .trim()
      .matches(
        /^[A-Za-z][A-Za-z0-9_]{0,39}$/,
        'Use só letras, números e _ no nome do evento (até 40 caracteres).',
      )
      .required('Escolha o evento.'),
    element: yup
      .object({
        selector: yup
          .string()
          .trim()
          .min(1)
          .max(500, 'Seletor longo demais.')
          .required('Elemento sem seletor.'),
        tag: yup
          .string()
          .matches(/^[a-z][a-z0-9-]{0,39}$/, 'Elemento inválido.')
          .required('Elemento inválido.'),
        text: yup.string().trim().max(120).optional(),
        attributes: yup
          .mixed<Record<string, string>>()
          .test(
            'attributes',
            'Atributos do elemento inválidos.',
            isAttributeRecord,
          )
          .default({}),
      })
      .noUnknown('Campo não permitido.')
      .required('Selecione um elemento.'),
    fields: yup
      .array(
        yup
          .object({
            key: yup
              .mixed<'name' | 'email' | 'phone' | 'consent' | 'custom'>()
              .oneOf(
                ['name', 'email', 'phone', 'consent', 'custom'],
                'Tipo de campo inválido.',
              )
              .required(),
            slug: yup
              .string()
              .matches(
                /^[a-z][a-z0-9_]{0,39}$/,
                'Identificador de campo inválido.',
              )
              .required(),
            label: yup
              .string()
              .trim()
              .min(1, 'Dê um nome ao campo.')
              .max(80, 'O nome do campo deve ter no máximo 80 caracteres.')
              .required(),
            selector: yup.string().trim().min(1).max(300).required(),
          })
          .noUnknown('Campo não permitido.')
          .required(),
      )
      .max(MAX_FIELDS, `Mapeie no máximo ${MAX_FIELDS} campos.`)
      .default([])
      .test('unique-slugs', 'Há campos repetidos no mapeamento.', (fields) => {
        const slugs = (fields ?? []).map((field) => field.slug);
        return new Set(slugs).size === slugs.length;
      }),
  })
  .noUnknown('Campo não permitido.')
  .test(
    'fields-only-on-submit',
    'Só formulários têm campos para salvar.',
    (rule) => rule.trigger === 'submit' || (rule.fields ?? []).length === 0,
  );

export type CreateTrackingRuleSchemaInput = yup.InferType<
  typeof createTrackingRuleSchema
>;
