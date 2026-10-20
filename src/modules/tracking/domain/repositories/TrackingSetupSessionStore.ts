export const TRACKING_SETUP_SESSION_STORE = Symbol(
  'TRACKING_SETUP_SESSION_STORE',
);

/** Quem abriu o modo de configuração e para qual página. */
export type TrackingSetupSession = {
  tenantId: string;
  expertId: string;
  pixelId: string;
  userId: string;
  url: string;
};

export interface TrackingSetupSessionStore {
  save(
    token: string,
    session: TrackingSetupSession,
    ttlSeconds: number,
  ): Promise<void>;
  /** Sessão válida do token, renovando a validade a cada uso. */
  touch(
    token: string,
    ttlSeconds: number,
  ): Promise<TrackingSetupSession | null>;
}
