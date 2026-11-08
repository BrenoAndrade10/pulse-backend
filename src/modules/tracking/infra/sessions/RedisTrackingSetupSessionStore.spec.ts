import type { Redis } from '@upstash/redis';
import type { TrackingSetupSession } from '../../domain/repositories/TrackingSetupSessionStore';
import { RedisTrackingSetupSessionStore } from './RedisTrackingSetupSessionStore';

class FakeRedis {
  readonly values = new Map<string, unknown>();
  readonly sets = new Map<string, Set<string>>();

  multi() {
    const steps: (() => void)[] = [];
    const chain = {
      set: (key: string, value: unknown) => {
        steps.push(() => this.values.set(key, value));
        return chain;
      },
      sadd: (key: string, member: string) => {
        steps.push(() =>
          this.sets.set(key, (this.sets.get(key) ?? new Set()).add(member)),
        );
        return chain;
      },
      expire: () => chain,
      exec: () => {
        steps.forEach((step) => step());
        return Promise.resolve([]);
      },
    };
    return chain;
  }

  get(key: string) {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  expire() {
    return Promise.resolve(1);
  }

  smembers(key: string) {
    return Promise.resolve([...(this.sets.get(key) ?? [])]);
  }

  del(...keys: string[]) {
    for (const key of keys) {
      this.values.delete(key);
      this.sets.delete(key);
    }
    return Promise.resolve(keys.length);
  }
}

const session = (pixelId: string): TrackingSetupSession => ({
  tenantId: 'tenant-a',
  expertId: 'expert-a',
  pixelId,
  userId: 'user-a',
  authSessionId: 'login-a',
  url: 'https://meusite.com.br/vendas',
  createdAt: new Date().toISOString(),
});

describe('RedisTrackingSetupSessionStore', () => {
  let redis: FakeRedis;
  let store: RedisTrackingSetupSessionStore;
  const token = 'a'.repeat(43);

  beforeEach(() => {
    redis = new FakeRedis();
    store = new RedisTrackingSetupSessionStore(redis as unknown as Redis);
  });

  it('never stores the token itself', async () => {
    await store.save(token, session('pixel-a'), 600);

    const stored = [...redis.values.keys(), ...redis.sets.keys()].join();
    expect(stored).not.toContain(token);
    await expect(store.touch(token, 3600)).resolves.toMatchObject({
      pixelId: 'pixel-a',
    });
  });

  it('revokes every session of a pixel and keeps the others', async () => {
    const other = 'b'.repeat(43);
    const third = 'c'.repeat(43);
    await store.save(token, session('pixel-a'), 600);
    await store.save(other, session('pixel-a'), 600);
    await store.save(third, session('pixel-b'), 600);

    await store.revokeByPixel('pixel-a');

    await expect(store.touch(token, 3600)).resolves.toBeNull();
    await expect(store.touch(other, 3600)).resolves.toBeNull();
    await expect(store.touch(third, 3600)).resolves.not.toBeNull();
  });

  it('refuses sessions saved before the login link existed', async () => {
    const legacy: Partial<TrackingSetupSession> = session('pixel-a');
    delete legacy.authSessionId;
    await store.save(token, legacy as TrackingSetupSession, 600);

    await expect(store.touch(token, 3600)).resolves.toBeNull();
  });
});
