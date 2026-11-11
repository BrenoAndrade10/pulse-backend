import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkPurpose } from '../../domain/enums/LinkPurpose';
import {
  createLinkSchema,
  listLinksQuerySchema,
  linkIdSchema,
  updateLinkSchema,
} from './LinkSchemas';

const expertId = '018f0f9f-6d25-7d9d-8cb8-3f2b1e9c4a6d';
const launchId = '018f0fa0-7f33-7c3a-9a44-2d8e5b6c1f20';

describe('createLinkSchema', () => {
  it('accepts the minimum valid input and defaults channel and purpose', async () => {
    await expect(
      createLinkSchema.validate({
        name: 'Meu link',
        destinationUrl: 'https://example.com',
      }),
    ).resolves.toEqual({
      name: 'Meu link',
      destinationUrl: 'https://example.com',
      channel: LinkChannel.OTHER,
      purpose: LinkPurpose.OTHER,
    });
  });

  it('accepts the complete input', async () => {
    await expect(
      createLinkSchema.validate({
        name: 'Campanha',
        destinationUrl: 'https://example.com/oferta',
        channel: LinkChannel.INSTAGRAM,
        purpose: LinkPurpose.OFFER,
        placement: 'Bio',
        campaign: 'Outubro',
        utm: {
          source: 'instagram',
          medium: 'bio',
          campaign: 'outubro',
          content: 'botao',
          term: 'oferta',
        },
        expertId,
        launchId,
      }),
    ).resolves.toMatchObject({
      name: 'Campanha',
      purpose: LinkPurpose.OFFER,
      expertId,
      launchId,
    });
  });

  it.each([
    ['name', { name: 'a' }],
    ['name', { name: 'a'.repeat(121) }],
    ['destinationUrl', { destinationUrl: '' }],
    ['destinationUrl', { destinationUrl: 'a'.repeat(2049) }],
    ['channel', { channel: 'invalid' }],
    ['purpose', { purpose: 'invalid' }],
    ['placement', { placement: 'a'.repeat(65) }],
    ['campaign', { campaign: 'a'.repeat(121) }],
    ['utm source', { utm: { source: 'a'.repeat(121) } }],
    ['utm medium', { utm: { medium: 'a'.repeat(121) } }],
    ['utm campaign', { utm: { campaign: 'a'.repeat(121) } }],
    ['utm content', { utm: { content: 'a'.repeat(121) } }],
    ['utm term', { utm: { term: 'a'.repeat(121) } }],
  ])('rejects invalid %s', async (_, invalid) => {
    await expect(
      createLinkSchema.validate({
        name: 'Valid name',
        destinationUrl: 'https://example.com',
        channel: LinkChannel.OTHER,
        ...invalid,
      }),
    ).rejects.toThrow();
  });

  it('requires expertId when launchId is provided', async () => {
    await expect(
      createLinkSchema.validate({
        name: 'Valid name',
        destinationUrl: 'https://example.com',
        channel: LinkChannel.OTHER,
        launchId,
      }),
    ).rejects.toThrow('Informe o expert quando informar o lançamento.');
  });

  it('validates UUID v7 identifiers', async () => {
    expect(isUuidV7(expertId)).toBe(true);
    await expect(
      createLinkSchema.validate({
        name: 'Valid name',
        destinationUrl: 'https://example.com',
        channel: LinkChannel.OTHER,
        expertId: 'not-a-uuid',
      }),
    ).rejects.toThrow('Informe um identificador válido.');
  });

  it('trims string values', async () => {
    await expect(
      createLinkSchema.validate({
        name: '  Meu link  ',
        destinationUrl: '  https://example.com/path  ',
        channel: LinkChannel.OTHER,
        placement: '  Bio  ',
      }),
    ).resolves.toMatchObject({
      name: 'Meu link',
      destinationUrl: 'https://example.com/path',
      placement: 'Bio',
    });
  });

  it('does not pass tenant and server-controlled fields to the input', async () => {
    const input = await createLinkSchema.validate({
      name: 'Valid name',
      destinationUrl: 'https://example.com',
      channel: LinkChannel.OTHER,
      tenantId: 'tenant-id',
      createdBy: 'user-id',
      status: 'active',
      code: 'abcd',
      shortUrl: 'https://short.example/abcd',
      destinationVersion: 1,
      id: 'link-id',
    });

    expect(input).not.toHaveProperty('tenantId');
    expect(input).not.toHaveProperty('createdBy');
    expect(input).not.toHaveProperty('status');
    expect(input).not.toHaveProperty('code');
    expect(input).not.toHaveProperty('shortUrl');
    expect(input).not.toHaveProperty('destinationVersion');
    expect(input).not.toHaveProperty('id');
  });
});

describe('listLinksQuerySchema', () => {
  it('defaults the limit and accepts filters', async () => {
    await expect(
      listLinksQuerySchema.validate({
        expertId,
        channel: LinkChannel.INSTAGRAM,
        status: 'active',
        search: '  oferta  ',
      }),
    ).resolves.toMatchObject({
      expertId,
      channel: LinkChannel.INSTAGRAM,
      limit: 20,
      search: 'oferta',
    });
  });

  it.each([
    ['limit too low', { limit: '0' }],
    ['limit too high', { limit: '101' }],
    ['limit decimal', { limit: '1.5' }],
    ['invalid channel', { channel: 'invalid' }],
    ['invalid status', { status: 'invalid' }],
    ['invalid expert', { expertId: 'not-a-uuid' }],
    ['long search', { search: 'a'.repeat(121) }],
    ['long cursor', { cursor: 'a'.repeat(201) }],
  ])('rejects %s', async (_, query) => {
    await expect(listLinksQuerySchema.validate(query)).rejects.toThrow();
  });

  it('removes unknown fields', async () => {
    const query = await listLinksQuerySchema.validate({
      limit: '5',
      tenantId: 'forbidden',
    });
    expect(query).not.toHaveProperty('tenantId');
  });
});

describe('updateLinkSchema', () => {
  it('rejects an empty body and accepts nullable fields', async () => {
    await expect(updateLinkSchema.validate({})).rejects.toThrow(
      'Informe ao menos um campo para atualização.',
    );
    await expect(
      updateLinkSchema.validate({
        placement: null,
        campaign: null,
        expertId: null,
        launchId: null,
      }),
    ).resolves.toMatchObject({ regenerateUtm: false });
  });

  it('accepts valid fields and removes server-controlled fields', async () => {
    const result = await updateLinkSchema.validate({
      name: '  Novo nome  ',
      status: 'inactive',
      tenantId: 'tenant-id',
      createdBy: 'creator',
    });
    expect(result).toMatchObject({ name: 'Novo nome', status: 'inactive' });
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('createdBy');
  });

  it.each([
    { name: 'a' },
    { destinationUrl: 'a'.repeat(2049) },
    { status: 'unknown' },
    { purpose: 'unknown' },
    { channel: 'unknown' },
    { expertId: 'invalid' },
    { utm: { source: 'a'.repeat(121) } },
  ])('rejects invalid update %j', async (value) => {
    await expect(
      updateLinkSchema.validate({ ...value, status: value.status ?? 'active' }),
    ).rejects.toThrow();
  });

  it('validates route ids as UUID v7', async () => {
    await expect(linkIdSchema.validate(expertId)).resolves.toBe(expertId);
    await expect(linkIdSchema.validate('not-a-uuid')).rejects.toThrow();
  });
});
