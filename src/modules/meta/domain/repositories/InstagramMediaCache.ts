export const INSTAGRAM_MEDIA_CACHE = Symbol('INSTAGRAM_MEDIA_CACHE');

/** Página de mídias já convertida, sem token e sem URLs de paginação da Meta. */
export type CachedMediaPage<TPost> = {
  data: TPost[];
  after?: string;
};

/**
 * Cache curto das páginas de mídia da Meta. Falhas do cache nunca derrubam a
 * listagem: quem usa deve tratar `get` vazio como "buscar na Meta".
 */
export interface InstagramMediaCache {
  get<TPost>(key: string): Promise<CachedMediaPage<TPost> | null>;
  set<TPost>(key: string, page: CachedMediaPage<TPost>): Promise<void>;
}
