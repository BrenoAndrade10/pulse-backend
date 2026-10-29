import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import { USERS_REPOSITORY } from '../../../users/domain/repositories/UsersRepository';
import type { UsersRepository } from '../../../users/domain/repositories/UsersRepository';
import { DomainError } from '../../../../shared/errors/DomainError';
import { ConfirmTwoFactorUseCase } from '../../application/use-cases/ConfirmTwoFactorUseCase';
import { GetTwoFactorStatusUseCase } from '../../application/use-cases/GetTwoFactorStatusUseCase';
import { RegenerateRecoveryCodesUseCase } from '../../application/use-cases/RegenerateRecoveryCodesUseCase';
import { SetupTwoFactorUseCase } from '../../application/use-cases/SetupTwoFactorUseCase';
import { twoFactorCodeSchema } from '../schemas/TwoFactorCodeSchema';
import { TrustedDevicesService } from '../../application/services/TrustedDevicesService';
import {
  clearTrustedDeviceCookie,
  readTrustedDeviceCookie,
} from '../cookies/trustedDeviceCookie';
import { RateLimit } from '../../../../shared/presentation/decorators/RateLimit';

@Controller('auth/2fa')
export class TwoFactorController {
  constructor(
    private readonly status: GetTwoFactorStatusUseCase,
    private readonly setup: SetupTwoFactorUseCase,
    private readonly confirm: ConfirmTwoFactorUseCase,
    private readonly regenerate: RegenerateRecoveryCodesUseCase,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    private readonly trustedDevices: TrustedDevicesService,
  ) {}

  @Get()
  getStatus(
    @CurrentAuth() auth: AccessTokenClaims,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withHeaders(response, () => this.status.execute(auth.userId));
  }

  @Get('devices')
  async devices(
    @CurrentAuth() auth: AccessTokenClaims,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const token = readTrustedDeviceCookie(request);
    const currentHash = token ? this.trustedDevices.hash(token) : null;
    return (await this.trustedDevices.list(auth.userId)).map((device) => ({
      id: device.id,
      label: device.label,
      createdAt: device.createdAt.toISOString(),
      lastUsedAt: device.lastUsedAt.toISOString(),
      expiresAt: device.expiresAt.toISOString(),
      current: device.tokenHash === currentHash,
    }));
  }

  @Delete('devices/:id')
  @HttpCode(204)
  async revokeDevice(
    @CurrentAuth() auth: AccessTokenClaims,
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    const token = readTrustedDeviceCookie(request);
    const currentHash = token ? this.trustedDevices.hash(token) : null;
    const isCurrent = (await this.trustedDevices.list(auth.userId)).some(
      (device) => device.id === id && device.tokenHash === currentHash,
    );
    await this.trustedDevices.revoke(auth.userId, id);
    if (isCurrent) clearTrustedDeviceCookie(response);
  }

  @Post('setup')
  @HttpCode(200)
  @RateLimit([{ key: 'auth:2fa:setup', by: ['user'], limit: 10, window: 3600 }])
  setupTwoFactor(
    @CurrentAuth() auth: AccessTokenClaims,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withHeaders(response, async () => {
      const user = await this.users.findById(auth.userId);
      if (!user) throw new DomainError(401, 'UNAUTHENTICATED');
      return this.setup.execute(auth.userId, user.email);
    });
  }

  @Post('confirm')
  @HttpCode(200)
  @RateLimit([
    {
      key: 'auth:2fa:confirm',
      by: ['user'],
      limit: 5,
      window: 900,
      resetOnSuccess: true,
    },
  ])
  confirmTwoFactor(
    @CurrentAuth() auth: AccessTokenClaims,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withHeaders(response, async () => {
      const input = await twoFactorCodeSchema.validate(body, {
        abortEarly: false,
        stripUnknown: false,
      });
      return this.confirm.execute(auth.userId, input.code);
    });
  }

  @Post('recovery-codes')
  @HttpCode(200)
  @RateLimit([
    {
      key: 'auth:2fa:recovery-codes',
      by: ['user'],
      limit: 5,
      window: 900,
      resetOnSuccess: true,
    },
  ])
  regenerateRecoveryCodes(
    @CurrentAuth() auth: AccessTokenClaims,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withHeaders(response, async () => {
      const input = await twoFactorCodeSchema.validate(body, {
        abortEarly: false,
        stripUnknown: false,
      });
      return this.regenerate.execute(auth.userId, input.code);
    });
  }

  private async withHeaders<T>(
    response: Response,
    execute: () => Promise<T>,
  ): Promise<T> {
    response.setHeader('Cache-Control', 'no-store');
    try {
      return await execute();
    } catch (error) {
      if (error instanceof DomainError && error.statusCode === 429) {
        const retryAfter = (
          error.data as { retryAfterSeconds?: unknown } | null
        )?.retryAfterSeconds;
        if (typeof retryAfter === 'number') {
          response.setHeader('Retry-After', String(Math.ceil(retryAfter)));
        }
      }
      throw error;
    }
  }
}
