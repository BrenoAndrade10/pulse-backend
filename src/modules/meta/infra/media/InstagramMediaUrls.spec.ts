import { Environment } from '../../../../config/Environment';
import { InstagramMediaUrls, isMetaCdnUrl } from './InstagramMediaUrls';

describe('InstagramMediaUrls', () => {
  const cdn = 'https://scontent-gru1-1.cdninstagram.com/v/t51/photo.jpg?oe=1';
  const urls = new InstagramMediaUrls();
  const parse = (link: string) =>
    Object.fromEntries(new URL(link, 'https://api.test').searchParams);

  beforeEach(() => {
    Environment.vars = {
      JWT_SECRET: 'test-secret-with-at-least-32-characters!',
    } as typeof Environment.vars;
  });

  it('signs Meta CDN URLs and verifies them back', () => {
    const link = urls.sign(cdn)!;
    const { u, e, s } = parse(link);

    expect(link.startsWith('/meta/media?')).toBe(true);
    expect(urls.verify(u, e, s)).toBe(cdn);
  });

  it('refuses tampered URLs, signatures and expirations', () => {
    const { u, e, s } = parse(urls.sign(cdn)!);
    const other = Buffer.from(
      'https://scontent.cdninstagram.com/x.jpg',
    ).toString('base64url');

    expect(urls.verify(other, e, s)).toBeNull();
    expect(urls.verify(u, String(Number(e) + 60), s)).toBeNull();
    expect(urls.verify(u, e, `${s.slice(0, -2)}AA`)).toBeNull();
    expect(urls.verify(u, e, undefined)).toBeNull();
  });

  it('refuses expired links', () => {
    const issuedAt = Date.now() - 2 * 3600 * 1000;
    const { u, e, s } = parse(urls.sign(cdn, issuedAt)!);

    expect(urls.verify(u, e, s)).toBeNull();
  });

  it('does not accept links signed with another secret', () => {
    const { u, e, s } = parse(urls.sign(cdn)!);
    Environment.vars.JWT_SECRET = 'another-secret-with-at-least-32-chars!!';

    expect(urls.verify(u, e, s)).toBeNull();
  });

  it('only proxies HTTPS Meta CDNs', () => {
    expect(urls.sign('https://evil.com/x.jpg')).toBeUndefined();
    expect(urls.sign(undefined)).toBeUndefined();
    expect(isMetaCdnUrl('https://video.xx.fbcdn.net/v.mp4')).toBe(true);
    expect(isMetaCdnUrl('http://scontent.cdninstagram.com/x.jpg')).toBe(false);
    expect(isMetaCdnUrl('https://cdninstagram.com.evil.com/x.jpg')).toBe(false);
    expect(isMetaCdnUrl('https://evilcdninstagram.com/x.jpg')).toBe(false);
    expect(isMetaCdnUrl('http://169.254.169.254/latest')).toBe(false);
  });
});
