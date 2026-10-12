import { Session } from '../../domain/entities/Session';
import type {
  RotateRefreshTokenParams,
  SessionsRepository,
} from '../../domain/repositories/SessionsRepository';

export class InMemorySessionsRepository implements SessionsRepository {
  readonly sessions = new Map<string, Session>();

  create(session: Session): Promise<void> {
    this.sessions.set(session.id, session);

    return Promise.resolve();
  }

  findById(sessionId: string): Promise<Session | null> {
    return Promise.resolve(this.sessions.get(sessionId) ?? null);
  }

  exists(sessionId: string): Promise<boolean> {
    return Promise.resolve(this.sessions.has(sessionId));
  }

  rotateRefreshToken(params: RotateRefreshTokenParams): Promise<boolean> {
    const session = this.sessions.get(params.sessionId);

    if (
      !session ||
      session.refreshTokenHash !== params.currentRefreshTokenHash
    ) {
      return Promise.resolve(false);
    }

    this.sessions.set(
      session.id,
      new Session({
        id: session.id,
        userId: session.userId,
        tenantId: session.tenantId,
        refreshTokenHash: params.nextRefreshTokenHash,
        previousRefreshTokenHash: params.currentRefreshTokenHash,
        rotatedAt: params.rotatedAt,
        ip: session.ip,
        userAgent: session.userAgent,
        rememberMe: session.rememberMe,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      }),
    );

    return Promise.resolve(true);
  }

  delete(session: Session): Promise<void> {
    this.sessions.delete(session.id);

    return Promise.resolve();
  }

  deleteAllByUserId(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        this.sessions.delete(session.id);
      }
    }

    return Promise.resolve();
  }
}
