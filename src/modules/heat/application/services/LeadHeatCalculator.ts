import { Inject, Injectable, Logger } from '@nestjs/common';
import { LEADS_REPOSITORY } from '../../../leads/domain/repositories/LeadsRepository';
import type { LeadsRepository } from '../../../leads/domain/repositories/LeadsRepository';
import { HEAT_DEFAULT_TIMEZONE } from '../../domain/heatTimezone';
import { HEAT_SIGNALS_REPOSITORY } from '../../domain/repositories/HeatSignalsRepository';
import type { HeatSignalsRepository } from '../../domain/repositories/HeatSignalsRepository';
import { computeHeat, HEAT_CONFIG } from '../../domain/services/HeatModel';
import type {
  HeatBand,
  HeatDailySignals,
} from '../../domain/services/HeatModel';

export type LeadHeatCalculateInput = {
  tenantId: string;
  expertId: string;
  leadId: string;
  now?: Date;
};

export type LeadHeatCalculation = {
  score: number;
  band: HeatBand;
  hasIdentity: boolean;
  timezone: string;
  windowDays: number;
  lastActivityDay: string | null;
  days: HeatDailySignals[];
};

export function todayInTimezone(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function hasSignal(day: HeatDailySignals): boolean {
  return (
    day.pageViews > 0 ||
    day.engagedSeconds > 0 ||
    day.maxScroll > 0 ||
    day.interactions > 0 ||
    day.leads > 0 ||
    day.linkClicks > 0
  );
}

@Injectable()
export class LeadHeatCalculator {
  private readonly logger = new Logger(LeadHeatCalculator.name);

  constructor(
    @Inject(LEADS_REPOSITORY)
    private readonly leads: LeadsRepository,

    @Inject(HEAT_SIGNALS_REPOSITORY)
    private readonly signals: HeatSignalsRepository,
  ) {}

  async calculate(
    input: LeadHeatCalculateInput,
  ): Promise<LeadHeatCalculation | null> {
    const { tenantId, expertId, leadId } = input;
    const identities = await this.leads.findIdentities(
      tenantId,
      expertId,
      leadId,
    );
    if (!identities) return null;

    const timezone = HEAT_DEFAULT_TIMEZONE;
    const windowDays = HEAT_CONFIG.decay.halfFactorMaxAgeDays;

    if (
      identities.anonymousIds.length === 0 &&
      identities.clickIds.length === 0
    ) {
      return {
        score: 0,
        band: 'cold',
        hasIdentity: false,
        timezone,
        windowDays,
        lastActivityDay: null,
        days: [],
      };
    }

    const today = todayInTimezone(input.now ?? new Date(), timezone);

    let days: HeatDailySignals[];
    try {
      days = await this.signals.findDailySignals({
        tenantId,
        anonymousIds: identities.anonymousIds,
        clickIds: identities.clickIds,
        timezone,
        today,
        windowDays,
      });
    } catch (error) {
      this.logger.error(
        `Falha ao buscar sinais do lead ${leadId} (empresa ${tenantId}, expert ${expertId}).`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    const { score, band } = computeHeat(days, today);
    const lastActivityDay = days
      .filter(hasSignal)
      .reduce<string | null>(
        (last, day) => (last === null || day.day > last ? day.day : last),
        null,
      );

    return {
      score,
      band,
      hasIdentity: true,
      timezone,
      windowDays,
      lastActivityDay,
      days,
    };
  }
}
