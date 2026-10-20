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
import { User } from '../src/modules/users/domain/entities/User';
import { UserRole } from '../src/modules/users/domain/enums/UserRole';
import { UserStatus } from '../src/modules/users/domain/enums/UserStatus';
import { Argon2PasswordHasher } from '../src/shared/infra/hashing/Argon2PasswordHasher';
import { UuidV7IdGenerator } from '../src/shared/infra/ids/UuidV7IdGenerator';
import { REDIS_CLIENT } from '../src/shared/infra/redis/tokens';

/**
 * Exercita o fluxo HTTP completo (guard global, cookie, CORS, filtro de erros)
 * com Redis e Postgres substituídos por repositórios em memória.
 */
describe('Auth (e2e)', () => {
  const ORIGIN = 'http://localhost:5173';
  const idGenerator = new UuidV7IdGenerator();
  let app: NestExpressApplication;
  let sessionsRepository: InMemorySessionsRepository;

  beforeAll(async () => {
    Environment.vars = {
      PORT: 3000,
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
      CORS_ORIGIN: ORIGIN,
      TRUST_PROXY: false,
      INSTAGRAM_SCOPES: 'instagram_business_basic',
      INSTAGRAM_GRAPH_API_VERSION: 'v25.0',
      FRONTEND_URL: ORIGIN,
      TRACKING_SCRIPT_URL: 'https://cdn.test/p.js',
      TRACKING_ALLOW_LOCAL_PAGES: false,
    };

    const accountsRepository = new InMemoryAuthAccountsRepository();
    const now = new Date();
    const user = new User({
      id: idGenerator.generate(),
      firstName: 'Breno',
      email: 'breno@example.com',
      passwordHash: await new Argon2PasswordHasher().hash('secret123'),
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
    accountsRepository.users.push(user);
    accountsRepository.memberships.set(user.id, [
      {
        tenantId: idGenerator.generate(),
        tenantName: 'Launch Company',
        role: UserRole.ADMIN,
      },
    ]);
    sessionsRepository = new InMemorySessionsRepository();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATA_SOURCE)
      .useValue({ getRepository: () => ({}) })
      .overrideProvider(REDIS_CLIENT)
      .useValue({ quit: () => Promise.resolve() })
      .overrideProvider(SESSIONS_REPOSITORY)
      .useValue(sessionsRepository)
      .overrideProvider(AUTH_ACCOUNTS_REPOSITORY)
      .useValue(accountsRepository)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const expectReason =
    (reason: string) =>
    ({ body }: request.Response): void => {
      expect((body as { reason?: string }).reason).toBe(reason);
    };

  const refreshCookieFrom = (response: request.Response): string => {
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    const cookie = setCookie.find((value) =>
      value.startsWith('refresh_token='),
    );

    if (!cookie) {
      throw new Error('refresh_token cookie not set');
    }

    return cookie;
  };

  it('runs the full session lifecycle', async () => {
    const server = app.getHttpServer();

    // Rotas protegidas exigem token; rotas @Public() não.
    await request(server)
      .get('/experts')
      .expect(401)
      .expect(expectReason('UNAUTHENTICATED'));
    await request(server).get('/').expect(200);

    // Login: access token no corpo, refresh token só no cookie.
    const login = await request(server)
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .send({
        email: 'Breno@Example.com ',
        password: 'secret123',
        rememberMe: true,
      })
      .expect(200);
    const loginCookie = refreshCookieFrom(login);

    expect(login.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(login.headers['access-control-allow-credentials']).toBe('true');
    expect(login.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { email: 'breno@example.com' },
      activeTenant: { tenantName: 'Launch Company', role: UserRole.ADMIN },
    });
    expect(JSON.stringify(login.body)).not.toContain('refresh');
    expect(loginCookie).toMatch(/HttpOnly/);
    expect(loginCookie).toMatch(/Secure/);
    expect(loginCookie).toMatch(/SameSite=Strict/);
    expect(loginCookie).toMatch(/Path=\/auth/);
    // "Lembrar de mim": cookie persistente.
    expect(loginCookie).toMatch(/Max-Age=/);

    const { accessToken } = login.body as { accessToken: string };

    await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect((body as { user: { email: string } }).user.email).toBe(
          'breno@example.com',
        ),
      );

    // Refresh usa só o cookie e devolve um cookie novo (rotação).
    const refresh = await request(server)
      .post('/auth/refresh')
      .set('Cookie', loginCookie.split(';')[0])
      .expect(200);
    const refreshCookie = refreshCookieFrom(refresh);

    expect(refreshCookie.split(';')[0]).not.toBe(loginCookie.split(';')[0]);
    // A rotação mantém a escolha feita no login.
    expect(refreshCookie).toMatch(/Max-Age=/);

    // Logout derruba a sessão: o access token antigo para de valer na hora.
    await request(server)
      .post('/auth/logout')
      .set('Cookie', refreshCookie.split(';')[0])
      .expect(204)
      .expect((response) =>
        expect(refreshCookieFrom(response)).toMatch(/Expires=Thu, 01 Jan 1970/),
      );
    expect(sessionsRepository.sessions.size).toBe(0);

    await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401)
      .expect(expectReason('SESSION_REVOKED'));
  });

  it('issues a browser-session cookie when rememberMe is off', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'breno@example.com', password: 'secret123' })
      .expect(200);
    const cookie = refreshCookieFrom(login);

    expect(cookie).not.toMatch(/Max-Age=/);
    expect(cookie).not.toMatch(/Expires=/);
  });

  it('rejects invalid credentials and invalid payloads', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/auth/login')
      .send({ email: 'breno@example.com', password: 'wrong' })
      .expect(401)
      .expect(expectReason('INVALID_CREDENTIALS'));

    await request(server)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'x', isAdmin: true })
      .expect(400)
      .expect(expectReason('VALIDATION_FAILED'));

    await request(server)
      .post('/auth/refresh')
      .expect(401)
      .expect(expectReason('INVALID_REFRESH_TOKEN'));
  });
});
