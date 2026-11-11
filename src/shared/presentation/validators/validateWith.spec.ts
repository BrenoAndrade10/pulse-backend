import * as yup from 'yup';
import { DomainError } from '../../errors/DomainError';
import { validateWith } from './validateWith';

describe('validateWith', () => {
  it('returns the transformed value with defaults and unknown fields removed', async () => {
    const schema = yup
      .object({
        name: yup.string().trim().required(),
        status: yup.string().default('active'),
      })
      .noUnknown();

    await expect(validateWith(schema, { name: '  Pulse  ' })).resolves.toEqual({
      name: 'Pulse',
      status: 'active',
    });
  });

  it('returns all validation errors as a DomainError', async () => {
    const schema = yup.object({
      name: yup.string().required('Informe o nome.'),
      email: yup.string().email('Informe um e-mail válido.').required(),
    });

    await expect(
      validateWith(schema, { name: '', email: 'invalid' }),
    ).rejects.toEqual(
      expect.objectContaining({
        statusCode: 400,
        reason: 'VALIDATION_FAILED',
        data: {
          errors: ['Informe o nome.', 'Informe um e-mail válido.'],
        },
      } satisfies Partial<DomainError>),
    );
  });

  it('passes default options and caller overrides to yup', async () => {
    const schema = {
      validate: jest.fn().mockResolvedValue('validated'),
    };

    await expect(
      validateWith(schema, 'value', { abortEarly: true, stripUnknown: true }),
    ).resolves.toBe('validated');
    expect(schema.validate).toHaveBeenCalledWith('value', {
      abortEarly: true,
      stripUnknown: true,
    });
  });

  it('rethrows non-yup errors', async () => {
    const error = new Error('unexpected');
    const schema = {
      validate: jest.fn().mockRejectedValue(error),
    };

    await expect(validateWith(schema, 'value')).rejects.toBe(error);
  });
});
