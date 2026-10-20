import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ValidationError } from 'yup';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Public } from '../../../../shared/presentation/decorators/Public';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import { CreateTrackingRuleUseCase } from '../../application/use-cases/CreateTrackingRuleUseCase';
import { DeleteTrackingRuleUseCase } from '../../application/use-cases/DeleteTrackingRuleUseCase';
import { OpenTrackingSetupUseCase } from '../../application/use-cases/OpenTrackingSetupUseCase';
import type { TrackingRule } from '../../domain/entities/TrackingRule';
import {
  createTrackingRuleSchema,
  type CreateTrackingRuleSchemaInput,
} from '../schemas/TrackingRuleSchema';

export const SETUP_TOKEN_HEADER = 'x-pulse-setup-token';

/**
 * Rotas do editor visual, chamadas pela página do cliente. Públicas (sem
 * login do Pulse): quem autoriza é o token do modo de configuração, preso à
 * origem da página.
 */
@Public()
@Controller('t/setup')
export class TrackerSetupController {
  constructor(
    private readonly openSetup: OpenTrackingSetupUseCase,
    private readonly createRule: CreateTrackingRuleUseCase,
    private readonly deleteRule: DeleteTrackingRuleUseCase,
  ) {}

  @Post('session')
  @HttpCode(200)
  async session(
    @Headers(SETUP_TOKEN_HEADER) token: string | undefined,
    @Headers('origin') origin: string | undefined,
  ) {
    const setup = await this.openSetup.execute({ token, origin });
    return {
      publicKey: setup.publicKey,
      pageUrl: setup.pageUrl,
      rules: setup.rules.map((rule) => this.toResponse(rule)),
    };
  }

  @Post('rules')
  async create(
    @Headers(SETUP_TOKEN_HEADER) token: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Body() body: unknown,
  ) {
    const input = await this.validate(body);
    const rule = await this.createRule.execute({
      token,
      origin,
      scope: input.scope,
      trigger: input.trigger,
      eventName: input.eventName,
      element: {
        selector: input.element.selector,
        tag: input.element.tag,
        text: input.element.text || undefined,
        attributes: input.element.attributes,
      },
      fields: input.fields,
    });
    return this.toResponse(rule);
  }

  @Delete('rules/:ruleId')
  @HttpCode(204)
  async delete(
    @Headers(SETUP_TOKEN_HEADER) token: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Param('ruleId') ruleId: string,
  ): Promise<void> {
    if (!isUuidV7(ruleId)) {
      throw DomainError.validationFailed({ errors: ['Evento inválido.'] });
    }
    await this.deleteRule.execute({ token, origin, ruleId });
  }

  private toResponse(rule: TrackingRule) {
    return {
      id: rule.id,
      scope: rule.scope,
      trigger: rule.trigger,
      eventName: rule.eventName,
      element: rule.element,
      fields: rule.fields,
      createdAt: rule.createdAt,
    };
  }

  private async validate(
    body: unknown,
  ): Promise<CreateTrackingRuleSchemaInput> {
    try {
      return await createTrackingRuleSchema.validate(body, {
        abortEarly: false,
        stripUnknown: false,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw DomainError.validationFailed({ errors: error.errors });
      }
      throw error;
    }
  }
}
