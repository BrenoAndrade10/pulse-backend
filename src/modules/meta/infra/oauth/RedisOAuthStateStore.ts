import type { Redis } from '@upstash/redis';
import type {
  InstagramOAuthState,
  OAuthStateStore,
} from '../../domain/repositories/OAuthStateStore';

export class RedisOAuthStateStore implements OAuthStateStore {
  constructor(private readonly redis: Redis) {}

  async save(
    state: string,
    payload: InstagramOAuthState,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(this.key(state), JSON.stringify(payload), {
      ex: ttlSeconds,
    });
  }

  async consume(state: string): Promise<InstagramOAuthState | null> {
    const raw = await this.redis.getdel<unknown>(this.key(state));

    if (raw === null || raw === undefined) return null;

    // O cliente do Upstash pode já devolver o JSON desserializado.
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;

    return this.isState(value) ? value : null;
  }

  private key(state: string): string {
    return `meta:instagram-oauth-state:${state}`;
  }

  private isState(value: unknown): value is InstagramOAuthState {
    const candidate = value as Partial<InstagramOAuthState> | null;

    return (
      typeof candidate?.tenantId === 'string' &&
      typeof candidate.userId === 'string' &&
      typeof candidate.expertId === 'string'
    );
  }
}
