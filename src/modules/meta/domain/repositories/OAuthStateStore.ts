export const OAUTH_STATE_STORE = Symbol('OAUTH_STATE_STORE');

/** Quem iniciou a conexão; recuperado no callback a partir do `state`. */
export type InstagramOAuthState = {
  tenantId: string;
  userId: string;
  expertId: string;
};

export interface OAuthStateStore {
  save(
    state: string,
    payload: InstagramOAuthState,
    ttlSeconds: number,
  ): Promise<void>;
  /** Lê e apaga numa única operação: cada `state` só pode ser usado uma vez. */
  consume(state: string): Promise<InstagramOAuthState | null>;
}
