/* eslint-disable @typescript-eslint/unbound-method */
import { DomainError } from '../../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../../auth/domain/types/AccessTokenClaims';
import type { ExpertsRepository } from '../../../../experts/domain/repositories/ExpertsRepository';
import type { LeadsRepository } from '../../../../leads/domain/repositories/LeadsRepository';
import { UserRole } from '../../../../users/domain/enums/UserRole';
import type { HeatSignalsRepository } from '../../../domain/repositories/HeatSignalsRepository';
import type { HeatDailySignals } from '../../../domain/services/HeatModel';
import { LeadHeatCalculator } from '../../services/LeadHeatCalculator';
import { GetLeadHeatUseCase } from '../GetLeadHeatUseCase';

const auth: AccessTokenClaims = {
  userId: 'user-a',
  sessionId: 'session-a',
  tenantId: 'tenant-a',
  role: UserRole.ADMIN,
};

const input = { expertId: 'expert-a', leadId: 'lead-a' };

const day = (
  date: string,
  overrides: Partial<HeatDailySignals> = {},
): HeatDailySignals => ({
  day: date,
  pageViews: 0,
  engagedSeconds: 0,
  maxScroll: 0,
  interactions: 0,
  leads: 0,
  linkClicks: 0,
  ...overrides,
});

describe('GetLeadHeatUseCase', () => {
  let experts: jest.Mocked<Pick<ExpertsRepository, 'findByTenantIdAndId'>>;
  let leads: jest.Mocked<Pick<LeadsRepository, 'findIdentities'>>;
  let signals: jest.Mocked<HeatSignalsRepository>;
  let useCase: GetLeadHeatUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-12T15:00:00Z'));
    experts = {
      findByTenantIdAndId: jest.fn().mockResolvedValue({ id: 'expert-a' }),
    };
    leads = {
      findIdentities: jest
        .fn()
        .mockResolvedValue({ anonymousIds: ['anon-1'], clickIds: ['click-1'] }),
    };
    signals = { findDailySignals: jest.fn().mockResolvedValue([]) };
    useCase = new GetLeadHeatUseCase(
      experts as unknown as ExpertsRepository,
      new LeadHeatCalculator(leads as unknown as LeadsRepository, signals),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects an expert from another tenant without touching leads or signals', async () => {
    experts.findByTenantIdAndId.mockResolvedValue(null);

    await expect(useCase.execute(input, auth)).rejects.toMatchObject({
      statusCode: 404,
      reason: 'EXPERT_NOT_FOUND',
    });

    expect(experts.findByTenantIdAndId).toHaveBeenCalledWith(
      'tenant-a',
      'expert-a',
    );
    expect(leads.findIdentities).not.toHaveBeenCalled();
    expect(signals.findDailySignals).not.toHaveBeenCalled();
  });

  it('rejects a lead that does not exist for the tenant and expert', async () => {
    leads.findIdentities.mockResolvedValue(null);

    const error: unknown = await useCase.execute(input, auth).catch((e) => e);

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ statusCode: 404, reason: 'LEAD_NOT_FOUND' });
    expect(leads.findIdentities).toHaveBeenCalledWith(
      'tenant-a',
      'expert-a',
      'lead-a',
    );
    expect(signals.findDailySignals).not.toHaveBeenCalled();
  });

  it('returns a cold heat without querying signals when the lead has no identities', async () => {
    leads.findIdentities.mockResolvedValue({ anonymousIds: [], clickIds: [] });

    await expect(useCase.execute(input, auth)).resolves.toEqual({
      score: 0,
      band: 'cold',
      hasIdentity: false,
      timezone: 'America/Sao_Paulo',
      windowDays: 30,
      lastActivityDay: null,
      days: [],
    });
    expect(signals.findDailySignals).not.toHaveBeenCalled();
  });

  it('computes score, band and last activity from the daily signals', async () => {
    const days = [
      day('2026-11-10', { pageViews: 1 }),
      day('2026-11-12', { leads: 1 }),
      day('2026-11-13'),
    ];
    signals.findDailySignals.mockResolvedValue(days);

    await expect(useCase.execute(input, auth)).resolves.toEqual({
      score: 22,
      band: 'warm',
      hasIdentity: true,
      timezone: 'America/Sao_Paulo',
      windowDays: 30,
      lastActivityDay: '2026-11-12',
      days,
    });
    expect(signals.findDailySignals).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      anonymousIds: ['anon-1'],
      clickIds: ['click-1'],
      timezone: 'America/Sao_Paulo',
      today: '2026-11-12',
      windowDays: 30,
    });
  });

  it('returns lastActivityDay null when every day is empty', async () => {
    signals.findDailySignals.mockResolvedValue([day('2026-11-12')]);

    await expect(useCase.execute(input, auth)).resolves.toMatchObject({
      score: 0,
      band: 'cold',
      hasIdentity: true,
      lastActivityDay: null,
    });
  });

  it('computes today in the Sao Paulo timezone near UTC midnight', async () => {
    jest.setSystemTime(new Date('2026-11-13T01:30:00Z'));

    await useCase.execute(input, auth);

    expect(signals.findDailySignals).toHaveBeenCalledWith(
      expect.objectContaining({ today: '2026-11-12' }),
    );
  });

  it('propagates signals repository failures', async () => {
    const failure = new Error('clickhouse down');
    signals.findDailySignals.mockRejectedValue(failure);

    await expect(useCase.execute(input, auth)).rejects.toBe(failure);
  });
});
