import { generate } from 'otplib';
import { TotpService } from './TotpService';

describe('TotpService', () => {
  const now = 1_800_000_000_000;
  let service: TotpService;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    service = new TotpService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a 20-byte Base32 secret and a compatible URI', () => {
    const secret = service.generateSecret();
    const uri = service.keyUri('user@example.com', secret);

    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(uri).toBe(
      `otpauth://totp/Pulse%20Lead:user%40example.com?secret=${secret}&issuer=Pulse%20Lead&algorithm=SHA1&digits=6&period=30`,
    );
  });

  it('accepts a valid code and returns its step', async () => {
    const secret = service.generateSecret();
    const epoch = Math.floor(now / 1000);
    const code = await generate({ secret, epoch });

    await expect(service.verify(secret, code, null)).resolves.toEqual({
      valid: true,
      step: Math.floor(epoch / 30),
    });
  });

  it.each([-30, 30])(
    'accepts a code at the %+d second window',
    async (drift) => {
      const secret = service.generateSecret();
      const code = await generate({
        secret,
        epoch: Math.floor(now / 1000) + drift,
      });

      await expect(service.verify(secret, code, null)).resolves.toMatchObject({
        valid: true,
      });
    },
  );

  it('rejects an invalid format before verification', async () => {
    await expect(service.verify('unused', '12 3456', null)).resolves.toEqual({
      valid: false,
      step: null,
    });
  });

  it('rejects a replayed step', async () => {
    const secret = service.generateSecret();
    const epoch = Math.floor(now / 1000);
    const step = Math.floor(epoch / 30);
    const code = await generate({ secret, epoch });

    await expect(service.verify(secret, code, step)).resolves.toEqual({
      valid: false,
      step: null,
    });
  });
});
