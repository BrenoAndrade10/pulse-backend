export const TRACKING_PAGES_REPOSITORY = Symbol('TRACKING_PAGES_REPOSITORY');

export type TrackingPageLaunch = {
  id: string;
  tenantId: string;
  expertId: string;
  pixelId: string;
  pageUrl: string;
  launchId: string | null;
};

export interface TrackingPagesRepository {
  /** Define (ou tira, com `null`) o lançamento dos cadastros da página. */
  setLaunch(page: TrackingPageLaunch): Promise<void>;
  /** Lançamento escolhido por página do pixel. */
  launchesByPage(pixelId: string): Promise<Map<string, string | null>>;
  /** O lançamento é do expert e não foi excluído. */
  launchBelongsToExpert(
    tenantId: string,
    expertId: string,
    launchId: string,
  ): Promise<boolean>;
  /**
   * Lançamento de um cadastro: o escolhido para a página; senão, o que
   * estava em andamento na data (se houver mais de um, o que começou por último).
   */
  resolveLaunch(input: {
    tenantId: string;
    expertId: string;
    pixelId: string;
    pageUrl: string;
    at: Date;
  }): Promise<string | null>;
}
