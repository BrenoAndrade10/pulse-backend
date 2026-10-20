import type { TrackingRule } from '../entities/TrackingRule';

export const TRACKING_RULES_REPOSITORY = Symbol('TRACKING_RULES_REPOSITORY');

export type TrackingPageSummary = {
  url: string;
  eventsCount: number;
  updatedAt: Date;
  /** Preenchido pelo GetTrackingPixelUseCase a partir de tracking_pages. */
  launchId?: string | null;
};

export interface TrackingRulesRepository {
  create(rule: TrackingRule): Promise<TrackingRule>;
  /** Regras que valem na página: as criadas nela e as do site todo. */
  findForPage(pixelId: string, pageUrl: string): Promise<TrackingRule[]>;
  countByPixel(pixelId: string): Promise<number>;
  /** Todas as regras do pixel (configuração que o script baixa). */
  findByPixel(pixelId: string): Promise<TrackingRule[]>;
  delete(pixelId: string, ruleId: string): Promise<boolean>;
  pagesByPixel(pixelId: string): Promise<TrackingPageSummary[]>;
}
