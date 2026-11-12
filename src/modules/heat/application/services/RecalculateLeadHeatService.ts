import { Inject, Injectable, Logger } from '@nestjs/common';
import { LEADS_REPOSITORY } from '../../../leads/domain/repositories/LeadsRepository';
import type { LeadsRepository } from '../../../leads/domain/repositories/LeadsRepository';
import { LeadHeatCalculator } from './LeadHeatCalculator';
import type { LeadHeatCalculation } from './LeadHeatCalculator';

export const DEFAULT_RECALCULATE_CONCURRENCY = 5;
const MAX_RECALCULATE_CONCURRENCY = 20;

export type RecalculateStaleInput = {
  staleBefore: Date;
  limit: number;
  concurrency?: number;
  now?: Date;
};

export type RecalculateStaleOutput = { processed: number; failed: number };

@Injectable()
export class RecalculateLeadHeatService {
  private readonly logger = new Logger(RecalculateLeadHeatService.name);

  constructor(
    @Inject(LEADS_REPOSITORY)
    private readonly leads: LeadsRepository,

    private readonly calculator: LeadHeatCalculator,
  ) {}

  async recalculateLead(
    tenantId: string,
    expertId: string,
    leadId: string,
    now: Date = new Date(),
  ): Promise<LeadHeatCalculation | null> {
    const result = await this.calculator.calculate({
      tenantId,
      expertId,
      leadId,
      now,
    });
    if (!result) return null;

    await this.leads.updateHeat(tenantId, expertId, leadId, {
      score: result.score,
      band: result.band,
      calculatedAt: now,
    });
    return result;
  }

  async recalculateStale(
    input: RecalculateStaleInput,
  ): Promise<RecalculateStaleOutput> {
    const candidates = await this.leads.listHeatCandidates({
      staleBefore: input.staleBefore,
      limit: input.limit,
    });
    if (candidates.length === 0) return { processed: 0, failed: 0 };

    const concurrency = Math.min(
      Math.max(
        Math.trunc(input.concurrency ?? DEFAULT_RECALCULATE_CONCURRENCY) || 1,
        1,
      ),
      MAX_RECALCULATE_CONCURRENCY,
    );
    const now = input.now ?? new Date();

    let processed = 0;
    let failed = 0;
    let next = 0;

    const worker = async (): Promise<void> => {
      while (next < candidates.length) {
        const candidate = candidates[next++];
        try {
          await this.recalculateLead(
            candidate.tenantId,
            candidate.expertId,
            candidate.leadId,
            now,
          );
          processed += 1;
        } catch (error) {
          failed += 1;
          this.logger.error(
            `Falha ao recalcular o calor do lead ${candidate.leadId} (empresa ${candidate.tenantId}, expert ${candidate.expertId}).`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, candidates.length) }, worker),
    );

    return { processed, failed };
  }
}
