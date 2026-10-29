import type { Redis } from '@upstash/redis';
import { WhatsAppConnectionSecurity } from './WhatsAppConnectionSecurity';

describe('WhatsAppConnectionSecurity', () => {
  const redis = {
    set: jest.fn(),
    eval: jest.fn(),
  };
  let security: WhatsAppConnectionSecurity;

  beforeEach(() => {
    jest.clearAllMocks();
    security = new WhatsAppConnectionSecurity(redis as unknown as Redis);
  });

  it('uses NX and PX and releases only its token', async () => {
    redis.set.mockResolvedValue('OK');
    redis.eval.mockResolvedValue(1);

    const token = await security.acquire('456');
    expect(redis.set).toHaveBeenCalledWith(
      'meta:whatsapp-connection-lock:456',
      token,
      { nx: true, px: 120_000 },
    );
    await security.release('456', token as string);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get', KEYS[1])"),
      ['meta:whatsapp-connection-lock:456'],
      [token],
    );
  });

  it('returns null when the phone lock is held', async () => {
    redis.set.mockResolvedValue(null);
    await expect(security.acquire('456')).resolves.toBeNull();
  });
});
