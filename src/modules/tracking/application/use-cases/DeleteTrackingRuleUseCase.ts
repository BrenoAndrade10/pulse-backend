import { Inject, Injectable } from '@nestjs/common';
import { TRACKING_RULES_REPOSITORY } from '../../domain/repositories/TrackingRulesRepository';
import type { TrackingRulesRepository } from '../../domain/repositories/TrackingRulesRepository';
import { TRACKING_SETUP_SESSION_STORE } from '../../domain/repositories/TrackingSetupSessionStore';
import type { TrackingSetupSessionStore } from '../../domain/repositories/TrackingSetupSessionStore';
import { resolveSetupSession } from '../resolveSetupSession';

/** Só remove regras do pixel da sessão. Idempotente. */
@Injectable()
export class DeleteTrackingRuleUseCase {
  constructor(
    @Inject(TRACKING_SETUP_SESSION_STORE)
    private readonly sessions: TrackingSetupSessionStore,

    @Inject(TRACKING_RULES_REPOSITORY)
    private readonly rules: TrackingRulesRepository,
  ) {}

  async execute(input: {
    token?: string;
    origin?: string;
    ruleId: string;
  }): Promise<void> {
    const session = await resolveSetupSession(
      this.sessions,
      input.token,
      input.origin,
    );
    await this.rules.delete(session.pixelId, input.ruleId);
  }
}
