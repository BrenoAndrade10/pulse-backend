import { QueryFailedError } from 'typeorm';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Link } from '../../domain/entities/Link';
import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkPurpose } from '../../domain/enums/LinkPurpose';
import { LinkStatus } from '../../domain/enums/LinkStatus';
import { LinkMapper } from '../mappers/LinkMapper';
import { TypeOrmLinksRepository } from './TypeOrmLinksRepository';

describe('TypeOrmLinksRepository', () => {
  const link = new Link({
    id: 'link-id',
    tenantId: 'tenant-id',
    expertId: null,
    launchId: null,
    name: 'Link',
    destinationUrl: 'https://example.com',
    code: 'abcd',
    channel: LinkChannel.OTHER,
    placement: null,
    campaign: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    purpose: LinkPurpose.OTHER,
    status: LinkStatus.ACTIVE,
    destinationVersion: 1,
    createdBy: null,
    createdAt: new Date('2026-11-09T12:00:00.000Z'),
    updatedAt: new Date('2026-11-09T12:00:00.000Z'),
    deletedAt: null,
  });

  function repository() {
    return {
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as never;
  }

  it('translates the global code constraint into a domain error', async () => {
    const orm = repository() as {
      save: jest.Mock;
    };
    orm.save.mockRejectedValue(
      Object.assign(new QueryFailedError('INSERT', [], new Error()), {
        driverError: { constraint: 'UQ_links_code' },
      }),
    );
    const links = new TypeOrmLinksRepository(orm as never);

    await expect(links.create(link)).rejects.toMatchObject(
      new DomainError(409, 'LINK_CODE_ALREADY_EXISTS'),
    );
  });

  it('tryCreate returns the inserted link from RETURNING', async () => {
    const entity = LinkMapper.toPersistence(link);
    const queryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ raw: [entity] }),
    };
    const orm = repository() as {
      createQueryBuilder: jest.Mock;
    };
    orm.createQueryBuilder.mockReturnValue(queryBuilder);
    const links = new TypeOrmLinksRepository(orm as never);

    await expect(links.tryCreate(link)).resolves.toMatchObject({
      id: 'link-id',
    });
    expect(queryBuilder.orIgnore).toHaveBeenCalledTimes(1);
    expect(queryBuilder.returning).toHaveBeenCalledWith('*');
  });

  it('tryCreate returns null when the insert conflicts', async () => {
    const queryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ raw: [] }),
    };
    const orm = repository() as {
      createQueryBuilder: jest.Mock;
    };
    orm.createQueryBuilder.mockReturnValue(queryBuilder);
    const links = new TypeOrmLinksRepository(orm as never);

    await expect(links.tryCreate(link)).resolves.toBeNull();
  });

  it('finds only non-deleted links within the tenant and maps them', async () => {
    const entity = LinkMapper.toPersistence(link);
    const orm = repository() as {
      findOne: jest.Mock;
      find: jest.Mock;
    };
    orm.findOne.mockResolvedValue(entity);
    orm.find.mockResolvedValue([entity]);
    const links = new TypeOrmLinksRepository(orm as never);
    const anyValue = expect.anything() as unknown;

    await expect(links.findByCode('abcd')).resolves.toMatchObject({
      id: 'link-id',
    });
    await expect(
      links.findByTenantId('tenant-id', { status: LinkStatus.ACTIVE }),
    ).resolves.toHaveLength(1);
    expect(orm.findOne).toHaveBeenCalledWith({
      where: { code: 'abcd', deletedAt: anyValue },
    });
    expect(orm.find).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-id',
        status: LinkStatus.ACTIVE,
        deletedAt: anyValue,
      },
      order: { createdAt: 'DESC' },
    });
  });

  it('soft-deletes a link scoped to its tenant', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute,
    };
    const orm = repository() as {
      createQueryBuilder: jest.Mock;
    };
    orm.createQueryBuilder.mockReturnValue(queryBuilder);
    const links = new TypeOrmLinksRepository(orm as never);

    await expect(links.softDelete('tenant-id', 'link-id')).resolves.toBe(true);
    expect(queryBuilder.where).toHaveBeenCalledWith('"tenantId" = :tenantId', {
      tenantId: 'tenant-id',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('"id" = :id', {
      id: 'link-id',
    });
  });

  it('finds a page with tenant, deletion, filters and escaped search', async () => {
    const entity = LinkMapper.toPersistence(link);
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([entity]),
    };
    const orm = repository() as { createQueryBuilder: jest.Mock };
    orm.createQueryBuilder.mockReturnValue(queryBuilder);
    const links = new TypeOrmLinksRepository(orm as never);

    await expect(
      links.findPage({
        tenantId: 'tenant-id',
        expertId: 'expert-id',
        launchId: 'launch-id',
        channel: LinkChannel.OTHER,
        status: LinkStatus.ACTIVE,
        search: '100%_ok\\',
        cursor: {
          createdAt: new Date('2026-11-10T12:00:00.000Z'),
          id: 'cursor-id',
        },
        limit: 21,
      }),
    ).resolves.toHaveLength(1);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'link."tenantId" = :tenantId',
      {
        tenantId: 'tenant-id',
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'link."deletedAt" IS NULL',
    );
    expect(queryBuilder.take).toHaveBeenCalledWith(21);
    expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE :search'),
      { search: '%100\\%\\_ok\\\\%' },
    );
  });

  it('updates by tenant with returning and returns null when no row is affected', async () => {
    const execute = jest
      .fn()
      .mockResolvedValue({ raw: [LinkMapper.toPersistence(link)] });
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute,
    };
    const orm = repository() as { createQueryBuilder: jest.Mock };
    orm.createQueryBuilder.mockReturnValue(queryBuilder);
    const links = new TypeOrmLinksRepository(orm as never);
    const update = {
      ...LinkMapper.toPersistence(link),
      updatedAt: new Date(),
    };

    await expect(
      links.updateByTenant('tenant-id', 'link-id', update as never),
    ).resolves.toMatchObject({ id: 'link-id' });
    expect(queryBuilder.where).toHaveBeenCalledWith('"id" = :id', {
      id: 'link-id',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '"tenantId" = :tenantId',
      { tenantId: 'tenant-id' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('"deletedAt" IS NULL');
    expect(queryBuilder.returning).toHaveBeenCalledWith('*');

    execute.mockResolvedValue({ raw: [] });
    await expect(
      links.updateByTenant('tenant-id', 'link-id', update as never),
    ).resolves.toBeNull();
  });
});
