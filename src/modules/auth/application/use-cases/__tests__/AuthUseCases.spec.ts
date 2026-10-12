import { JwtService } from '@nestjs/jwt';
import { DomainError } from '../../../../../shared/errors/DomainError';
import { Argon2PasswordHasher } from '../../../../../shared/infra/hashing/Argon2PasswordHasher';
import { UuidV7IdGenerator } from '../../../../../shared/infra/ids/UuidV7IdGenerator';
import { User } from '../../../../users/domain/entities/User';
import { UserRole } from '../../../../users/domain/enums/UserRole';
import { UserStatus } from '../../../../users/domain/enums/UserStatus';
import { Session } from '../../../domain/entities/Session';
import { InMemoryAuthAccountsRepository } from '../../../infra/repositories/InMemoryAuthAccountsRepository';
import { InMemorySessionsRepository } from '../../../infra/repositories/InMemorySessionsRepository';
import { JwtAccessTokenService } from '../../../infra/tokens/JwtAccessTokenService';
import type { AuthSettings } from '../../AuthSettings';
import { RefreshTokenCodec } from '../../services/RefreshTokenCodec';
import { LoginUseCase } from '../LoginUseCase';
import { LogoutUseCase } from '../LogoutUseCase';
import { RefreshSessionUseCase } from '../RefreshSessionUseCase';

const JWT_SECRET = 'test-secret-with-at-least-32-characters!!';

function buildAccessTokenService(secret = JWT_SECRET): JwtAccessTokenService {
  return new JwtAccessTokenService(
    new JwtService({
      secret,
      signOptions: {
        algorithm: 'HS256',
        expiresIn: 900,
        issuer: 'test',
        audience: 'test-app',
      },
      verifyOptions: {
        algorithms: ['HS256'],
        issuer: 'test',
        audience: 'test-app',
      },
    }),
  );
}

