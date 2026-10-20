import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Environment } from '../src/config/Environment';
import { configureApp } from '../src/configureApp';
import { DATA_SOURCE } from '../src/infra/database/tokens';
import { AUTH_ACCOUNTS_REPOSITORY } from '../src/modules/auth/domain/repositories/AuthAccountsRepository';
import { SESSIONS_REPOSITORY } from '../src/modules/auth/domain/repositories/SessionsRepository';
import { InMemoryAuthAccountsRepository } from '../src/modules/auth/infra/repositories/InMemoryAuthAccountsRepository';
import { InMemorySessionsRepository } from '../src/modules/auth/infra/repositories/InMemorySessionsRepository';
import { Expert } from '../src/modules/experts/domain/entities/Expert';
import { ExpertStatus } from '../src/modules/experts/domain/enums/ExpertStatus';
import { EXPERTS_REPOSITORY } from '../src/modules/experts/domain/repositories/ExpertsRepository';
import { TrackingPixel } from '../src/modules/tracking/domain/entities/TrackingPixel';
import type { TrackingRule } from '../src/modules/tracking/domain/entities/TrackingRule';
import { TRACKING_PIXELS_REPOSITORY } from '../src/modules/tracking/domain/repositories/TrackingPixelsRepository';
import {
  TRACKING_RULES_REPOSITORY,
  type TrackingRulesRepository,
} from '../src/modules/tracking/domain/repositories/TrackingRulesRepository';
import type { TrackingPixelsRepository } from '../src/modules/tracking/domain/repositories/TrackingPixelsRepository';
import {
  TRACKING_SETUP_SESSION_STORE,
  type TrackingSetupSession,
} from '../src/modules/tracking/domain/repositories/TrackingSetupSessionStore';
import { User } from '../src/modules/users/domain/entities/User';
import { UserRole } from '../src/modules/users/domain/enums/UserRole';
import { UserStatus } from '../src/modules/users/domain/enums/UserStatus';
import { Argon2PasswordHasher } from '../src/shared/infra/hashing/Argon2PasswordHasher';
import { UuidV7IdGenerator } from '../src/shared/infra/ids/UuidV7IdGenerator';
import { REDIS_CLIENT } from '../src/shared/infra/redis/tokens';
import { LEADS_REPOSITORY } from '../src/modules/leads/domain/repositories/LeadsRepository';
import type {
  LeadRow,
  LeadsRepository,
} from '../src/modules/leads/domain/repositories/LeadsRepository';
import { TRACKING_PAGES_REPOSITORY } from '../src/modules/tracking/domain/repositories/TrackingPagesRepository';
import {
  TRACKING_EVENTS_SINK,
  type TrackingEventRow,
} from '../src/modules/tracking/domain/services/TrackingEventsSink';

/** Pixels em memória, com as mesmas regras do repositório TypeORM. */
class InMemoryPixels implements TrackingPixelsRepository {
  readonly pixels: TrackingPixel[] = [];

  findByExpert(tenantId: string, expertId: string) {
    return Promise.resolve(
      this.pixels.find(
        (pixel) => pixel.tenantId === tenantId && pixel.expertId === expertId,
      ) ?? null,
    );
  }

  findByPublicKey(publicKey: string) {
    return Promise.resolve(
      this.pixels.find((pixel) => pixel.publicKey === publicKey) ?? null,
    );
  }

  touchLastEvent() {
    return Promise.resolve();
  }

  createForExpert(pixel: TrackingPixel) {
    this.pixels.push(pixel);
    return Promise.resolve(pixel);
  }

  addAllowedDomain(pixelId: string, domain: string) {
    const index = this.pixels.findIndex((pixel) => pixel.id === pixelId);
    const current = this.pixels[index];
    const updated = new TrackingPixel({
      id: current.id,
      tenantId: current.tenantId,
      expertId: current.expertId,
      publicKey: current.publicKey,
      allowedDomains: current.allowedDomains.includes(domain)
        ? current.allowedDomains
        : [...current.allowedDomains, domain],
      createdAt: current.createdAt,
      updatedAt: new Date(),
    });
    this.pixels[index] = updated;
    return Promise.resolve(updated);
  }
}

/** Regras em memória, com as mesmas regras do repositório TypeORM. */
class InMemoryRules implements TrackingRulesRepository {
  readonly rules: TrackingRule[] = [];

  create(rule: TrackingRule) {
    this.rules.push(rule);
    return Promise.resolve(rule);
  }

