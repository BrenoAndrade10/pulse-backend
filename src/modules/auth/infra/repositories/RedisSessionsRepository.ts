import type { Redis } from '@upstash/redis';
import { Session } from '../../domain/entities/Session';
import type {
  RotateRefreshTokenParams,
  SessionsRepository,
} from '../../domain/repositories/SessionsRepository';

const MAX_USER_AGENT_LENGTH = 512;

/**
 * Compara e troca o hash numa única operação no Redis, evitando que duas
 * requisições simultâneas rotacionem o mesmo refresh token.
 */
const ROTATE_REFRESH_TOKEN_SCRIPT = `
local current = redis.call('HGET', KEYS[1], 'refreshTokenHash')
if not current or current ~= ARGV[1] then
  return 0
end
redis.call('HSET', KEYS[1],
  'refreshTokenHash', ARGV[2],
  'previousRefreshTokenHash', ARGV[1],
  'rotatedAt', ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 1
`;

type SessionHash = Record<string, string>;

export class RedisSessionsRepository implements SessionsRepository {
  private readonly rotateRefreshTokenScript: ReturnType<Redis['createScript']>;

  constructor(private readonly redis: Redis) {
    this.rotateRefreshTokenScript = this.redis.createScript<number>(
      ROTATE_REFRESH_TOKEN_SCRIPT,
    );
  }

  async create(session: Session, ttlSeconds: number): Promise<void> {
    const sessionKey = this.sessionKey(session.id);
    const userSessionsKey = this.userSessionsKey(session.userId);

    await this.redis
      .multi()
      .hset(sessionKey, this.toHash(session))
      .expire(sessionKey, ttlSeconds)
      .sadd(userSessionsKey, session.id)
      // Sessões novas sempre vencem depois das antigas, então o índice do
      // usuário pode acompanhar o vencimento da mais recente.
      .pexpireat(userSessionsKey, session.expiresAt.getTime())
      .exec();
  }

  async findById(sessionId: string): Promise<Session | null> {
    const hash = await this.redis.hgetall<SessionHash>(
      this.sessionKey(sessionId),
    );

    if (!hash?.refreshTokenHash) {
      return null;
    }

    return this.toDomain(sessionId, hash);
  }

  async exists(sessionId: string): Promise<boolean> {
    return (await this.redis.exists(this.sessionKey(sessionId))) === 1;
  }

  async rotateRefreshToken(params: RotateRefreshTokenParams): Promise<boolean> {
    const result = await this.rotateRefreshTokenScript.exec(
      [this.sessionKey(params.sessionId)],
      [
        params.currentRefreshTokenHash,
        params.nextRefreshTokenHash,
        String(params.rotatedAt.getTime()),
        String(params.ttlSeconds),
      ],
    );

    return result === 1;
  }

  async delete(session: Session): Promise<void> {
    await this.redis
      .multi()
      .del(this.sessionKey(session.id))
      .srem(this.userSessionsKey(session.userId), session.id)
      .exec();
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    const userSessionsKey = this.userSessionsKey(userId);
    const sessionIds = await this.redis.smembers(userSessionsKey);

    await this.redis
      .multi()
      .del(
        userSessionsKey,
        ...sessionIds.map((sessionId) => this.sessionKey(sessionId)),
      )
      .exec();
  }

  private sessionKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  private userSessionsKey(userId: string): string {
    return `auth:user-sessions:${userId}`;
  }

  private toHash(session: Session): SessionHash {
    return {
      userId: session.userId,
      tenantId: session.tenantId ?? '',
      refreshTokenHash: session.refreshTokenHash,
      previousRefreshTokenHash: session.previousRefreshTokenHash ?? '',
      rotatedAt: session.rotatedAt ? String(session.rotatedAt.getTime()) : '',
      ip: session.ip ?? '',
      userAgent: (session.userAgent ?? '').slice(0, MAX_USER_AGENT_LENGTH),
      rememberMe: session.rememberMe ? 'true' : 'false',
      createdAt: String(session.createdAt.getTime()),
      expiresAt: String(session.expiresAt.getTime()),
    };
  }

  private toDomain(sessionId: string, hash: SessionHash): Session {
    return new Session({
      id: sessionId,
      userId: hash.userId,
      tenantId: hash.tenantId || null,
      refreshTokenHash: hash.refreshTokenHash,
      previousRefreshTokenHash: hash.previousRefreshTokenHash || null,
      rotatedAt: hash.rotatedAt ? new Date(Number(hash.rotatedAt)) : null,
      ip: hash.ip || null,
      userAgent: hash.userAgent || null,
      // O cliente do Upstash desserializa 'true' para boolean automaticamente.
      rememberMe: String(hash.rememberMe) === 'true',
      createdAt: new Date(Number(hash.createdAt)),
      expiresAt: new Date(Number(hash.expiresAt)),
    });
  }
}
