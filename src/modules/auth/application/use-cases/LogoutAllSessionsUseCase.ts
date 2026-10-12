import { Inject, Injectable } from '@nestjs/common';
import { SESSIONS_REPOSITORY } from '../../domain/repositories/SessionsRepository';
import type { SessionsRepository } from '../../domain/repositories/SessionsRepository';

@Injectable()
export class LogoutAllSessionsUseCase {
  constructor(
    @Inject(SESSIONS_REPOSITORY)
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  execute(userId: string): Promise<void> {
    return this.sessionsRepository.deleteAllByUserId(userId);
  }
}
