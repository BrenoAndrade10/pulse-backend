/* eslint-disable @typescript-eslint/unbound-method */
import type { LeadsRepository } from '../../../../leads/domain/repositories/LeadsRepository';
import type { HeatSignalsRepository } from '../../../domain/repositories/HeatSignalsRepository';
import { LeadHeatCalculator } from '../LeadHeatCalculator';

const input = {
  tenantId: 'tenant-a',
  expertId: 'expert-a',
  leadId: 'lead-a',
  now: new Date('2026-11-12T15:00:00Z'),
};

describe('LeadHeatCalculator', () => {
  let leads: jest.Mocked<Pick<LeadsRepository, 'findIdentities'>>;
  let signals: jest.Mocked<HeatSignalsRepository>;
  let calculator: LeadHeatCalculator;

  beforeEach(() => {
    leads = {
      findIdentities: jest
        .fn()
        .mockResolvedValue({ anonymousIds: ['anon-1'], clickIds: [] }),
    };
    signals = { findDailySignals: jest.fn().mockResolvedValue([]) };
    calculator = new LeadHeatCalculator(
      leads as unknown as LeadsRepository,
      signals,
    );
  });

  it('returns null when the lead does not exist for the tenant and expert', async () => {
    leads.findIdentities.mockResolvedValue(null);

    await expect(calculator.calculate(input)).resolves.toBeNull();
    expect(signals.findDailySignals).not.toHaveBeenCalled();
  });

  it('skips the signals source when there are no identities', async () => {
    leads.findIdentities.mockResolvedValue({ anonymousIds: [], clickIds: [] });

    await expect(calculator.calculate(input)).resolves.toMatchObject({
      score: 0,
      band: 'cold',
      hasIdentity: false,
    });
    expect(signals.findDailySignals).not.toHaveBeenCalled();
  });

  it('uses the given now to pick today', async () => {
    await calculator.calculate({
      ...input,
      now: new Date('2026-11-13T01:30:00Z'),
    });

    expect(signals.findDailySignals).toHaveBeenCalledWith(
      expect.objectContaining({ today: '2026-11-12' }),
    );
  });

  it('rethrows signals failures', async () => {
    const failure = new Error('clickhouse down');
    signals.findDailySignals.mockRejectedValue(failure);

    await expect(calculator.calculate(input)).rejects.toBe(failure);
  });
});
