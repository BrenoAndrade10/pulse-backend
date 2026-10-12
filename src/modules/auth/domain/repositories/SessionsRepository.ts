import { Session } from '../entities/Session';

export const SESSIONS_REPOSITORY = Symbol('SESSIONS_REPOSITORY');

export type RotateRefreshTokenParams = {
  sessionId: string;
  currentRefreshTokenHash: string;
  nextRefreshTokenHash: string;
  rotatedAt: Date;
  ttlSeconds: number;
};

export interface SessionsRepository {
  create(session: Session, ttlSeconds: number): Promise<void>;
  findById(sessionId: string): Promise<Session | null>;
  exists(sessionId: string): Promise<boolean>;
  /**
   * Troca o hash do refresh token de forma atômica, somente se o hash atual
   * ainda for `currentRefreshTokenHash`. Retorna false se outra requisição
   * rotacionou antes.
   */
  rotateRefreshToken(params: RotateRefreshTokenParams): Promise<boolean>;
  delete(session: Session): Promise<void>;
  deleteAllByUserId(userId: string): Promise<void>;
}
