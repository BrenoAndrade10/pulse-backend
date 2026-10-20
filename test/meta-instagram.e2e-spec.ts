import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
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
import type { IntegrationAccount } from '../src/modules/integrations/domain/entities/IntegrationAccount';
import type { IntegrationCredential } from '../src/modules/integrations/domain/entities/IntegrationCredential';
import { INTEGRATION_CREDENTIALS_REPOSITORY } from '../src/modules/integrations/domain/repositories/IntegrationCredentialsRepository';
import {
  OAUTH_STATE_STORE,
  type InstagramOAuthState,
} from '../src/modules/meta/domain/repositories/OAuthStateStore';
import {
  INSTAGRAM_OAUTH_GATEWAY,
  type InstagramOAuthGateway,
} from '../src/modules/meta/domain/services/InstagramOAuthGateway';
import { User } from '../src/modules/users/domain/entities/User';
import { UserRole } from '../src/modules/users/domain/enums/UserRole';
import { UserStatus } from '../src/modules/users/domain/enums/UserStatus';
import { Argon2PasswordHasher } from '../src/shared/infra/hashing/Argon2PasswordHasher';
import { UuidV7IdGenerator } from '../src/shared/infra/ids/UuidV7IdGenerator';
import { REDIS_CLIENT } from '../src/shared/infra/redis/tokens';

/**
 * Fluxo HTTP do login da empresa no Instagram, com Postgres, Redis e a Meta
 * substituídos por implementações em memória.
 */
describe('Instagram business login (e2e)', () => {
  const FRONTEND = 'http://localhost:5173';
  const ids = new UuidV7IdGenerator();
  const tenantId = ids.generate();
  const states = new Map<string, InstagramOAuthState>();
  const credentials: IntegrationCredential[] = [];
  const connectedAccounts: IntegrationAccount[] = [];
  let app: NestExpressApplication;
  let expert: Expert;

  const gateway: InstagramOAuthGateway = {
    isConfigured: () => true,
    buildAuthorizationUrl: (state) =>
      `https://www.instagram.com/oauth/authorize?state=${state}`,
    exchangeCode: () =>
      Promise.resolve({
        accessToken: 'short',
        appScopedUserId: '111',
        permissions: ['instagram_business_basic'],
      }),
    exchangeForLongLivedToken: () =>
      Promise.resolve({ accessToken: 'long', expiresInSeconds: 5_184_000 }),
    getProfile: () =>
      Promise.resolve({ userId: '178414', username: 'carlaexpert' }),
  };

  beforeAll(async () => {
    Environment.vars = {
      PORT: 3001,
      META_GRAPH_API_VERSION: 'v21.0',
      META_TOKENS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
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
      CORS_ORIGIN: FRONTEND,
      TRUST_PROXY: false,
      INSTAGRAM_SCOPES: 'instagram_business_basic',
      INSTAGRAM_GRAPH_API_VERSION: 'v25.0',
      FRONTEND_URL: FRONTEND,
      TRACKING_SCRIPT_URL: 'https://cdn.test/p.js',
      TRACKING_ALLOW_LOCAL_PAGES: false,
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
        findById: (id: string) =>
          Promise.resolve(id === expert.id ? expert : null),
      })
      .overrideProvider(INTEGRATION_CREDENTIALS_REPOSITORY)
      .useValue({
        replaceActive: (
          credential: IntegrationCredential,
          accounts: IntegrationAccount[],
        ) => {
          credentials.push(credential);
          connectedAccounts.push(...accounts);
          return Promise.resolve();
        },
      })
      .overrideProvider(OAUTH_STATE_STORE)
      .useValue({
        save: (state: string, payload: InstagramOAuthState) => {
          states.set(state, payload);
          return Promise.resolve();
        },
        consume: (state: string) => {
          const payload = states.get(state) ?? null;
          states.delete(state);
          return Promise.resolve(payload);
        },
      })
      .overrideProvider(INSTAGRAM_OAUTH_GATEWAY)
      .useValue(gateway)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const accessToken = async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ana@example.com', password: 'secret123' })
      .expect(200);

    return (login.body as { accessToken: string }).accessToken;
  };

  it('requires authentication to start a connection', async () => {
    await request(app.getHttpServer())
      .post('/meta/instagram/authorizations')
      .send({ expertId: expert.id })
      .expect(401);
  });

  it('connects the expert and redirects back to the frontend', async () => {
    const server = app.getHttpServer();
    const token = await accessToken();

    const startResponse = await request(server)
      .post('/meta/instagram/authorizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ expertId: expert.id })
      .expect(201);
    const { authorizationUrl } = startResponse.body as {
      authorizationUrl: string;
    };
    const state = new URL(authorizationUrl).searchParams.get('state')!;

    const callback = await request(server)
      .get('/meta/instagram/callback')
      .query({ state, code: 'auth-code#_' })
      .expect(302);

    expect(callback.headers.location).toBe(
      `${FRONTEND}/experts/${expert.id}?instagram=connected#instagram`,
    );
    expect(callback.headers['cache-control']).toBe('no-store');
    expect(callback.headers['referrer-policy']).toBe('no-referrer');
    expect(credentials).toHaveLength(1);
    expect(credentials[0].provider).toBe('instagram');
    expect(connectedAccounts).toHaveLength(1);
    expect(connectedAccounts[0]).toMatchObject({
      credentialId: credentials[0].id,
      externalId: '178414',
      displayName: 'carlaexpert',
    });
  });

  it('rejects forged states without touching any expert', async () => {
    const callback = await request(app.getHttpServer())
      .get('/meta/instagram/callback')
      .query({ state: 'forged', code: 'x' })
      .expect(302);

    expect(callback.headers.location).toBe(
      `${FRONTEND}/experts?instagram=error&reason=invalid_state#instagram`,
    );
  });

  it('reports when the user cancels on Instagram', async () => {
    const server = app.getHttpServer();
    const token = await accessToken();
    const startResponse = await request(server)
      .post('/meta/instagram/authorizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ expertId: expert.id })
      .expect(201);
    const state = new URL(
      (startResponse.body as { authorizationUrl: string }).authorizationUrl,
    ).searchParams.get('state')!;

    const callback = await request(server)
      .get('/meta/instagram/callback')
      .query({
        state,
        error: 'access_denied',
        error_reason: 'user_denied',
      })
      .expect(302);

    expect(callback.headers.location).toBe(
      `${FRONTEND}/experts/${expert.id}?instagram=error&reason=denied#instagram`,
    );
  });
});
