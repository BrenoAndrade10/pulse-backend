import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../../../shared/presentation/decorators/Public';
import { CollectEventsUseCase } from '../../application/collector/CollectEventsUseCase';
import {
  GetPixelConfigUseCase,
  type PublicPixelConfig,
} from '../../application/collector/GetPixelConfigUseCase';

@Public()
@Controller('t')
export class CollectorController {
  private readonly logger = new Logger(CollectorController.name);

  constructor(
    private readonly getConfig: GetPixelConfigUseCase,
    private readonly collect: CollectEventsUseCase,
  ) {}

  @Get(':publicKey/config')
  async config(
    @Param('publicKey') publicKey: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicPixelConfig> {
    const config = await this.getConfig.execute(publicKey);
    if (!config) throw new NotFoundException();

    response.setHeader('Cache-Control', 'public, max-age=60');
    return config;
  }

  @Post(':publicKey/events')
  @HttpCode(204)
  async events(
    @Param('publicKey') publicKey: string,
    @Headers('origin') origin: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<void> {
    try {
      await this.collect.execute({
        publicKey,
        origin,
        userAgent: userAgent ?? '',
        ip: request.ip ?? '',
        body,
      });
    } catch (error) {
      this.logger.error(`Lote de eventos descartado: ${String(error)}`);
    }
  }
}
