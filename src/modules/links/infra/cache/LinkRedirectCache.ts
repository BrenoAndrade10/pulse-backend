import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from '@upstash/redis';
import { REDIS_CLIENT } from '../../../../shared/infra/redis/tokens';
import { LinkStatus } from '../../domain/enums/LinkStatus';
import type {
  LinkRedirectCache as LinkRedirectCachePort,
  LinkRedirectEntry,
} from '../../domain/services/LinkRedirectCache';

const L1_TTL_MS = 15_000;
const POSITIVE_TTL_SECONDS = 900;
const NEGATIVE_TTL_SECONDS = 60;
const DEFAULT_MAX_ENTRIES = 5000;

@Injectable()
export class LinkRedirectCache implements LinkRedirectCachePort {
  private readonly logger = new Logger(LinkRedirectCache.name);
  private readonly l1 = new Map<
    string,
    { entry: LinkRedirectEntry; expiresAt: number }
  >();
  private readonly maxEntries = DEFAULT_MAX_ENTRIES;
  private warnedAt = 0;
  private redisDisabledUntil = 0;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get(code: string): Promise<LinkRedirectEntry | null> {
    const local = this.l1.get(code);
    if (local) {
      if (local.expiresAt > Date.now()) {
        this.l1.delete(code);
        this.l1.set(code, local);
        return local.entry;
      }
      this.l1.delete(code);
    }

    if (this.redisDisabledUntil > Date.now()) return null;
    try {
      const key = this.key(code);
      const raw = await this.redis.get<unknown>(key);
      if (raw === null || raw === undefined) return null;
      const entry = this.parse(raw);
      if (!entry) return null;
      void this.redis
        .expire(key, this.ttlFor(entry))
        .catch(() => this.redisUnavailable());
      this.setLocal(code, entry);
      return entry;
    } catch {
      this.warnUnavailable();
      return null;
    }
  }

  async set(code: string, entry: LinkRedirectEntry): Promise<void> {
    this.setLocal(code, entry);
    if (this.redisDisabledUntil > Date.now()) return;
    try {
      await this.redis.set(this.key(code), JSON.stringify(entry), {
        ex: this.ttlFor(entry),
      });
    } catch {
      this.warnUnavailable();
    }
  }

  async invalidate(code: string): Promise<void> {
    this.l1.delete(code);
    if (this.redisDisabledUntil > Date.now()) return;
    try {
      await this.redis.del(this.key(code));
    } catch {
      this.warnUnavailable();
    }
  }

  private setLocal(code: string, entry: LinkRedirectEntry): void {
    this.l1.delete(code);
    this.l1.set(code, { entry, expiresAt: Date.now() + L1_TTL_MS });
    while (this.l1.size > this.maxEntries) {
      const oldest = this.l1.keys().next().value as string | undefined;
      if (!oldest) break;
      this.l1.delete(oldest);
    }
  }

  private parse(raw: unknown): LinkRedirectEntry | null {
    try {
      const value: unknown =
        typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
      if (
        !value ||
        typeof value !== 'object' ||
        (value as { v?: unknown }).v !== 1
      )
        return null;
      if ((value as { missing?: unknown }).missing === true)
        return { v: 1, missing: true };
      const entry = value as Partial<
        Exclude<LinkRedirectEntry, { missing: true }>
      >;
      if (
        typeof entry.id !== 'string' ||
        typeof entry.tenantId !== 'string' ||
        typeof entry.destinationUrl !== 'string' ||
        typeof entry.destinationVersion !== 'number' ||
        !entry.utm
      )
        return null;
      return value as LinkRedirectEntry;
    } catch {
      return null;
    }
  }

  private ttlFor(entry: LinkRedirectEntry | null): number {
    return entry &&
      !('missing' in entry) &&
      entry.status !== ('inactive' as LinkStatus)
      ? POSITIVE_TTL_SECONDS
      : NEGATIVE_TTL_SECONDS;
  }

  private key(code: string): string {
    return `link:redirect:${code}`;
  }

  private warnUnavailable(): void {
    if (Date.now() - this.warnedAt < 30_000) return;
    this.warnedAt = Date.now();
    this.logger.warn('LINK_REDIRECT_REDIS_UNAVAILABLE');
    this.redisDisabledUntil = Date.now() + 30_000;
  }

  private redisUnavailable(): void {
    this.warnUnavailable();
  }
}
