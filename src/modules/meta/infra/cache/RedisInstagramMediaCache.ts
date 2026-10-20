import { Logger } from '@nestjs/common';
import type { Redis } from '@upstash/redis';
import type {
  CachedMediaPage,
  InstagramMediaCache,
} from '../../domain/repositories/InstagramMediaCache';

/**
 * 2 minutos: abrir de novo, buscar e paginar ficam instantâneos, e as URLs de
 * mídia da Meta (assinadas e temporárias) continuam válidas.
 */
const TTL_SECONDS = 120;

export class RedisInstagramMediaCache implements InstagramMediaCache {
  private readonly logger = new Logger(RedisInstagramMediaCache.name);

  constructor(private readonly redis: Redis) {}

  async get<TPost>(key: string): Promise<CachedMediaPage<TPost> | null> {
    try {
      const raw = await this.redis.get<unknown>(this.key(key));
      if (raw === null || raw === undefined) return null;

      // O cliente do Upstash pode já devolver o JSON desserializado.
      const value = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {
        data?: unknown;
      };

      return Array.isArray(value?.data)
        ? (value as CachedMediaPage<TPost>)
        : null;
    } catch (error) {
      this.logger.warn(`Cache de mídias indisponível: ${String(error)}`);
      return null;
    }
  }

  async set<TPost>(key: string, page: CachedMediaPage<TPost>): Promise<void> {
    try {
      await this.redis.set(this.key(key), JSON.stringify(page), {
        ex: TTL_SECONDS,
      });
    } catch (error) {
      this.logger.warn(`Cache de mídias indisponível: ${String(error)}`);
    }
  }

  private key(key: string): string {
    // v2: carrosséis com `children` em camelCase.
    return `meta:instagram-media:v2:${key}`;
  }
}
