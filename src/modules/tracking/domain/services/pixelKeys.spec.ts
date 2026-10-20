import { generatePixelKey, generateSetupToken } from './pixelKeys';

describe('pixelKeys', () => {
  it('generates public keys in the stored format', () => {
    const keys = new Set(Array.from({ length: 200 }, generatePixelKey));

    expect(keys.size).toBe(200);
    keys.forEach((key) => expect(key).toMatch(/^PX_[A-Za-z0-9]{20}$/));
  });

  it('generates URL-safe setup tokens with 256 bits', () => {
    const token = generateSetupToken();

    expect(token).toMatch(/^[\w-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });
});
