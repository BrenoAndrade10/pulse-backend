/* eslint-disable @typescript-eslint/unbound-method */
import { Environment } from '../../../../../config/Environment';
import type { AccessTokenClaims } from '../../../../auth/domain/types/AccessTokenClaims';
import { Expert } from '../../../../experts/domain/entities/Expert';
import { ExpertStatus } from '../../../../experts/domain/enums/ExpertStatus';
import type { ExpertsRepository } from '../../../../experts/domain/repositories/ExpertsRepository';
import { UserRole } from '../../../../users/domain/enums/UserRole';
import {
  TrackingPixel,
  type TrackingPixelProps,
} from '../../../domain/entities/TrackingPixel';
import type { TrackingPixelsRepository } from '../../../domain/repositories/TrackingPixelsRepository';
import type { TrackingPagesRepository } from '../../../domain/repositories/TrackingPagesRepository';
import type { TrackingRulesRepository } from '../../../domain/repositories/TrackingRulesRepository';
import type { TrackingSetupSessionStore } from '../../../domain/repositories/TrackingSetupSessionStore';
import {
  TrackingRule,
  type TrackingRuleProps,
} from '../../../domain/entities/TrackingRule';
import type { TrackingSetupSession } from '../../../domain/repositories/TrackingSetupSessionStore';
import { SETUP_SESSION_IDLE_SECONDS } from '../../resolveSetupSession';
import { CreateTrackingPixelUseCase } from '../CreateTrackingPixelUseCase';
import {
  CreateTrackingRuleUseCase,
  MAX_RULES_PER_PIXEL,
} from '../CreateTrackingRuleUseCase';
import { DeleteTrackingRuleUseCase } from '../DeleteTrackingRuleUseCase';
import { OpenTrackingSetupUseCase } from '../OpenTrackingSetupUseCase';
import { GetTrackingPixelUseCase } from '../GetTrackingPixelUseCase';
import {
  SETUP_SESSION_TTL_SECONDS,
  StartTrackingSetupUseCase,
} from '../StartTrackingSetupUseCase';

const auth: AccessTokenClaims = {
  userId: 'user-a',
  sessionId: 'session-a',
  tenantId: 'tenant-a',
  role: UserRole.ADMIN,
};

