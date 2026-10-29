import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ValidationError } from 'yup';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import { ConnectWhatsAppUseCase } from '../../application/use-cases/ConnectWhatsAppUseCase';
import { DisconnectWhatsAppUseCase } from '../../application/use-cases/DisconnectWhatsAppUseCase';
import {
  GetWhatsAppConnectionUseCase,
  type WhatsAppConnectionOutput,
} from '../../application/use-cases/GetWhatsAppConnectionUseCase';
import { connectWhatsAppSchema } from '../schemas/ConnectWhatsAppSchema';
import { RateLimit } from '../../../../shared/presentation/decorators/RateLimit';

@Controller('experts/:expertId/whatsapp/connection')
export class WhatsAppConnectionController {
  constructor(
    private readonly connectWhatsApp: ConnectWhatsAppUseCase,
    private readonly getWhatsApp: GetWhatsAppConnectionUseCase,
    private readonly disconnectWhatsApp: DisconnectWhatsAppUseCase,
  ) {}

  @Post()
  @RateLimit([
    {
      key: 'meta:whatsapp-connection',
      by: ['user'],
      limit: 5,
      window: 60,
    },
  ])
  async connect(
    @Param('expertId') expertId: string,
    @Body() body: unknown,
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<WhatsAppConnectionOutput> {
    if (!auth.tenantId) throw new DomainError(403, 'TENANT_REQUIRED');

    try {
      const input = await connectWhatsAppSchema.validate(body, {
        abortEarly: false,
        stripUnknown: false,
      });
      return this.connectWhatsApp.execute({
        tenantId: auth.tenantId,
        expertId,
        ...input,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw DomainError.validationFailed({ errors: error.errors });
      }
      throw error;
    }
  }

  @Get()
  get(
    @Param('expertId') expertId: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<WhatsAppConnectionOutput> {
    return this.getWhatsApp.execute(auth.tenantId, expertId);
  }

  @Delete()
  @HttpCode(204)
  disconnect(
    @Param('expertId') expertId: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<void> {
    return this.disconnectWhatsApp.execute(auth.tenantId, expertId);
  }
}