describe('Auth use cases', () => {
  const settings: AuthSettings = {
    accessTokenTtlSeconds: 900,
    refreshTokenIdleTtlSeconds: 604800,
    sessionAbsoluteTtlSeconds: 2592000,
    refreshTokenGracePeriodSeconds: 10,
  };
  const passwordHasher = new Argon2PasswordHasher();
  const idGenerator = new UuidV7IdGenerator();
  const tenantId = idGenerator.generate();

  let accountsRepository: InMemoryAuthAccountsRepository;
  let sessionsRepository: InMemorySessionsRepository;
  let accessTokenService: JwtAccessTokenService;
  let loginUseCase: LoginUseCase;
  let refreshSessionUseCase: RefreshSessionUseCase;
  let logoutUseCase: LogoutUseCase;
  let user: User;

  beforeAll(async () => {
    const now = new Date();

    user = new User({
      id: idGenerator.generate(),
      firstName: 'Breno',
      email: 'breno@example.com',
      passwordHash: await passwordHasher.hash('secret123'),
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  });

  beforeEach(() => {
    accountsRepository = new InMemoryAuthAccountsRepository();
    accountsRepository.users.push(user);
    accountsRepository.memberships.set(user.id, [
      { tenantId, tenantName: 'Launch Company', role: UserRole.ADMIN },
    ]);
    sessionsRepository = new InMemorySessionsRepository();
    accessTokenService = buildAccessTokenService();

    loginUseCase = new LoginUseCase(
      accountsRepository,
      sessionsRepository,
      accessTokenService,
      passwordHasher,
      idGenerator,
      settings,
    );
    refreshSessionUseCase = new RefreshSessionUseCase(
      accountsRepository,
      sessionsRepository,
      accessTokenService,
      settings,
    );
    logoutUseCase = new LogoutUseCase(sessionsRepository);
  });

  const login = () =>
    loginUseCase.execute({
      email: 'breno@example.com',
      password: 'secret123',
      rememberMe: true,
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

  const expectDomainError = async (
    promise: Promise<unknown>,
    statusCode: number,
    reason: string,
  ) => {
    const error: unknown = await promise.catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ statusCode, reason });
  };

  /** Simula a passagem do tempo desde a última rotação da sessão. */
  const ageLastRotation = (sessionId: string, seconds: number) => {
    const session = sessionsRepository.sessions.get(sessionId)!;

    sessionsRepository.sessions.set(
      sessionId,
      new Session({
        id: session.id,
        userId: session.userId,
        tenantId: session.tenantId,
        refreshTokenHash: session.refreshTokenHash,
        previousRefreshTokenHash: session.previousRefreshTokenHash,
        rotatedAt: new Date(Date.now() - seconds * 1000),
        ip: session.ip,
        userAgent: session.userAgent,
        rememberMe: session.rememberMe,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      }),
    );
  };

  describe('LoginUseCase', () => {
    it('creates a session and returns tokens for the oldest tenant', async () => {
      const result = await login();
      const claims = await accessTokenService.verify(result.accessToken);
      const parsed = RefreshTokenCodec.parse(result.refreshToken)!;
      const session = sessionsRepository.sessions.get(parsed.sessionId)!;

      expect(claims).toEqual({
        userId: user.id,
        sessionId: parsed.sessionId,
        tenantId,
        role: UserRole.ADMIN,
      });
      expect(result.profile.activeTenant?.tenantId).toBe(tenantId);
      expect(session.refreshTokenHash).toBe(
        RefreshTokenCodec.hashSecret(parsed.secret),
      );
      expect(session.refreshTokenHash).not.toContain(parsed.secret);
      expect(accountsRepository.lastLogins.get(user.id)).toBeInstanceOf(Date);
    });

    it.each([
      ['wrong password', 'breno@example.com', 'wrong-password'],
      ['unknown e-mail', 'nobody@example.com', 'secret123'],
    ])(
      'returns the same generic error for %s',
      async (_case, email, password) => {
        await expectDomainError(
          loginUseCase.execute({
            email,
            password,
            rememberMe: false,
            ip: null,
            userAgent: null,
          }),
          401,
          'INVALID_CREDENTIALS',
        );
        expect(sessionsRepository.sessions.size).toBe(0);
      },
    );

    it('rejects inactive users with the generic error', async () => {
      const inactiveUser = new User({
        id: idGenerator.generate(),
        firstName: 'Inactive',
        email: 'inactive@example.com',
        passwordHash: user.passwordHash,
        status: UserStatus.INACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      accountsRepository.users.push(inactiveUser);

      await expectDomainError(
        loginUseCase.execute({
          email: 'inactive@example.com',
          password: 'secret123',
          rememberMe: false,
          ip: null,
          userAgent: null,
        }),
        401,
        'INVALID_CREDENTIALS',
      );
    });

    it('rejects a tenant the user does not belong to', async () => {
      await expectDomainError(
        loginUseCase.execute({
          email: 'breno@example.com',
          password: 'secret123',
          tenantId: idGenerator.generate(),
          rememberMe: false,
          ip: null,
          userAgent: null,
        }),
        403,
        'TENANT_ACCESS_DENIED',
      );
    });
  });

  describe('RefreshSessionUseCase', () => {
    it('rotates the refresh token', async () => {
      const loginResult = await login();
      const refreshResult = await refreshSessionUseCase.execute({
        refreshToken: loginResult.refreshToken!,
      });

      expect(refreshResult.refreshToken).toBeTruthy();
      expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken);
      expect(
        await accessTokenService.verify(refreshResult.accessToken),
      ).toMatchObject({ userId: user.id, tenantId });
    });

    it('accepts the previous token inside the grace period without rotating again', async () => {
      const loginResult = await login();
      await refreshSessionUseCase.execute({
        refreshToken: loginResult.refreshToken!,
      });

      const concurrentResult = await refreshSessionUseCase.execute({
        refreshToken: loginResult.refreshToken!,
      });

      expect(concurrentResult.accessToken).toBeTruthy();
      expect(concurrentResult.refreshToken).toBeNull();
    });

    it('revokes the session when an old token is reused after the grace period', async () => {
      const loginResult = await login();
      const { sessionId } = RefreshTokenCodec.parse(loginResult.refreshToken)!;
      const refreshResult = await refreshSessionUseCase.execute({
        refreshToken: loginResult.refreshToken!,
      });
      ageLastRotation(sessionId, 60);

      await expectDomainError(
        refreshSessionUseCase.execute({
          refreshToken: loginResult.refreshToken!,
        }),
        401,
        'REFRESH_TOKEN_REUSED',
      );
      expect(sessionsRepository.sessions.has(sessionId)).toBe(false);

      // O token legítimo mais recente também morre junto com a sessão.
      await expectDomainError(
        refreshSessionUseCase.execute({
          refreshToken: refreshResult.refreshToken!,
        }),
        401,
        'INVALID_REFRESH_TOKEN',
      );
    });

    it('rejects malformed tokens', async () => {
      await expectDomainError(
        refreshSessionUseCase.execute({ refreshToken: 'not-a-token' }),
        401,
        'INVALID_REFRESH_TOKEN',
      );
      await expectDomainError(
        refreshSessionUseCase.execute({ refreshToken: undefined }),
        401,
        'INVALID_REFRESH_TOKEN',
      );
    });

    it('revokes the session when the user lost access to the tenant', async () => {
      const loginResult = await login();
      accountsRepository.memberships.set(user.id, []);

      await expectDomainError(
        refreshSessionUseCase.execute({
          refreshToken: loginResult.refreshToken!,
        }),
        401,
        'TENANT_ACCESS_REVOKED',
      );
      expect(sessionsRepository.sessions.size).toBe(0);
    });
  });

  describe('LogoutUseCase', () => {
    it('deletes the session for a valid refresh token', async () => {
      const loginResult = await login();

      await logoutUseCase.execute({ refreshToken: loginResult.refreshToken! });

      expect(sessionsRepository.sessions.size).toBe(0);
    });

    it('does not delete the session when only the session id is known', async () => {
      const loginResult = await login();
      const { sessionId } = RefreshTokenCodec.parse(loginResult.refreshToken)!;
      const forgedToken = RefreshTokenCodec.generate(sessionId).token;

      await logoutUseCase.execute({ refreshToken: forgedToken });

      expect(sessionsRepository.sessions.has(sessionId)).toBe(true);
    });
  });

  describe('JwtAccessTokenService', () => {
    it('rejects tokens signed with another secret', async () => {
      const foreignToken = await buildAccessTokenService(
        'another-secret-with-at-least-32-chars!!',
      ).sign({
        userId: user.id,
        sessionId: idGenerator.generate(),
        tenantId: null,
        role: null,
      });

      expect(await accessTokenService.verify(foreignToken)).toBeNull();
    });

    it('rejects unsigned tokens (alg "none")', async () => {
      const encode = (value: object) =>
        Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsignedToken = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
        sub: user.id,
        sid: idGenerator.generate(),
        iss: 'test',
        aud: 'test-app',
      })}.`;

      expect(await accessTokenService.verify(unsignedToken)).toBeNull();
    });
  });
});
