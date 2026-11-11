import { DomainError } from '../../../../shared/errors/DomainError';
import { UserRole } from '../../../users/domain/enums/UserRole';
import { Link } from '../../domain/entities/Link';
import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkPurpose } from '../../domain/enums/LinkPurpose';
import { LinkStatus } from '../../domain/enums/LinkStatus';
import type { CreateLinkOutput } from '../../application/use-cases/CreateLinkUseCase';
import { YupValidationPipe } from '../../../../shared/presentation/pipes/YupValidationPipe';
import { createLinkSchema } from '../schemas/LinkSchemas';
import { LinksController } from './LinksControllers';

describe('LinksController', () => {
  const auth = {
    userId: 'user-id',
    sessionId: 'session-id',
    tenantId: 'tenant-id',
    role: UserRole.ADMIN,
  } as never;

  function output(): CreateLinkOutput {
    const createdAt = new Date('2026-11-10T12:00:00.000Z');
    const updatedAt = new Date('2026-11-10T12:05:00.000Z');
    return {
      link: new Link({
        id: 'link-id',
        tenantId: 'tenant-id',
        expertId: 'expert-id',
        launchId: 'launch-id',
        name: 'Link de oferta',
        destinationUrl: 'https://example.com/oferta',
        code: 'abcdefgh',
        channel: LinkChannel.INSTAGRAM,
        placement: 'bio',
        campaign: 'oferta',
        utmSource: 'instagram',
        utmMedium: 'bio',
        utmCampaign: 'oferta',
        utmContent: 'bio',
        utmTerm: 'vip',
        purpose: LinkPurpose.OFFER,
        status: LinkStatus.ACTIVE,
        destinationVersion: 1,
        createdBy: 'user-id',
        createdAt,
        updatedAt,
        deletedAt: null,
      }),
      shortUrl: 'https://api.example.com/l/abcdefgh',
    };
  }

  it('passes validated input and auth to the use case and maps the response', async () => {
    const execute = jest.fn().mockResolvedValue(output());
    const controller = new LinksController(
      { execute } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
    );
    const input = await createLinkSchema.validate({
      name: ' Link de oferta ',
      destinationUrl: 'https://example.com/oferta',
      channel: LinkChannel.INSTAGRAM,
      expertId: '018f0f9f-6d25-7d9d-8cb8-3f2b1e9c4a6d',
    });

    await expect(controller.create(input, auth)).resolves.toEqual({
      id: 'link-id',
      expertId: 'expert-id',
      launchId: 'launch-id',
      name: 'Link de oferta',
      destinationUrl: 'https://example.com/oferta',
      code: 'abcdefgh',
      shortUrl: 'https://api.example.com/l/abcdefgh',
      channel: LinkChannel.INSTAGRAM,
      placement: 'bio',
      campaign: 'oferta',
      utm: {
        source: 'instagram',
        medium: 'bio',
        campaign: 'oferta',
        content: 'bio',
        term: 'vip',
      },
      purpose: LinkPurpose.OFFER,
      status: LinkStatus.ACTIVE,
      destinationVersion: 1,
      createdAt: '2026-11-10T12:00:00.000Z',
      updatedAt: '2026-11-10T12:05:00.000Z',
    });
    expect(execute).toHaveBeenCalledWith(input, auth);
  });

  it('propagates domain errors from the use case', async () => {
    const error = new DomainError(409, 'LINK_CODE_ALREADY_EXISTS');
    const execute = jest.fn().mockRejectedValue(error);
    const controller = new LinksController(
      { execute } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
    );

    await expect(
      controller.create(
        {
          name: 'Link',
          destinationUrl: 'https://example.com',
          channel: LinkChannel.OTHER,
        } as never,
        auth,
      ),
    ).rejects.toBe(error);
  });

  it('returns a validation DomainError for an invalid body through the pipe', async () => {
    const pipe = new YupValidationPipe(createLinkSchema);

    await expect(
      pipe.transform({
        name: 'a',
        destinationUrl: '',
        channel: 'invalid',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      reason: 'VALIDATION_FAILED',
    });
  });

  it('does not expose tenant, creator or deletion fields', async () => {
    const execute = jest.fn().mockResolvedValue(output());
    const controller = new LinksController(
      { execute } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
    );
    const response = await controller.create(
      {
        name: 'Link',
        destinationUrl: 'https://example.com',
        channel: LinkChannel.OTHER,
      } as never,
      auth,
    );

    expect(response).not.toHaveProperty('tenantId');
    expect(response).not.toHaveProperty('createdBy');
    expect(response).not.toHaveProperty('deletedAt');
  });

  it('lists and maps links without server-controlled fields', async () => {
    const execute = jest
      .fn()
      .mockResolvedValue({ items: [output()], nextCursor: null });
    const controller = new LinksController(
      { execute: jest.fn() } as never,
      { execute } as never,
      { execute: jest.fn() } as never,
    );
    const query = { limit: 20 } as never;
    const response = await controller.list(query, auth);

    expect(response).toMatchObject({
      nextCursor: null,
      data: [{ id: 'link-id', shortUrl: 'https://api.example.com/l/abcdefgh' }],
    });
    expect(response.data[0]).not.toHaveProperty('tenantId');
    expect(response.data[0]).not.toHaveProperty('createdBy');
    expect(response.data[0]).not.toHaveProperty('deletedAt');
    expect(execute).toHaveBeenCalledWith(query, auth);
  });

  it('updates with route id and maps the response', async () => {
    const execute = jest.fn().mockResolvedValue(output());
    const controller = new LinksController(
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute } as never,
    );
    const input = { status: LinkStatus.INACTIVE } as never;
    await expect(
      controller.update('link-id', input, auth),
    ).resolves.toMatchObject({
      id: 'link-id',
      shortUrl: 'https://api.example.com/l/abcdefgh',
    });
    expect(execute).toHaveBeenCalledWith('link-id', input, auth);
  });
});
