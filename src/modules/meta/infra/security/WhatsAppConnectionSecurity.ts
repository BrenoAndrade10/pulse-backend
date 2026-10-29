import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from '@upstash/redis';
import { randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from '../../../../shared/infra/redis/tokens';

const LOCK_TTL_MS = 120_000;
const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

@Injectable()
export class WhatsAppConnectionSecurity {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async acquire(phoneNumberId: string): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(this.lockKey(phoneNumberId), token, {
      nx: true,
      px: LOCK_TTL_MS,
    });
    return result === 'OK' ? token : null;
  }

  async release(phoneNumberId: string, token: string): Promise<void> {
    await this.redis.eval(
      RELEASE_LOCK_SCRIPT,
      [this.lockKey(phoneNumberId)],
      [token],
    );
  }

  private lockKey(phoneNumberId: string): string {
    return `meta:whatsapp-connection-lock:${phoneNumberId}`;
  }
}
