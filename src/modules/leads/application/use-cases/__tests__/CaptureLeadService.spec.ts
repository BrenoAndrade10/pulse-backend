/* eslint-disable @typescript-eslint/unbound-method */
import { randomBytes } from 'node:crypto';
import { Environment } from '../../../../../config/Environment';
import type { LeadsRepository } from '../../../domain/repositories/LeadsRepository';
import { LeadEncryptionService } from '../../../infra/crypto/LeadEncryptionService';
import {
  CaptureLeadService,
  type CaptureLeadInput,
} from '../../services/CaptureLeadService';

describe('CaptureLeadService', () => {
  const cipher = new LeadEncryptionService();
  let leads: jest.Mocked<LeadsRepository>;
  let service: CaptureLeadService;
  let ids = 0;

  const input = (
    values: Partial<CaptureLeadInput['values']>,
  ): CaptureLeadInput => ({
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    pixelId: 'pixel-a',
    ruleId: 'rule-a',
    eventId: 'event-a',
    launchId: 'launch-a',
    pageUrl: 'https://site.com/captura',
    utm: { source: 'instagram' },
    submittedAt: new Date('2026-10-18T12:00:00Z'),
    values: { custom: {}, ...values },
    consent: true,
  });

  beforeEach(() => {
    Environment.vars = {
      LEADS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    } as typeof Environment.vars;
    ids = 0;
    leads = {
      recordSubmission: jest
        .fn()
        .mockResolvedValue({ leadId: 'lead-a', duplicate: false }),
      list: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      launchNames: jest.fn(),
      customFieldLabels: jest.fn(),
    };
    service = new CaptureLeadService(leads, cipher, {
      generate: () => `id-${++ids}`,
    });
  });

  const recorded = () => leads.recordSubmission.mock.calls[0][0];

  it('records the submission identified by email and phone hashes', async () => {
    await expect(
      service.capture(
        input({
          name: ' Ana ',
          email: 'Ana@Exemplo.com',
          phone: '(11) 99999-8888',
        }),
      ),
    ).resolves.toEqual({ status: 'captured', leadId: 'lead-a' });

    const call = recorded();
    expect(call).toMatchObject({
      emailHash: cipher.hash('email', 'ana@exemplo.com'),
      phoneHash: cipher.hash('phone', '+5511999998888'),
      launchId: 'launch-a',
      eventId: 'event-a',
      consent: true,
      utm: { source: 'instagram' },
    });
    expect(JSON.stringify(call)).not.toContain('ana@exemplo.com');
  });

  it('builds a new lead profile, encrypted for that lead', async () => {
    await service.capture(
      input({
        name: 'Ana',
        email: 'ana@exemplo.com',
        custom: { Origem: ' Reels ' },
      }),
    );

    const encrypted = recorded().mergeProfile('lead-new', null);
    const owner = {
      tenantId: 'tenant-a',
      expertId: 'expert-a',
      leadId: 'lead-new',
    };
    expect(cipher.decrypt(encrypted, owner)).toEqual({
      name: 'Ana',
      email: 'ana@exemplo.com',
      phone: undefined,
      custom: { Origem: 'Reels' },
    });
  });

  it('merges into the existing lead without losing data', async () => {
    const owner = {
      tenantId: 'tenant-a',
      expertId: 'expert-a',
      leadId: 'lead-a',
    };
    const existing = cipher.encrypt(
      {
        name: 'Ana',
        email: 'ana@exemplo.com',
        phone: '+5511999998888',
        custom: { Origem: 'Reels' },
      },
      owner,
    );

    await service.capture(
      input({ email: 'ana@exemplo.com', phone: '11977776666' }),
    );

    expect(
      cipher.decrypt(recorded().mergeProfile('lead-a', existing), owner),
    ).toEqual({
      name: 'Ana',
      email: 'ana@exemplo.com',
      phone: '+5511977776666',
      custom: { Origem: 'Reels' },
    });
  });

  it('reports a repeated event as duplicate', async () => {
    leads.recordSubmission.mockResolvedValue({
      leadId: 'lead-a',
      duplicate: true,
    });

    await expect(
      service.capture(input({ email: 'ana@exemplo.com' })),
    ).resolves.toEqual({
      status: 'duplicate',
      leadId: 'lead-a',
    });
  });

  it.each([
    ['without email nor phone', { name: 'Ana' }],
    ['with an invalid email and phone', { email: 'nope', phone: '12' }],
  ])('skips submissions %s', async (_, values) => {
    await expect(service.capture(input(values))).resolves.toEqual({
      status: 'skipped',
    });
    expect(leads.recordSubmission).not.toHaveBeenCalled();
  });
});