function makePixel(overrides: Partial<TrackingPixelProps> = {}) {
  const now = new Date();
  return new TrackingPixel({
    id: 'pixel-a',
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    publicKey: 'PX_abcdefghijklmnopqrst',
    allowedDomains: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('tracking use cases', () => {
  let experts: jest.Mocked<ExpertsRepository>;
  let pixels: jest.Mocked<TrackingPixelsRepository>;
  let sessions: jest.Mocked<TrackingSetupSessionStore>;
  let rules: jest.Mocked<TrackingRulesRepository>;
  let pages: jest.Mocked<TrackingPagesRepository>;

  beforeEach(() => {
    Environment.vars = {
      TRACKING_ALLOW_LOCAL_PAGES: false,
    } as typeof Environment.vars;
    const now = new Date();
    experts = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByTenantIdAndId: jest.fn().mockResolvedValue(
        new Expert({
          id: 'expert-a',
          tenantId: 'tenant-a',
          name: 'Expert',
          email: 'expert@test.com',
          status: ExpertStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        }),
      ),
      findByTenantIdAndEmail: jest.fn(),
      findByTenantId: jest.fn(),
      deleteByTenantIdAndId: jest.fn(),
    };
    pixels = {
      findByExpert: jest.fn().mockResolvedValue(null),
      createForExpert: jest.fn((pixel: TrackingPixel) =>
        Promise.resolve(pixel),
      ),
      addAllowedDomain: jest.fn(),
      findByPublicKey: jest.fn(),
      touchLastEvent: jest.fn(),
    };
    sessions = { save: jest.fn(), touch: jest.fn() };
    rules = {
      create: jest.fn(),
      findForPage: jest.fn().mockResolvedValue([]),
      countByPixel: jest.fn().mockResolvedValue(0),
      findByPixel: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      pagesByPixel: jest.fn().mockResolvedValue([]),
    };
    pages = {
      setLaunch: jest.fn(),
      launchesByPage: jest.fn().mockResolvedValue(new Map()),
      launchBelongsToExpert: jest.fn().mockResolvedValue(true),
      resolveLaunch: jest.fn().mockResolvedValue(null),
    };
  });

  describe('GetTrackingPixelUseCase', () => {
    const useCase = () =>
      new GetTrackingPixelUseCase(experts, pixels, rules, pages);

    it('returns the pixel of the expert in the tenant with its pages', async () => {
      const pages = [
        {
          url: 'https://site.com/vendas',
          eventsCount: 2,
          updatedAt: new Date(),
        },
      ];
      pixels.findByExpert.mockResolvedValue(makePixel());
      rules.pagesByPixel.mockResolvedValue(pages);

      const result = await useCase().execute('expert-a', auth);

      expect(result.pixel).toMatchObject({ id: 'pixel-a' });
      expect(result.pages).toEqual([{ ...pages[0], launchId: null }]);
      expect(pixels.findByExpert).toHaveBeenCalledWith('tenant-a', 'expert-a');
      expect(rules.pagesByPixel).toHaveBeenCalledWith('pixel-a');
    });

    it('reports when tracking was not activated', async () => {
      await expect(useCase().execute('expert-a', auth)).rejects.toMatchObject({
        statusCode: 404,
        reason: 'TRACKING_PIXEL_NOT_FOUND',
      });
    });

    it('hides experts from another tenant', async () => {
      experts.findByTenantIdAndId.mockResolvedValue(null);

      await expect(useCase().execute('expert-a', auth)).rejects.toMatchObject({
        statusCode: 404,
        reason: 'EXPERT_NOT_FOUND',
      });
      expect(pixels.findByExpert).not.toHaveBeenCalled();
    });

    it('requires an active tenant', async () => {
      await expect(
        useCase().execute('expert-a', { ...auth, tenantId: null }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('CreateTrackingPixelUseCase', () => {
    const useCase = () =>
      new CreateTrackingPixelUseCase(experts, pixels, {
        generate: () => 'new-pixel',
      });

    it('creates a pixel with a public key and no domains', async () => {
      const pixel = await useCase().execute('expert-a', auth);

      expect(pixel).toMatchObject({
        id: 'new-pixel',
        tenantId: 'tenant-a',
        expertId: 'expert-a',
        allowedDomains: [],
      });
      expect(pixel.publicKey).toMatch(/^PX_[A-Za-z0-9]{20}$/);
    });

    it('returns the existing pixel when activated again', async () => {
      pixels.findByExpert.mockResolvedValue(makePixel());

      await expect(useCase().execute('expert-a', auth)).resolves.toMatchObject({
        id: 'pixel-a',
      });
      expect(pixels.createForExpert).not.toHaveBeenCalled();
    });
  });

  describe('StartTrackingSetupUseCase', () => {
    const useCase = () =>
      new StartTrackingSetupUseCase(experts, pixels, sessions);

    beforeEach(() => {
      pixels.findByExpert.mockResolvedValue(makePixel());
      pixels.addAllowedDomain.mockImplementation((_, domain: string) =>
        Promise.resolve(makePixel({ allowedDomains: [domain] })),
      );
    });

    it('authorizes a new domain and returns the page with the token in the fragment', async () => {
      const { setupUrl } = await useCase().execute(
        { expertId: 'expert-a', url: 'https://www.meusite.com.br/vendas#x' },
        auth,
      );

      expect(pixels.addAllowedDomain).toHaveBeenCalledWith(
        'pixel-a',
        'meusite.com.br',
      );
      expect(setupUrl).toMatch(
        /^https:\/\/www\.meusite\.com\.br\/vendas#pulse_setup=[\w-]{43}$/,
      );

      const token = setupUrl.split('#pulse_setup=')[1];
      expect(sessions.save).toHaveBeenCalledWith(
        token,
        {
          tenantId: 'tenant-a',
          expertId: 'expert-a',
          pixelId: 'pixel-a',
          userId: 'user-a',
          url: 'https://www.meusite.com.br/vendas',
        },
        SETUP_SESSION_TTL_SECONDS,
      );
    });

    it('does not touch the domains when the page is already allowed', async () => {
      pixels.findByExpert.mockResolvedValue(
        makePixel({ allowedDomains: ['meusite.com.br'] }),
      );

      await useCase().execute(
        { expertId: 'expert-a', url: 'https://lp.meusite.com.br/' },
        auth,
      );

      expect(pixels.addAllowedDomain).not.toHaveBeenCalled();
    });

    it('limits the number of domains per pixel', async () => {
      pixels.findByExpert.mockResolvedValue(
        makePixel({
          allowedDomains: Array.from({ length: 20 }, (_, i) => `site${i}.com`),
        }),
      );

      await expect(
        useCase().execute(
          { expertId: 'expert-a', url: 'https://novo.com.br' },
          auth,
        ),
      ).rejects.toMatchObject({ reason: 'VALIDATION_FAILED' });
      expect(pixels.addAllowedDomain).not.toHaveBeenCalled();
    });

    it('refuses pages that are not public https', async () => {
      await expect(
        useCase().execute(
          { expertId: 'expert-a', url: 'http://meusite.com.br' },
          auth,
        ),
      ).rejects.toMatchObject({ reason: 'VALIDATION_FAILED' });
      expect(sessions.save).not.toHaveBeenCalled();
    });

    it('requires the pixel to be activated first', async () => {
      pixels.findByExpert.mockResolvedValue(null);

      await expect(
        useCase().execute(
          { expertId: 'expert-a', url: 'https://meusite.com.br' },
          auth,
        ),
      ).rejects.toMatchObject({ reason: 'TRACKING_PIXEL_NOT_FOUND' });
    });

    it('hides experts from another tenant', async () => {
      experts.findByTenantIdAndId.mockResolvedValue(null);

      await expect(
        useCase().execute(
          { expertId: 'expert-a', url: 'https://meusite.com.br' },
          auth,
        ),
      ).rejects.toMatchObject({ reason: 'EXPERT_NOT_FOUND' });
      expect(sessions.save).not.toHaveBeenCalled();
    });
  });

  describe('visual editor (setup session)', () => {
    const token = 'a'.repeat(43);
    const origin = 'https://www.meusite.com.br';
    const session: TrackingSetupSession = {
      tenantId: 'tenant-a',
      expertId: 'expert-a',
      pixelId: 'pixel-a',
      userId: 'user-a',
      url: 'https://www.meusite.com.br/vendas?utm_source=ig',
    };
    const element = {
      selector: '#comprar',
      tag: 'button',
      text: 'Comprar agora',
      attributes: { id: 'comprar' },
    };

    const makeRule = (overrides: Partial<TrackingRuleProps> = {}) =>
      new TrackingRule({
        id: 'rule-a',
        tenantId: 'tenant-a',
        expertId: 'expert-a',
        pixelId: 'pixel-a',
        pageUrl: 'https://www.meusite.com.br/vendas',
        scope: 'page',
        trigger: 'click',
        eventName: 'Purchase',
        element,
        fields: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      });

    beforeEach(() => {
      sessions.touch.mockResolvedValue(session);
      pixels.findByExpert.mockResolvedValue(makePixel());
    });

    describe('session checks', () => {
      const open = (input: { token?: string; origin?: string }) =>
        new OpenTrackingSetupUseCase(sessions, pixels, rules).execute(input);

      it('renews the session on every use', async () => {
        await open({ token, origin });

        expect(sessions.touch).toHaveBeenCalledWith(
          token,
          SETUP_SESSION_IDLE_SECONDS,
        );
      });

      it.each([
        ['without a token', undefined],
        ['with a malformed token', 'short'],
      ])('refuses requests %s', async (_, badToken) => {
        await expect(open({ token: badToken, origin })).rejects.toMatchObject({
          statusCode: 401,
          reason: 'TRACKING_SETUP_SESSION_INVALID',
        });
        expect(sessions.touch).not.toHaveBeenCalled();
      });

      it('refuses expired or unknown tokens', async () => {
        sessions.touch.mockResolvedValue(null);

        await expect(open({ token, origin })).rejects.toMatchObject({
          statusCode: 401,
          reason: 'TRACKING_SETUP_SESSION_INVALID',
        });
      });

      it.each([
        ['another site', 'https://evil.com'],
        ['another protocol', 'http://www.meusite.com.br'],
        ['no origin', undefined],
      ])('refuses the token used from %s', async (_, otherOrigin) => {
        await expect(
          open({ token, origin: otherOrigin }),
        ).rejects.toMatchObject({
          statusCode: 403,
          reason: 'TRACKING_SETUP_ORIGIN_MISMATCH',
        });
      });
    });

    describe('OpenTrackingSetupUseCase', () => {
      it('returns the pixel and the rules of the page, without the query', async () => {
        const rule = makeRule();
        rules.findForPage.mockResolvedValue([rule]);

        await expect(
          new OpenTrackingSetupUseCase(sessions, pixels, rules).execute({
            token,
            origin,
          }),
        ).resolves.toEqual({
          publicKey: 'PX_abcdefghijklmnopqrst',
          pageUrl: 'https://www.meusite.com.br/vendas',
          rules: [rule],
        });
        expect(rules.findForPage).toHaveBeenCalledWith(
          'pixel-a',
          'https://www.meusite.com.br/vendas',
        );
      });

      it('refuses sessions whose pixel no longer exists', async () => {
        pixels.findByExpert.mockResolvedValue(null);

        await expect(
          new OpenTrackingSetupUseCase(sessions, pixels, rules).execute({
            token,
            origin,
          }),
        ).rejects.toMatchObject({ reason: 'TRACKING_SETUP_SESSION_INVALID' });
      });
    });

    describe('CreateTrackingRuleUseCase', () => {
      const useCase = () =>
        new CreateTrackingRuleUseCase(sessions, rules, {
          generate: () => 'new-rule',
        });

      it('creates the rule on the page of the session', async () => {
        rules.create.mockImplementation((rule: TrackingRule) =>
          Promise.resolve(rule),
        );

        const rule = await useCase().execute({
          token,
          origin,
          scope: 'page',
          trigger: 'click',
          eventName: 'Purchase',
          element,
          fields: [],
        });

        expect(rule).toMatchObject({
          id: 'new-rule',
          tenantId: 'tenant-a',
          expertId: 'expert-a',
          pixelId: 'pixel-a',
          pageUrl: 'https://www.meusite.com.br/vendas',
          eventName: 'Purchase',
          element,
          fields: [],
        });
      });

      it('limits the rules per pixel', async () => {
        rules.countByPixel.mockResolvedValue(MAX_RULES_PER_PIXEL);

        await expect(
          useCase().execute({
            token,
            origin,
            scope: 'page',
            trigger: 'click',
            eventName: 'Lead',
            element,
            fields: [],
          }),
        ).rejects.toMatchObject({ reason: 'VALIDATION_FAILED' });
        expect(rules.create).not.toHaveBeenCalled();
      });

      it('does not create rules with an invalid session', async () => {
        sessions.touch.mockResolvedValue(null);

        await expect(
          useCase().execute({
            token,
            origin,
            scope: 'page',
            trigger: 'click',
            eventName: 'Lead',
            element,
            fields: [],
          }),
        ).rejects.toMatchObject({ statusCode: 401 });
        expect(rules.create).not.toHaveBeenCalled();
      });
    });

    describe('DeleteTrackingRuleUseCase', () => {
      it('only deletes rules of the session pixel', async () => {
        await new DeleteTrackingRuleUseCase(sessions, rules).execute({
          token,
          origin,
          ruleId: 'rule-a',
        });

        expect(rules.delete).toHaveBeenCalledWith('pixel-a', 'rule-a');
      });
    });
  });
});
