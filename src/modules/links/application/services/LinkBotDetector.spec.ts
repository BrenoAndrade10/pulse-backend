import { LinkBotDetector } from './LinkBotDetector';

describe('LinkBotDetector', () => {
  const detector = new LinkBotDetector();
  it.each([
    '',
    'WhatsApp',
    'TelegramBot',
    'facebookexternalhit',
    'Twitterbot',
    'Googlebot',
    'curl/8',
  ])('detects %s', (ua) => {
    expect(detector.isBot(ua)).toBe(true);
  });
  it('keeps normal browsers', () =>
    expect(detector.isBot('Mozilla/5.0 Chrome/130')).toBe(false));
});
