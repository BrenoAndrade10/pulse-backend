import type { Redis } from '@upstash/redis';
import { createHash } from 'node:crypto';
import { SETUP_SESSION_MAX_AGE_SECONDS } from '../../application/resolveSetupSession';
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
    const id = this.id(token);
    await this.redis
      .multi()
      .set(this.key(id), JSON.stringify(session), { ex: ttlSeconds })
      .sadd(this.pixelKey(session.pixelId), id)
      .expire(this.pixelKey(session.pixelId), SETUP_SESSION_MAX_AGE_SECONDS)
      .exec();
  }

  async touch(
    token: string,
    ttlSeconds: number,
  ): Promise<TrackingSetupSession | null> {
    const key = this.key(this.id(token));
    const raw = await this.redis.get<unknown>(key);
    if (raw === null || raw === undefined) return null;

    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!this.isSession(value)) return null;

    await this.redis.expire(key, ttlSeconds);
    return value;
  }

  async revokeByPixel(pixelId: string): Promise<void> {
    const ids = await this.redis.smembers(this.pixelKey(pixelId));
    await this.redis.del(
      this.pixelKey(pixelId),
      ...ids.map((id) => this.key(id)),
    );
  }

  private isSession(value: unknown): value is TrackingSetupSession {
    const session = value as Partial<TrackingSetupSession> | null;
    return (
      typeof session?.tenantId === 'string' &&
      typeof session.expertId === 'string' &&
      typeof session.pixelId === 'string' &&
      typeof session.userId === 'string' &&
      typeof session.authSessionId === 'string' &&
      typeof session.url === 'string' &&
      typeof session.createdAt === 'string'
    );
  }

  private id(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private key(id: string): string {
    return `tracking:setup-session:${id}`;
  }

  private pixelKey(pixelId: string): string {
    return `tracking:setup-sessions:pixel:${pixelId}`;
  }
}