  findForPage(pixelId: string, pageUrl: string) {
    return Promise.resolve(
      this.rules.filter(
        (rule) =>
          rule.pixelId === pixelId &&
          (rule.pageUrl === pageUrl || rule.scope === 'site'),
      ),
    );
  }

  findByPixel(pixelId: string) {
    return Promise.resolve(
      this.rules.filter((rule) => rule.pixelId === pixelId),
    );
  }

  countByPixel(pixelId: string) {
    return Promise.resolve(
      this.rules.filter((rule) => rule.pixelId === pixelId).length,
    );
  }

  delete(pixelId: string, ruleId: string) {
    const index = this.rules.findIndex(
      (rule) => rule.pixelId === pixelId && rule.id === ruleId,
    );
    if (index >= 0) this.rules.splice(index, 1);
    return Promise.resolve(index >= 0);
  }

  pagesByPixel(pixelId: string) {
    const pages = new Map<string, { count: number; updatedAt: Date }>();
    for (const rule of this.rules.filter((item) => item.pixelId === pixelId)) {
      const page = pages.get(rule.pageUrl);
      pages.set(rule.pageUrl, {
        count: (page?.count ?? 0) + 1,
        updatedAt: rule.updatedAt,
      });
    }
    return Promise.resolve(
      [...pages].map(([url, page]) => ({
        url,
        eventsCount: page.count,
        updatedAt: page.updatedAt,
      })),
    );
  }
}

