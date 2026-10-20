/* eslint-disable @typescript-eslint/unbound-method */
import { Environment } from '../../../../../config/Environment';
import { DomainError } from '../../../../../shared/errors/DomainError';
import type { CaptureLeadService } from '../../../../leads/application/services/CaptureLeadService';
import { TrackingPixel } from '../../../domain/entities/TrackingPixel';
import {
  TrackingRule,
  type TrackingRuleProps,
} from '../../../domain/entities/TrackingRule';
import type { TrackingPagesRepository } from '../../../domain/repositories/TrackingPagesRepository';
import type { TrackingPixelsRepository } from '../../../domain/repositories/TrackingPixelsRepository';
import type {
  TrackingEventRow,
  TrackingEventsSink,
} from '../../../domain/services/TrackingEventsSink';
import { CollectEventsUseCase } from '../CollectEventsUseCase';
import type { PixelConfigProvider } from '../PixelConfigProvider';

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const ORIGIN = 'https://www.meusite.com.br';
const RULE_ID = '0193a7f0-0000-4abc-8def-0000000000aa';

const makeRule = (overrides: Partial<TrackingRuleProps> = {}) =>
  new TrackingRule({
    id: RULE_ID,
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    pixelId: 'pixel-a',
    pageUrl: `${ORIGIN}/captura`,
    scope: 'page',
    trigger: 'submit',
    eventName: 'Lead',
    element: { selector: 'form[name="aula"]', tag: 'form', attributes: {} },
    fields: [
      { key: 'name', slug: 'name', label: 'Nome', selector: '[name="nome"]' },
      {
        key: 'email',
        slug: 'email',
        label: 'E-mail',
        selector: '[name="email"]',
      },
      {
        key: 'custom',
        slug: 'origem',
        label: 'Como nos conheceu',
        selector: '[name="origem"]',
      },
      {
        key: 'consent',
        slug: 'consent',
        label: 'Consentimento',
        selector: '[name="lgpd"]',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const event = (overrides: Record<string, unknown> = {}) => ({
  id: `0193a7f0-1234-4abc-8def-${String(Math.random()).slice(2, 14).padEnd(12, '0')}`,
  name: 'PageView',
  url: `${ORIGIN}/captura?utm_source=ig`,
  utm: { source: 'ig' },
  ...overrides,
});

describe('CollectEventsUseCase', () => {
  let configs: jest.Mocked<Pick<PixelConfigProvider, 'get'>>;
  let capture: jest.Mocked<Pick<CaptureLeadService, 'capture'>>;
  let pixels: jest.Mocked<TrackingPixelsRepository>;
  let pages: jest.Mocked<TrackingPagesRepository>;
  let sink: jest.Mocked<TrackingEventsSink>;
  let useCase: CollectEventsUseCase;

  const pixel = new TrackingPixel({
    id: 'pixel-a',
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    publicKey: 'PX_abcdefghijklmnopqrst',
    allowedDomains: ['meusite.com.br'],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const run = (
    events: unknown[],
    overrides: Partial<{ origin: string; userAgent: string; ip: string }> = {},
  ) =>
    useCase.execute({
      publicKey: 'PX_abcdefghijklmnopqrst',
      origin: ORIGIN,
      userAgent: UA,
      ip: '200.100.50.25',
      body: JSON.stringify({ events }),
      ...overrides,
    });

  const written = (): TrackingEventRow[] =>
    sink.write.mock.calls.flatMap(([rows]) => rows);

  beforeEach(() => {
    Environment.vars = {
      JWT_SECRET: 'test-secret-with-at-least-32-characters!',
      TRACKING_ALLOW_LOCAL_PAGES: false,
    } as typeof Environment.vars;
    const rule = makeRule();
    configs = {
      get: jest.fn().mockResolvedValue({
        pixel,
        rules: [rule],
        rulesById: new Map([[rule.id, rule]]),
      }),
    };
    capture = {
      capture: jest
        .fn()
        .mockResolvedValue({ status: 'captured', leadId: 'lead-a' }),
    };
    pixels = {
      findByExpert: jest.fn(),
      createForExpert: jest.fn(),
      addAllowedDomain: jest.fn(),
      findByPublicKey: jest.fn(),
      touchLastEvent: jest.fn().mockResolvedValue(undefined),
    };
    pages = {
      setLaunch: jest.fn(),
      launchesByPage: jest.fn(),
      launchBelongsToExpert: jest.fn(),
      resolveLaunch: jest.fn().mockResolvedValue('launch-a'),
    };
    sink = { write: jest.fn().mockResolvedValue(undefined) };
    useCase = new CollectEventsUseCase(
      configs as unknown as PixelConfigProvider,
      capture as unknown as CaptureLeadService,
      pixels,
      pages,
      sink,
    );
  });

  it('stores page views with the launch and without the raw IP', async () => {
    await run([event()]);

    const [row] = written();
    expect(row).toMatchObject({
      tenant_id: 'tenant-a',
      pixel_id: 'pixel-a',
      event_name: 'PageView',
      page_url: `${ORIGIN}/captura`,
      launch_id: 'launch-a',
      lead_id: null,
      utm_source: 'ig',
      device: 'mobile',
    });
    expect(row.ip_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(row)).not.toContain('200.100.50.25');
    expect(pixels.touchLastEvent).toHaveBeenCalledWith('pixel-a');
  });

  it('captures the lead with only the mapped fields', async () => {
    await run([
      event({
        name: 'Anything',
        ruleId: RULE_ID,
        lead: {
          values: {
            name: 'Ana',
            email: 'ana@site.com',
            origem: 'Reels',
            consent: true,
            senha: '123',
          },
        },
      }),
    ]);

    expect(capture.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        launchId: 'launch-a',
        ruleId: RULE_ID,
        values: {
          name: 'Ana',
          email: 'ana@site.com',
          custom: { 'Como nos conheceu': 'Reels' },
        },
        consent: true,
      }),
    );
    expect(written()[0]).toMatchObject({
      event_name: 'Lead',
      lead_id: 'lead-a',
      rule_id: RULE_ID,
    });
  });

  it('takes the event name from the saved rule, never from the browser', async () => {
    await run([
      event({ name: 'Purchase' }),
      event({
        name: 'Purchase',
        ruleId: '0193a7f0-0000-4abc-8def-0000000000bb',
      }),
    ]);

    expect(written()).toEqual([]);
  });

  it.each([
    ['another site', { origin: 'https://evil.com' }],
    ['a lookalike domain', { origin: 'https://meusite.com.br.evil.com' }],
    ['plain http', { origin: 'http://meusite.com.br' }],
    ['no origin', { origin: '' }],
    ['localhost outside development', { origin: 'http://localhost:5174' }],
    ['a bot', { userAgent: 'Googlebot/2.1' }],
  ])('ignores requests from %s', async (_, overrides) => {
    await run([event()], overrides);

    expect(sink.write).not.toHaveBeenCalled();
    expect(capture.capture).not.toHaveBeenCalled();
  });

  it('ignores events whose page is on another site than the request', async () => {
    await run([event({ url: 'https://outrosite.com/captura' })]);

    expect(written()).toEqual([]);
  });

  it('limits the events per IP and pixel', async () => {
    const batch = Array.from({ length: 20 }, () => event());
    for (let i = 0; i < 7; i++) await run(batch);

    // 120 por minuto: 6 lotes de 20 entram, o 7º não.
    expect(sink.write).toHaveBeenCalledTimes(6);
  });

  it('resolves the launch of a page once per minute', async () => {
    await run([event(), event()]);
    await run([event()]);

    expect(pages.resolveLaunch).toHaveBeenCalledTimes(1);
  });

  it('keeps tracking when leads are not configured', async () => {
    capture.capture.mockRejectedValue(
      new DomainError(503, 'LEADS_ENCRYPTION_KEY_NOT_CONFIGURED'),
    );

    await run([
      event({ ruleId: RULE_ID, lead: { values: { email: 'ana@site.com' } } }),
    ]);

    expect(written()[0]).toMatchObject({ event_name: 'Lead', lead_id: null });
  });
});
