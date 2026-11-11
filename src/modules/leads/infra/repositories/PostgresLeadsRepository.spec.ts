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
