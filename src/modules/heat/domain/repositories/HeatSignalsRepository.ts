import type { HeatDailySignals } from '../services/HeatModel';

export const HEAT_SIGNALS_REPOSITORY = Symbol('HEAT_SIGNALS_REPOSITORY');

export type HeatSignalsQuery = {
  tenantId: string;
  anonymousIds: string[];
  clickIds: string[];
  timezone: string;
  today: string;
  windowDays: number;
};

export interface HeatSignalsRepository {
  findDailySignals(query: HeatSignalsQuery): Promise<HeatDailySignals[]>;
}
