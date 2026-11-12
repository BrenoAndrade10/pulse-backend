import type { DataSource, EntityManager } from 'typeorm';
import { PostgresLeadsRepository } from './PostgresLeadsRepository';

const lead = {
  id: 'lead-id',
  emailHash: 'email-hash',
  profileEncrypted: 'encrypted',
  profileIv: 'iv',
  profileAuthTag: 'tag',
};

function input(anonymousId?: string) {
  return {
    tenantId: 'tenant-id',
    expertId: 'expert-id',
    emailHash: 'email-hash',
    phoneHash: null,
    consent: true,
    launchId: null,
    pixelId: 'pixel-id',
    ruleId: 'rule-id',
    eventId: 'event-id',
    pageUrl: 'https://example.com/form',
    utm: { source: 'instagram' },
    submittedAt: new Date('2026-11-10T12:00:00.000Z'),
    newLeadId: 'new-lead-id',
    submissionId: 'submission-id',
    anonymousId,
    clickId: 'click-id',
    identityId: 'identity-id',
    mergeProfile: jest.fn().mockReturnValue({
      encryptedValue: 'encrypted',
      iv: 'iv',
      authTag: 'tag',
    }),
  };
}

function setup() {
  const manager = {
    query: jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([lead])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id: 'submission-id' }])
      .mockResolvedValueOnce([]),
  };
  const dataSource = {
    transaction: jest.fn((callback: (manager: EntityManager) => unknown) =>
      Promise.resolve(callback(manager as never)),
    ),
  } as unknown as DataSource;
  return {
    manager,
    dataSource,
    repository: new PostgresLeadsRepository(dataSource),
  };
}

describe('PostgresLeadsRepository recordSubmission', () => {
  it('records identity in the same transaction with conflict protection', async () => {
    const { manager, dataSource, repository } = setup();

    await expect(repository.recordSubmission(input('anon-1'))).resolves.toEqual(
      {
        leadId: 'lead-id',
        duplicate: false,
      },
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    const identityQuery = manager.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO "lead_identities"'),
    );
    expect(identityQuery?.[0]).toContain(
      'ON CONFLICT ("tenantId", "leadId", "anonymousId") DO NOTHING',
    );
    expect(identityQuery?.[1]).toEqual([
      'identity-id',
      'tenant-id',
      'expert-id',
      'lead-id',
      'anon-1',
      'click-id',
      new Date('2026-11-10T12:00:00.000Z'),
    ]);
  });

  it('does not insert identity when anonymousId is empty', async () => {
    const { manager, repository } = setup();

    await repository.recordSubmission(input('   '));

    expect(
      manager.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO "lead_identities"'),
      ),
    ).toBe(false);
  });
});

describe('PostgresLeadsRepository findIdentities', () => {
  function build(queries: unknown[][]) {
    const query = jest.fn();
    for (const result of queries) query.mockResolvedValueOnce(result);
    const dataSource = { query } as unknown as DataSource;
    return { query, repository: new PostgresLeadsRepository(dataSource) };
  }

  it('returns null without reading identities when the lead is not from the tenant and expert', async () => {
    const { query, repository } = build([[]]);

    await expect(
      repository.findIdentities('tenant-id', 'expert-id', 'lead-id'),
    ).resolves.toBeNull();

    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain(
      '"tenantId" = $1 AND "expertId" = $2 AND "id" = $3',
    );
    expect(query.mock.calls[0][1]).toEqual([
      'tenant-id',
      'expert-id',
      'lead-id',
    ]);
  });

  it('returns distinct anonymous ids and non-null click ids scoped by tenant, expert and lead', async () => {
    const { query, repository } = build([
      [{ '?column?': 1 }],
      [
        { anonymousId: 'anon-1', clickId: 'click-1' },
        { anonymousId: 'anon-2', clickId: null },
        { anonymousId: 'anon-3', clickId: 'click-1' },
      ],
    ]);

    await expect(
      repository.findIdentities('tenant-id', 'expert-id', 'lead-id'),
    ).resolves.toEqual({
      anonymousIds: ['anon-1', 'anon-2', 'anon-3'],
      clickIds: ['click-1'],
    });

    expect(String(query.mock.calls[1][0])).toContain(
      '"tenantId" = $1 AND "expertId" = $2 AND "leadId" = $3',
    );
    expect(query.mock.calls[1][1]).toEqual([
      'tenant-id',
      'expert-id',
      'lead-id',
    ]);
  });

  it('returns empty lists for a lead without identities', async () => {
    const { repository } = build([[{ '?column?': 1 }], []]);

    await expect(
      repository.findIdentities('tenant-id', 'expert-id', 'lead-id'),
    ).resolves.toEqual({ anonymousIds: [], clickIds: [] });
  });
});

