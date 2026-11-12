/* eslint-disable @typescript-eslint/unbound-method */
import type { LeadsRepository } from '../../../../leads/domain/repositories/LeadsRepository';
import type {
  LeadHeatCalculation,
  LeadHeatCalculator,
} from '../LeadHeatCalculator';
import { RecalculateLeadHeatService } from '../RecalculateLeadHeatService';

const now = new Date('2026-11-12T15:00:00Z');

const calculation = (score: number): LeadHeatCalculation => ({
  score,
  band: score >= 50 ? 'hot' : 'warm',
  hasIdentity: true,
  timezone: 'America/Sao_Paulo',
  windowDays: 30,
  lastActivityDay: null,
  days: [],
});

const candidates = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    leadId: `lead-${i}`,
  }));

describe('RecalculateLeadHeatService', () => {
  let leads: jest.Mocked<
    Pick<LeadsRepository, 'updateHeat' | 'listHeatCandidates'>
  >;
  let calculator: jest.Mocked<Pick<LeadHeatCalculator, 'calculate'>>;
  let service: RecalculateLeadHeatService;

  beforeEach(() => {
    leads = {
      updateHeat: jest.fn().mockResolvedValue(true),
      listHeatCandidates: jest.fn().mockResolvedValue([]),
    };
    calculator = { calculate: jest.fn().mockResolvedValue(calculation(60)) };
    service = new RecalculateLeadHeatService(
      leads as unknown as LeadsRepository,
      calculator as unknown as LeadHeatCalculator,
    );
  });

  describe('recalculateLead', () => {
    it('returns null and writes nothing when the lead does not exist', async () => {
      calculator.calculate.mockResolvedValue(null);

      await expect(
        service.recalculateLead('tenant-a', 'expert-a', 'lead-a', now),
      ).resolves.toBeNull();
      expect(leads.updateHeat).not.toHaveBeenCalled();
    });

    it('persists score, band and calculation time scoped to the owner', async () => {
      const result = await service.recalculateLead(
        'tenant-a',
        'expert-a',
        'lead-a',
        now,
      );

      expect(result).toEqual(calculation(60));
      expect(calculator.calculate).toHaveBeenCalledWith({
        tenantId: 'tenant-a',
        expertId: 'expert-a',
        leadId: 'lead-a',
        now,
      });
      expect(leads.updateHeat).toHaveBeenCalledWith(
        'tenant-a',
        'expert-a',
        'lead-a',
        { score: 60, band: 'hot', calculatedAt: now },
      );
    });
  });

  describe('recalculateStale', () => {
    const staleBefore = new Date('2026-11-12T00:00:00Z');

    it('does nothing with an empty candidate list', async () => {
      await expect(
        service.recalculateStale({ staleBefore, limit: 10, now }),
      ).resolves.toEqual({ processed: 0, failed: 0 });
      expect(leads.listHeatCandidates).toHaveBeenCalledWith({
        staleBefore,
        limit: 10,
      });
      expect(calculator.calculate).not.toHaveBeenCalled();
    });

    it('processes every candidate and writes each one', async () => {
      leads.listHeatCandidates.mockResolvedValue(candidates(3));

      await expect(
        service.recalculateStale({ staleBefore, limit: 10, now }),
      ).resolves.toEqual({ processed: 3, failed: 0 });
      expect(leads.updateHeat).toHaveBeenCalledTimes(3);
    });

    it('isolates a failing lead and keeps processing the others', async () => {
      leads.listHeatCandidates.mockResolvedValue(candidates(3));
      calculator.calculate.mockImplementation(({ leadId }) =>
        leadId === 'lead-1'
          ? Promise.reject(new Error('clickhouse down'))
          : Promise.resolve(calculation(10)),
      );

      await expect(
        service.recalculateStale({ staleBefore, limit: 10, now }),
      ).resolves.toEqual({ processed: 2, failed: 1 });
      expect(leads.updateHeat).toHaveBeenCalledTimes(2);
      expect(leads.updateHeat).not.toHaveBeenCalledWith(
        'tenant-a',
        'expert-a',
        'lead-1',
        expect.anything(),
      );
    });

    it('writes nothing when every lead fails', async () => {
      leads.listHeatCandidates.mockResolvedValue(candidates(4));
      calculator.calculate.mockRejectedValue(new Error('clickhouse down'));

      await expect(
        service.recalculateStale({ staleBefore, limit: 10, now }),
      ).resolves.toEqual({ processed: 0, failed: 4 });
      expect(leads.updateHeat).not.toHaveBeenCalled();
    });

    it.each([
      [undefined, 5],
      [2, 2],
      [100, 20],
      [0, 1],
    ])(
      'with concurrency %p never runs more than %p at once',
      async (concurrency, expectedMax) => {
        leads.listHeatCandidates.mockResolvedValue(candidates(60));
        let running = 0;
        let peak = 0;
        calculator.calculate.mockImplementation(async () => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((resolve) => setImmediate(resolve));
          running -= 1;
          return calculation(10);
        });

        await service.recalculateStale({
          staleBefore,
          limit: 60,
          concurrency,
          now,
        });

        expect(peak).toBe(expectedMax);
      },
    );
  });
});
