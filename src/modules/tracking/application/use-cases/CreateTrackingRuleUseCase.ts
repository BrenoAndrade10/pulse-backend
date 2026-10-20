import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import {
  TrackingRule,
  type TrackingRuleElement,
  type TrackingRuleField,
  type TrackingRuleScope,
  type TrackingRuleTrigger,
} from '../../domain/entities/TrackingRule';
import { TRACKING_RULES_REPOSITORY } from '../../domain/repositories/TrackingRulesRepository';
import type { TrackingRulesRepository } from '../../domain/repositories/TrackingRulesRepository';
import { TRACKING_SETUP_SESSION_STORE } from '../../domain/repositories/TrackingSetupSessionStore';
import type { TrackingSetupSessionStore } from '../../domain/repositories/TrackingSetupSessionStore';
import { pageOf } from '../pageOf';
import { resolveSetupSession } from '../resolveSetupSession';

export const MAX_RULES_PER_PIXEL = 200;

export type CreateTrackingRuleInput = {
  token?: string;
  origin?: string;
  scope: TrackingRuleScope;
  trigger: TrackingRuleTrigger;
  eventName: string;
  element: TrackingRuleElement;
  fields: TrackingRuleField[];
};

@Injectable()
export class CreateTrackingRuleUseCase {
  constructor(
    @Inject(TRACKING_SETUP_SESSION_STORE)
    private readonly sessions: TrackingSetupSessionStore,

    @Inject(TRACKING_RULES_REPOSITORY)
    private readonly rules: TrackingRulesRepository,

    @Inject(ID_GENERATOR)
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateTrackingRuleInput): Promise<TrackingRule> {
    const session = await resolveSetupSession(
      this.sessions,
      input.token,
      input.origin,
    );

    if (
      (await this.rules.countByPixel(session.pixelId)) >= MAX_RULES_PER_PIXEL
    ) {
      throw DomainError.validationFailed({
        errors: [
          `Este pixel já tem ${MAX_RULES_PER_PIXEL} eventos. Remova algum antes de criar outro.`,
        ],
      });
    }

    const now = new Date();
    return this.rules.create(
      new TrackingRule({
        id: this.ids.generate(),
        tenantId: session.tenantId,
        expertId: session.expertId,
        pixelId: session.pixelId,
        pageUrl: pageOf(session.url),
        scope: input.scope,
        trigger: input.trigger,
        eventName: input.eventName,
        element: input.element,
        fields: input.trigger === 'submit' ? input.fields : [],
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
}
