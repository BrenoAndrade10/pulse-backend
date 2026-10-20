import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { LAUNCHES_REPOSITORY } from '../../domain/repositories/LaunchesRepository';
import type { LaunchesRepository } from '../../domain/repositories/LaunchesRepository';
import { requireLaunchAdmin } from '../LaunchAuthorization';

@Injectable()
export class DeleteLaunchUseCase {
  constructor(
    @Inject(LAUNCHES_REPOSITORY) private readonly launches: LaunchesRepository,
  ) {}

  async execute(id: string, auth: AccessTokenClaims): Promise<void> {
    const deleted = await this.launches.softDeleteByTenantIdAndId(
      requireLaunchAdmin(auth),
      id,
      auth.userId,
    );
    if (!deleted) throw DomainError.launchNotFound();
  }
}
