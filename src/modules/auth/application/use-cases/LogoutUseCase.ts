import { Inject, Injectable } from '@nestjs/common';
import { SESSIONS_REPOSITORY } from '../../domain/repositories/SessionsRepository';
import type { SessionsRepository } from '../../domain/repositories/SessionsRepository';
import { RefreshTokenCodec } from '../services/RefreshTokenCodec';

export type LogoutUseCaseInput = {
  refreshToken: string | undefined;
};

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSIONS_REPOSITORY)
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  /**
   * Idempotente: token ausente, inválido ou já revogado não gera erro.
   * Exige o segredo do refresh token (e não só o id da sessão) para que
   * ninguém derrube a sessão de outra pessoa conhecendo apenas o id.
   */
  async execute(input: LogoutUseCaseInput): Promise<void> {
    const parsedToken = RefreshTokenCodec.parse(input.refreshToken);

    if (!parsedToken) {
      return;
    }

    const session = await this.sessionsRepository.findById(
      parsedToken.sessionId,
    );

    if (!session) {
      return;
    }

    const presentedHash = RefreshTokenCodec.hashSecret(parsedToken.secret);

    if (
      RefreshTokenCodec.hashesMatch(presentedHash, session.refreshTokenHash) ||
      RefreshTokenCodec.hashesMatch(
        presentedHash,
        session.previousRefreshTokenHash,
      )
    ) {
      await this.sessionsRepository.delete(session);
    }
  }
}
