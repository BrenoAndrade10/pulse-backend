/* eslint-disable @typescript-eslint/unbound-method */
import { randomBytes } from 'node:crypto';
import { Environment } from '../../../../../config/Environment';
import type { AccessTokenClaims } from '../../../../auth/domain/types/AccessTokenClaims';
import type { ExpertsRepository } from '../../../../experts/domain/repositories/ExpertsRepository';
import { UserRole } from '../../../../users/domain/enums/UserRole';
import type {
  LeadRow,
  LeadsRepository,
} from '../../../domain/repositories/LeadsRepository';
import { LeadEncryptionService } from '../../../infra/crypto/LeadEncryptionService';
import { LeadExportLinks } from '../../../infra/export/LeadExportLinks';
import { csvCell, ExportLeadsUseCase } from '../ExportLeadsUseCase';
import { ListLeadsUseCase } from '../ListLeadsUseCase';

const auth: AccessTokenClaims = {
  userId: 'user-a',
  sessionId: 'session-a',
  tenantId: 'tenant-a',
  role: UserRole.ADMIN,
};

describe('leads queries', () => {
  const cipher = new LeadEncryptionService();
  let experts: jest.Mocked<ExpertsRepository>;
  let leads: jest.Mocked<LeadsRepository>;

  const makeRow = (
    index: number,
    overrides: Partial<LeadRow> = {},
  ): LeadRow => {
    const id = `lead-${index}`;
    return {
      id,
      tenantId: 'tenant-a',
      expertId: 'expert-a',
      profile: cipher.encrypt(
        {
          name: `Lead ${index}`,
          email: `lead${index}@exemplo.com`,
          phone: '+5511999998888',
          custom: { Origem: 'Reels', Faturamento: '10k' },
        },
        { tenantId: 'tenant-a', expertId: 'expert-a', leadId: id },
      ),
      consent: true,
      firstSeenAt: new Date('2026-10-01T12:00:00Z'),
      lastSeenAt: new Date('2026-10-02T12:00:00Z'),
      cursor: { lastSeenAt: `2026-10-02T12:00:00.00000${index}`, id },
      launches: [
        {
          launchId: 'launch-a',
          firstSubmittedAt: new Date('2026-10-01T12:00:00Z'),
          lastSubmittedAt: new Date('2026-10-02T12:00:00Z'),
          submissionsCount: 2,
          firstUtm: { source: 'instagram', campaign: 'marco' },
        },
      ],
      ...overrides,
    };
  };

  beforeEach(() => {
    Environment.vars = {
      LEADS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      JWT_SECRET: 'test-secret-with-at-least-32-characters!',
    } as typeof Environment.vars;
    experts = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByTenantIdAndId: jest.fn().mockResolvedValue({ id: 'expert-a' }),
      findByTenantIdAndEmail: jest.fn(),
      findByTenantId: jest.fn(),
      deleteByTenantIdAndId: jest.fn(),
    };
    leads = {
      recordSubmission: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn(),
      launchNames: jest
        .fn()
        .mockResolvedValue(new Map([['launch-a', 'Lançamento Março']])),
      customFieldLabels: jest.fn().mockResolvedValue(['Origem']),
    };
  });

  describe('ListLeadsUseCase', () => {
    const useCase = () => new ListLeadsUseCase(experts, leads, cipher);

    it('decrypts the page and points to the next one', async () => {
      leads.list.mockResolvedValue([makeRow(1), makeRow(2), makeRow(3)]);
      leads.count.mockResolvedValue(3);

      const result = await useCase().execute(
        { expertId: 'expert-a', limit: 2 },
        auth,
      );

      expect(result.leads.map((lead) => lead.profile.email)).toEqual([
        'lead1@exemplo.com',
        'lead2@exemplo.com',
      ]);
      expect(result.total).toBe(3);
      expect(result.next).toEqual({
        lastSeenAt: '2026-10-02T12:00:00.000002',
        id: 'lead-2',
      });
      expect(leads.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 3 }),
      );
    });

    it('does not count again on the next pages', async () => {
      await useCase().execute(
        {
          expertId: 'expert-a',
          after: { lastSeenAt: '2026-10-02T12:00:00.000000', id: 'lead-1' },
        },
        auth,
      );

      expect(leads.count).not.toHaveBeenCalled();
    });

    it.each([
      ['an email', 'Lead1@Exemplo.com', { emailHash: 'email' }],
      ['a phone', '(11) 99999-8888', { phoneHash: 'phone' }],
    ])('searches by %s through its hash', async (_, search, kind) => {
      await useCase().execute({ expertId: 'expert-a', search }, auth);

      const expected =
        Object.keys(kind)[0] === 'emailHash'
          ? { emailHash: cipher.hash('email', 'lead1@exemplo.com') }
          : { phoneHash: cipher.hash('phone', '+5511999998888') };
      expect(leads.list).toHaveBeenCalledWith(
        expect.objectContaining(expected),
      );
    });

    it('rejects partial searches it cannot answer on encrypted data', async () => {
      await expect(
        useCase().execute({ expertId: 'expert-a', search: 'ana' }, auth),
      ).rejects.toMatchObject({ reason: 'VALIDATION_FAILED' });
    });

    it('hides experts from another tenant', async () => {
      experts.findByTenantIdAndId.mockResolvedValue(null);

      await expect(
        useCase().execute({ expertId: 'expert-a' }, auth),
      ).rejects.toMatchObject({
        reason: 'EXPERT_NOT_FOUND',
      });
      expect(leads.list).not.toHaveBeenCalled();
    });
  });

  describe('ExportLeadsUseCase', () => {
    const links = new LeadExportLinks();
    const useCase = () => new ExportLeadsUseCase(experts, leads, cipher, links);
    const collect = async (generator: AsyncGenerator<string>) => {
      let csv = '';
      for await (const chunk of generator) csv += chunk;
      return csv;
    };

    it.each([
      ['=HYPERLINK("http://x")', `"'=HYPERLINK(""http://x"")"`],
      ['+5511999998888', `'+5511999998888`],
      ['@cmd', `'@cmd`],
      ['Ana; Souza', '"Ana; Souza"'],
      ['Ana', 'Ana'],
      [null, ''],
    ])('escapes the cell %p', (value, expected) => {
      expect(csvCell(value)).toBe(expected);
    });

    it('streams a CSV for Excel in Portuguese, batch by batch', async () => {
      const firstBatch = Array.from({ length: 500 }, (_, i) => makeRow(i));
      leads.list
        .mockResolvedValueOnce(firstBatch)
        .mockResolvedValueOnce([makeRow(500)]);

      const csv = await collect(
        useCase().rows({
          tenantId: 'tenant-a',
          expertId: 'expert-a',
          launchId: null,
          userId: 'user-a',
          exp: 0,
        }),
      );
      const lines = csv.trimEnd().split('\r\n');

      expect(csv.charCodeAt(0)).toBe(0xfeff);
      expect(lines[0]).toBe(
        '﻿Nome;E-mail;Telefone;Origem;Outros campos;Lançamentos;Cadastros;Primeiro cadastro;Último cadastro;utm_source;utm_medium;utm_campaign;utm_content;utm_term;Consentimento',
      );
      expect(lines).toHaveLength(502);
      expect(lines[1]).toContain(
        "Lead 0;lead0@exemplo.com;'+5511999998888;Reels;Faturamento: 10k;Lançamento Março;2;",
      );
      expect(lines[1]).toMatch(/;instagram;;marco;;;Sim$/);
      expect(leads.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ after: firstBatch[499].cursor }),
      );
    });

    it('signs a short-lived link only for the experts of the tenant', async () => {
      const { url } = await useCase().createLink(
        { expertId: 'expert-a', launchId: 'launch-a' },
        auth,
      );
      const params = new URL(url, 'https://api.test').searchParams;

      expect(url.startsWith('/leads/exports/download?')).toBe(true);
      expect(links.verify(params.get('p'), params.get('s'))).toMatchObject({
        tenantId: 'tenant-a',
        expertId: 'expert-a',
        launchId: 'launch-a',
        userId: 'user-a',
      });
      expect(links.verify(params.get('p'), 'forged')).toBeNull();
      expect(
        links.verify(params.get('p'), params.get('s'), Date.now() + 6 * 60_000),
      ).toBeNull();
    });
  });
});
