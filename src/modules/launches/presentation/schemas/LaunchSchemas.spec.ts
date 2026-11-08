import { ValidationError } from 'yup';
import { LaunchType } from '../../domain/enums/LaunchType';
import { createLaunchSchema } from './LaunchSchemas';

describe('createLaunchSchema', () => {
  const input = {
    expertId: '0193a7f0-1234-7abc-8def-0123456789ab',
    slug: 'webinar-principal',
    name: 'Webinar principal',
  };

  it('accepts webinar as a launch type', async () => {
    await expect(
      createLaunchSchema.validate({ ...input, type: LaunchType.WEBINAR }),
    ).resolves.toMatchObject({ type: LaunchType.WEBINAR });
  });

  it('accepts creation without a slug', async () => {
    const withoutSlug = {
      expertId: input.expertId,
      name: input.name,
    };

    await expect(
      createLaunchSchema.validate(withoutSlug),
    ).resolves.toMatchObject(withoutSlug);
  });

  it('rejects an invalid launch type', async () => {
    await expect(
      createLaunchSchema.validate({ ...input, type: 'invalid' }),
    ).rejects.toMatchObject<Partial<ValidationError>>({
      errors: ['Informe um tipo válido.'],
    });
  });
});
