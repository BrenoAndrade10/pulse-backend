import { Inject, Injectable } from '@nestjs/common';
import { SESSIONS_REPOSITORY } from '../../domain/repositories/SessionsRepository';
import type { SessionsRepository } from '../../domain/repositories/SessionsRepository';
import { TrustedDevicesService } from '../../../two-factor/application/services/TrustedDevicesService';

@Injectable()
export class LogoutAllSessionsUseCase {
  constructor(
    @Inject(SESSIONS_REPOSITORY)
    private readonly sessionsRepository: SessionsRepository,
    private readonly trustedDevices: TrustedDevicesService,
  ) {}

  async execute(userId: string): Promise<void> {
    await Promise.all([
      this.sessionsRepository.deleteAllByUserId(userId),
      this.trustedDevices.revokeAll(userId),
    ]);
  }
}