describe('Tracking (e2e)', () => {
  const ids = new UuidV7IdGenerator();
  const tenantId = ids.generate();
  const pixels = new InMemoryPixels();
  const rules = new InMemoryRules();
  const sunk: TrackingEventRow[] = [];
  const leadRows: LeadRow[] = [];
  const leadsRepository: LeadsRepository = {
    recordSubmission: (input) => {
      const id = input.newLeadId;
      const profile = input.mergeProfile(id, null);
      leadRows.push({
        id,
        tenantId: input.tenantId,
        expertId: input.expertId,
        profile,
        consent: input.consent ?? null,
        firstSeenAt: input.submittedAt,
        lastSeenAt: input.submittedAt,
        cursor: { lastSeenAt: '2026-10-18T12:00:00.000000', id },
        launches: [],
      });
      return Promise.resolve({ leadId: id, duplicate: false });
    },
    list: (query) =>
      Promise.resolve(
        query.after
          ? []
          : leadRows.filter(
              (row) =>
                row.tenantId === query.tenantId &&
                row.expertId === query.expertId,
            ),
      ),
    count: () => Promise.resolve(leadRows.length),
    delete: (_tenant, _expert, leadId) => {
      const index = leadRows.findIndex((row) => row.id === leadId);
      if (index >= 0) leadRows.splice(index, 1);
      return Promise.resolve(index >= 0);
    },
    launchNames: () => Promise.resolve(new Map<string, string>()),
    customFieldLabels: () => Promise.resolve([]),
  };
  const sessions = new Map<string, TrackingSetupSession>();
  let app: NestExpressApplication;
  let expert: Expert;
  let token: string;

  beforeAll(async () => {
    Environment.vars = {
      PORT: 3001,
      META_GRAPH_API_VERSION: 'v21.0',
      UPSTASH_REDIS_REST_URL: 'https://unused.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'unused',
      JWT_SECRET: 'e2e-secret-with-at-least-32-characters!!',
      JWT_ISSUER: 'backend',
      JWT_AUDIENCE: 'backend-app',
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_IDLE_TTL_SECONDS: 604800,
      SESSION_ABSOLUTE_TTL_SECONDS: 2592000,
      REFRESH_TOKEN_GRACE_PERIOD_SECONDS: 10,
      AUTH_COOKIE_SECURE: true,
      TRUST_PROXY: false,
      INSTAGRAM_SCOPES: 'instagram_business_basic',
      INSTAGRAM_GRAPH_API_VERSION: 'v25.0',
      FRONTEND_URL: 'http://localhost:5173',
      TRACKING_SCRIPT_URL: 'https://cdn.test/p.js',
      TRACKING_ALLOW_LOCAL_PAGES: false,
      LEADS_ENCRYPTION_KEY: 'q'.repeat(43) + '=',
    };

    const now = new Date();
    const accounts = new InMemoryAuthAccountsRepository();
    const user = new User({
      id: ids.generate(),
      firstName: 'Ana',
      email: 'ana@example.com',
      passwordHash: await new Argon2PasswordHasher().hash('secret123'),
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    accounts.users.push(user);
    accounts.memberships.set(user.id, [
      { tenantId, tenantName: 'Agência', role: UserRole.ADMIN },
    ]);
    expert = new Expert({
      id: ids.generate(),
      tenantId,
      name: 'Carla',
      email: 'carla@example.com',
      status: ExpertStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATA_SOURCE)
      .useValue({ getRepository: () => ({}) })
      .overrideProvider(REDIS_CLIENT)
      .useValue({})
      .overrideProvider(SESSIONS_REPOSITORY)
      .useValue(new InMemorySessionsRepository())
      .overrideProvider(AUTH_ACCOUNTS_REPOSITORY)
      .useValue(accounts)
      .overrideProvider(EXPERTS_REPOSITORY)
      .useValue({
        findByTenantIdAndId: (tenant: string, id: string) =>
          Promise.resolve(
            tenant === tenantId && id === expert.id ? expert : null,
          ),
      })
      .overrideProvider(TRACKING_PIXELS_REPOSITORY)
      .useValue(pixels)
      .overrideProvider(TRACKING_RULES_REPOSITORY)
      .useValue(rules)
      .overrideProvider(TRACKING_PAGES_REPOSITORY)
      .useValue({
        setLaunch: () => Promise.resolve(),
        launchesByPage: () => Promise.resolve(new Map()),
        launchBelongsToExpert: () => Promise.resolve(true),
        resolveLaunch: () => Promise.resolve(null),
      })
      .overrideProvider(TRACKING_EVENTS_SINK)
      .useValue({
        write: (rows: TrackingEventRow[]) => {
          sunk.push(...rows);
          return Promise.resolve();
        },
      })
      .overrideProvider(LEADS_REPOSITORY)
      .useValue(leadsRepository)
      .overrideProvider(TRACKING_SETUP_SESSION_STORE)
      .useValue({
        save: (key: string, session: TrackingSetupSession) => {
          sessions.set(key, session);
          return Promise.resolve();
        },
        touch: (key: string) => Promise.resolve(sessions.get(key) ?? null),
      })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ana@example.com', password: 'secret123' })
      .expect(200);
    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const path = (suffix: string, id = expert.id) =>
    `/experts/${id}/tracking/${suffix}`;

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get(path('pixel')).expect(401);
  });

  it('activates tracking once and returns the same pixel afterwards', async () => {
    const server = app.getHttpServer();
    const auth = { Authorization: `Bearer ${token}` };

    const before = await request(server)
      .get(path('pixel'))
      .set(auth)
      .expect(404);
    expect(before.body).toMatchObject({ reason: 'TRACKING_PIXEL_NOT_FOUND' });

    const created = await request(server)
      .post(path('pixel'))
      .set(auth)
      .expect(201);
    expect(created.body).toEqual({
      id: expect.any(String) as string,
      publicKey: expect.stringMatching(/^PX_[A-Za-z0-9]{20}$/) as string,
      scriptUrl: 'https://cdn.test/p.js',
      allowedDomains: [],
      installation: { status: 'waiting', lastEventAt: null },
      pages: [],
    });

    const again = await request(server)
      .post(path('pixel'))
      .set(auth)
      .expect(201);
    expect(again.body).toEqual(created.body);

    const fetched = await request(server)
      .get(path('pixel'))
      .set(auth)
      .expect(200);
    expect(fetched.body).toEqual(created.body);
  });

  it('opens a setup session and authorizes the page domain', async () => {
    const server = app.getHttpServer();
    const response = await request(server)
      .post(path('setup-sessions'))
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.meusite.com.br/vendas' })
      .expect(201);

    const { setupUrl } = response.body as { setupUrl: string };
    expect(setupUrl).toMatch(
      /^https:\/\/www\.meusite\.com\.br\/vendas#pulse_setup=[\w-]{43}$/,
    );
    expect(sessions.get(setupUrl.split('#pulse_setup=')[1])).toMatchObject({
      tenantId,
      expertId: expert.id,
      url: 'https://www.meusite.com.br/vendas',
    });

    const pixel = await request(server)
      .get(path('pixel'))
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(pixel.body).toMatchObject({ allowedDomains: ['meusite.com.br'] });
  });

  it.each([
    ['an http page', { url: 'http://meusite.com.br' }],
    ['a missing url', {}],
    ['unknown fields', { url: 'https://meusite.com.br', extra: true }],
  ])('rejects %s', async (_, body) => {
    const response = await request(app.getHttpServer())
      .post(path('setup-sessions'))
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(400);
    expect(response.body).toMatchObject({ reason: 'VALIDATION_FAILED' });
  });

  it('rejects malformed expert ids', async () => {
    await request(app.getHttpServer())
      .get(path('pixel', 'not-a-uuid'))
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('hides experts from other tenants', async () => {
    await request(app.getHttpServer())
      .get(path('pixel', ids.generate()))
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  describe('visual editor', () => {
    const pageOrigin = 'https://www.meusite.com.br';
    let setupToken: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post(path('setup-sessions'))
        .set('Authorization', `Bearer ${token}`)
        .send({ url: `${pageOrigin}/vendas?utm_source=ig` })
        .expect(201);
      setupToken = (response.body as { setupUrl: string }).setupUrl.split(
        '#pulse_setup=',
      )[1];
    });

    it('lets the customer page call the editor routes, without cookies', async () => {
      const preflight = await request(app.getHttpServer())
        .options('/t/setup/session')
        .set('Origin', pageOrigin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'x-pulse-setup-token')
        .expect(204);

      expect(preflight.headers['access-control-allow-origin']).toBe(pageOrigin);
      expect(
        String(preflight.headers['access-control-allow-headers']).toLowerCase(),
      ).toContain('x-pulse-setup-token');
      expect(
        preflight.headers['access-control-allow-credentials'],
      ).toBeUndefined();
    });

    it('keeps the dashboard routes closed to other origins', async () => {
      const preflight = await request(app.getHttpServer())
        .options('/experts')
        .set('Origin', 'https://evil.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('opens the session and saves rules for the page', async () => {
      const server = app.getHttpServer();

      const opened = await request(server)
        .post('/t/setup/session')
        .set('Origin', pageOrigin)
        .set('X-Pulse-Setup-Token', setupToken)
        .expect(200);
      expect(opened.body).toMatchObject({
        publicKey: expect.stringMatching(/^PX_/) as string,
        pageUrl: `${pageOrigin}/vendas`,
        rules: [],
      });

      const created = await request(server)
        .post('/t/setup/rules')
        .set('Origin', pageOrigin)
        .set('X-Pulse-Setup-Token', setupToken)
        .send({
          scope: 'page',
          trigger: 'click',
          eventName: 'Purchase',
          element: {
            selector: '#comprar',
            tag: 'button',
            text: 'Comprar agora',
            attributes: { id: 'comprar' },
          },
        })
        .expect(201);
      expect(created.body).toMatchObject({
        eventName: 'Purchase',
        element: { selector: '#comprar' },
      });

      const pixel = await request(server)
        .get(path('pixel'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(pixel.body).toMatchObject({
        pages: [{ url: `${pageOrigin}/vendas`, eventsCount: 1 }],
      });

      await request(server)
        .delete(`/t/setup/rules/${(created.body as { id: string }).id}`)
        .set('Origin', pageOrigin)
        .set('X-Pulse-Setup-Token', setupToken)
        .expect(204);
      expect(rules.rules).toHaveLength(0);
    });

    it('refuses the token when used from another site', async () => {
      const response = await request(app.getHttpServer())
        .post('/t/setup/session')
        .set('Origin', 'https://evil.com')
        .set('X-Pulse-Setup-Token', setupToken)
        .expect(403);
      expect(response.body).toMatchObject({
        reason: 'TRACKING_SETUP_ORIGIN_MISMATCH',
      });
    });

    it('refuses unknown tokens and invalid rules', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/t/setup/session')
        .set('Origin', pageOrigin)
        .set('X-Pulse-Setup-Token', 'x'.repeat(43))
        .expect(401);

      const invalid = await request(server)
        .post('/t/setup/rules')
        .set('Origin', pageOrigin)
        .set('X-Pulse-Setup-Token', setupToken)
        .send({
          scope: 'page',
          trigger: 'hover',
          eventName: 'Compra finalizada!',
          element: {
            selector: '#x',
            tag: 'BUTTON',
            attributes: { 'on click': 'x' },
          },
        })
        .expect(400);
      expect(invalid.body).toMatchObject({ reason: 'VALIDATION_FAILED' });
    });
  });

  describe('collector and leads', () => {
    const pageOrigin = 'https://www.meusite.com.br';
    let publicKey: string;
    let ruleId: string;

    beforeAll(async () => {
      const server = app.getHttpServer();
      const pixel = await request(server)
        .get(path('pixel'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      publicKey = (pixel.body as { publicKey: string }).publicKey;

      const session = await request(server)
        .post(path('setup-sessions'))
        .set('Authorization', `Bearer ${token}`)
        .send({ url: `${pageOrigin}/captura` })
        .expect(201);
      const setupToken = (session.body as { setupUrl: string }).setupUrl.split(
        '#pulse_setup=',
      )[1];

      const rule = await request(server)
        .post('/t/setup/rules')
        .set('Origin', pageOrigin)
        .set('X-Pulse-Setup-Token', setupToken)
        .send({
          scope: 'page',
          trigger: 'submit',
          eventName: 'Lead',
          element: {
            selector: 'form[name="aula"]',
            tag: 'form',
            attributes: {},
          },
          fields: [
            {
              key: 'name',
              slug: 'name',
              label: 'Nome',
              selector: '[name="nome"]',
            },
            {
              key: 'email',
              slug: 'email',
              label: 'E-mail',
              selector: '[name="email"]',
            },
          ],
        })
        .expect(201);
      ruleId = (rule.body as { id: string }).id;
    });

    it('serves the public pixel config with a short browser cache', async () => {
      const response = await request(app.getHttpServer())
        .get(`/t/${publicKey}/config`)
        .set('Origin', pageOrigin)
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=60');
      expect(response.headers['access-control-allow-origin']).toBe(pageOrigin);
      expect(response.body).toMatchObject({
        rules: expect.arrayContaining([
          expect.objectContaining({
            id: ruleId,
            trigger: 'submit',
            fields: [
              { slug: 'name', key: 'name', selector: '[name="nome"]' },
              { slug: 'email', key: 'email', selector: '[name="email"]' },
            ],
          }),
        ]) as unknown,
      });
      expect(JSON.stringify(response.body)).not.toContain('tenant');
    });

    it('receives a sendBeacon batch and turns the form into a lead', async () => {
      await request(app.getHttpServer())
        .post(`/t/${publicKey}/events`)
        .set('Origin', pageOrigin)
        .set('User-Agent', 'Mozilla/5.0 (iPhone) Safari/604.1')
        .set('Content-Type', 'text/plain;charset=UTF-8')
        .send(
          JSON.stringify({
            events: [
              {
                id: '0193a7f0-1234-4abc-8def-0123456789ab',
                name: 'Lead',
                ruleId,
                url: `${pageOrigin}/captura?utm_source=ig`,
                utm: { source: 'ig' },
                lead: {
                  values: { name: 'Ana', email: 'Ana@Site.com', senha: 'x' },
                },
              },
            ],
          }),
        )
        .expect(204);

      expect(sunk.at(-1)).toMatchObject({
        event_name: 'Lead',
        rule_id: ruleId,
        utm_source: 'ig',
      });
      expect(leadRows).toHaveLength(1);

      const listed = await request(app.getHttpServer())
        .get(`/experts/${expert.id}/leads`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(listed.body).toMatchObject({
        total: 1,
        nextCursor: null,
        data: [{ name: 'Ana', email: 'ana@site.com', custom: {} }],
      });
      expect(JSON.stringify(listed.body)).not.toContain('senha');
    });

    it('answers 204 and stores nothing for requests from unknown sites', async () => {
      const before = sunk.length;
      await request(app.getHttpServer())
        .post(`/t/${publicKey}/events`)
        .set('Origin', 'https://evil.com')
        .set('User-Agent', 'Mozilla/5.0 Safari/604.1')
        .set('Content-Type', 'text/plain')
        .send(
          JSON.stringify({
            events: [
              {
                id: '0193a7f0-1234-4abc-8def-0123456789ac',
                name: 'PageView',
                url: 'https://evil.com/',
              },
            ],
          }),
        )
        .expect(204);

      expect(sunk).toHaveLength(before);
    });

    it('exports the leads as a CSV through a short-lived signed link', async () => {
      const server = app.getHttpServer();
      const link = await request(server)
        .post(`/experts/${expert.id}/leads/exports`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);
      const { url } = link.body as { url: string };

      const csv = await request(server).get(url).buffer(true).expect(200);

      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.headers['content-disposition']).toMatch(
        /^attachment; filename="leads-/,
      );
      expect(csv.headers['cache-control']).toBe('no-store');
      expect(csv.text).toContain('Nome;E-mail;Telefone');
      expect(csv.text).toContain('Ana;ana@site.com');

      await request(server)
        .get(url.replace(/s=[^&]+/, 's=forged'))
        .expect(403);
    });

    it('deletes a lead', async () => {
      const [lead] = leadRows;
      await request(app.getHttpServer())
        .delete(`/experts/${expert.id}/leads/${lead.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(leadRows).toHaveLength(0);
    });
  });
});
