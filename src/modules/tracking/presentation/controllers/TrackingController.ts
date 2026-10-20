import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ValidationError } from 'yup';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import { CreateTrackingPixelUseCase } from '../../application/use-cases/CreateTrackingPixelUseCase';
import { GetTrackingPixelUseCase } from '../../application/use-cases/GetTrackingPixelUseCase';
import { SetTrackingPageLaunchUseCase } from '../../application/use-cases/SetTrackingPageLaunchUseCase';
import { StartTrackingSetupUseCase } from '../../application/use-cases/StartTrackingSetupUseCase';
import type { TrackingPixel } from '../../domain/entities/TrackingPixel';
import type { TrackingPageSummary } from '../../domain/repositories/TrackingRulesRepository';
import {
  startTrackingSetupSchema,
  type StartTrackingSetupSchemaInput,
} from '../schemas/TrackingSchemas';

@Controller('experts/:expertId/tracking')
export class TrackingController {
  constructor(
    private readonly getPixel: GetTrackingPixelUseCase,
    private readonly createPixel: CreateTrackingPixelUseCase,
    private readonly startSetup: StartTrackingSetupUseCase,
    private readonly setPageLaunch: SetTrackingPageLaunchUseCase,
  ) {}

  @Put('pages')
  @HttpCode(204)
  async page(
    @Param('expertId') expertId: string,
    @Body() body: unknown,
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<void> {
    this.validateExpertId(expertId);
    const { url, launchId } = (body ?? {}) as {
      url?: unknown;
      launchId?: unknown;
    };
    if (
      typeof url !== 'string' ||
      url.length > 2048 ||
      !(
        launchId === null ||
        (typeof launchId === 'string' && isUuidV7(launchId))
      )
    ) {
      throw DomainError.validationFailed({
        errors: ['Informe a página e o lançamento (ou null para nenhum).'],
      });
    }
    await this.setPageLaunch.execute({ expertId, url, launchId }, auth);
  }

  @Get('pixel')
  async pixel(
    @Param('expertId') expertId: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateExpertId(expertId);
    const { pixel, pages } = await this.getPixel.execute(expertId, auth);
    return this.toResponse(pixel, pages);
  }

  @Post('pixel')
  async activate(
    @Param('expertId') expertId: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateExpertId(expertId);
    await this.createPixel.execute(expertId, auth);

    const { pixel, pages } = await this.getPixel.execute(expertId, auth);
    return this.toResponse(pixel, pages);
  }

  @Post('setup-sessions')
  async setupSession(
    @Param('expertId') expertId: string,
    @Body() body: unknown,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateExpertId(expertId);
    const input = await this.validate(body);
    return this.startSetup.execute({ expertId, url: input.url }, auth);
  }

  private toResponse(pixel: TrackingPixel, pages: TrackingPageSummary[]) {
    return {
      id: pixel.id,
      publicKey: pixel.publicKey,
      scriptUrl: Environment.vars.TRACKING_SCRIPT_URL,
      allowedDomains: pixel.allowedDomains,
      installation: {
        status: pixel.lastEventAt ? 'installed' : 'waiting',
        lastEventAt: pixel.lastEventAt ?? null,
      },
      pages,
    };
  }

  private validateExpertId(expertId: string): void {
    if (!isUuidV7(expertId)) {
      throw DomainError.validationFailed({
        errors: ['Informe um expertId válido.'],
      });
    }
  }

  private async validate(
    body: unknown,
  ): Promise<StartTrackingSetupSchemaInput> {
    try {
      return await startTrackingSetupSchema.validate(body, {
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