describe('PostgresLeadsRepository heat', () => {
  function build(result: unknown) {
    const query = jest.fn().mockResolvedValue(result);
    const dataSource = { query } as unknown as DataSource;
    return { query, repository: new PostgresLeadsRepository(dataSource) };
  }

  const calculatedAt = new Date('2026-11-12T15:00:00.000Z');

  it('updates heat scoped by id, tenant and expert with parameters', async () => {
    const { query, repository } = build([[{ id: 'lead-id' }], 1]);

    await expect(
      repository.updateHeat('tenant-id', 'expert-id', 'lead-id', {
        score: 42,
        band: 'warm',
        calculatedAt,
      }),
    ).resolves.toBe(true);

    expect(String(query.mock.calls[0][0])).toContain(
      '"id" = $1 AND "tenantId" = $2 AND "expertId" = $3',
    );
    expect(query.mock.calls[0][1]).toEqual([
      'lead-id',
      'tenant-id',
      'expert-id',
      42,
      'warm',
      calculatedAt,
    ]);
  });

  it('returns false when no lead matched the owner', async () => {
    const { repository } = build([[], 0]);

    await expect(
      repository.updateHeat('tenant-id', 'expert-id', 'lead-id', {
        score: 0,
        band: 'cold',
        calculatedAt,
      }),
    ).resolves.toBe(false);
  });

  it('lists only stale or never calculated leads that have identities, nulls first', async () => {
    const rows = [{ tenantId: 't', expertId: 'e', leadId: 'l' }];
    const { query, repository } = build(rows);
    const staleBefore = new Date('2026-11-12T00:00:00.000Z');

    await expect(
      repository.listHeatCandidates({ staleBefore, limit: 50 }),
    ).resolves.toBe(rows);

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('FROM "lead_identities"');
    expect(sql).toContain(
      '"heatCalculatedAt" IS NULL OR l."heatCalculatedAt" < $1',
    );
    expect(sql).toContain('ORDER BY l."heatCalculatedAt" ASC NULLS FIRST');
    expect(query.mock.calls[0][1]).toEqual([staleBefore, 50]);
  });

  it.each([
    [5000, 1000],
    [0, 1],
    [-3, 1],
  ])('clamps the candidate limit %p to %p', async (limit, expected) => {
    const { query, repository } = build([]);

    await repository.listHeatCandidates({
      staleBefore: new Date(),
      limit,
    });

    expect(query.mock.calls[0][1]).toEqual([expect.any(Date), expected]);
  });

  it('filters the listing by heat band with a parameter', async () => {
    const { query, repository } = build([]);

    await repository.list({
      tenantId: 'tenant-id',
      expertId: 'expert-id',
      heatBand: 'hot',
      limit: 10,
    });

    expect(String(query.mock.calls[0][0])).toContain('l."heatBand" = $3');
    expect(query.mock.calls[0][1]).toEqual([
      'tenant-id',
      'expert-id',
      'hot',
      10,
    ]);
  });

  it('applies the heat band filter to the count too', async () => {
    const { query, repository } = build([{ count: 2 }]);

    await expect(
      repository.count({
        tenantId: 'tenant-id',
        expertId: 'expert-id',
        heatBand: 'warm',
      }),
    ).resolves.toBe(2);
    expect(query.mock.calls[0][1]).toEqual(['tenant-id', 'expert-id', 'warm']);
  });
});
