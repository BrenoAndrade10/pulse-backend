import * as yup from 'yup';
import { DomainError } from '../../errors/DomainError';
import { YupValidationPipe } from './YupValidationPipe';

describe('YupValidationPipe', () => {
  it('returns the value transformed by yup', async () => {
    const schema = yup
      .object({
        name: yup.string().trim().required(),
        status: yup.string().default('active'),
      })
      .noUnknown();

    await expect(
      new YupValidationPipe(schema).transform({
        name: '  Pulse  ',
      }),
    ).resolves.toEqual({ name: 'Pulse', status: 'active' });
  });

  it('throws a validation DomainError with all errors', async () => {
    const schema = yup.object({
      name: yup.string().required('Informe o nome.'),
      email: yup.string().email('Informe um e-mail válido.').required(),
    });

    await expect(
      new YupValidationPipe(schema).transform({ name: '', email: 'invalid' }),
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

  it('passes options overrides to yup', async () => {
    const schema = {
      validate: jest.fn().mockResolvedValue('validated'),
    };
    const pipe = new YupValidationPipe(schema, {
      abortEarly: true,
      stripUnknown: true,
    });

    await expect(pipe.transform('value')).resolves.toBe('validated');
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

    await expect(new YupValidationPipe(schema).transform('value')).rejects.toBe(
      error,
    );
  });
});
