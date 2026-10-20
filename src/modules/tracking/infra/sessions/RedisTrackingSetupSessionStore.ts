import type { Redis } from '@upstash/redis';
import type {
  TrackingSetupSession,
  TrackingSetupSessionStore,
} from '../../domain/repositories/TrackingSetupSessionStore';

export class RedisTrackingSetupSessionStore implements TrackingSetupSessionStore {
  constructor(private readonly redis: Redis) {}

  async save(
    token: string,
    session: TrackingSetupSession,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(this.key(token), JSON.stringify(session), {
      ex: ttlSeconds,
    });
  }

  async touch(
    token: string,
    ttlSeconds: number,
  ): Promise<TrackingSetupSession | null> {
    const raw = await this.redis.get<unknown>(this.key(token));
    if (raw === null || raw === undefined) return null;

    // O cliente do Upstash pode já devolver o JSON desserializado.
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!this.isSession(value)) return null;

    await this.redis.expire(this.key(token), ttlSeconds);
    return value;
  }

  private isSession(value: unknown): value is TrackingSetupSession {
    const session = value as Partial<TrackingSetupSession> | null;
    return (
      typeof session?.tenantId === 'string' &&
      typeof session.expertId === 'string' &&
      typeof session.pixelId === 'string' &&
      typeof session.userId === 'string' &&
      typeof session.url === 'string'
    );
  }

  private key(token: string): string {
    return `tracking:setup-session:${token}`;
  }
}
