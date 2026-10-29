import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { AdminResetTwoFactorUseCase } from '../../application/use-cases/AdminResetTwoFactorUseCase';
import type { AccessTokenClaims } from '../../domain/types/AccessTokenClaims';
import { CurrentAuth } from '../decorators/CurrentAuth';

@Controller('users')
export class TwoFactorAdminController {
  constructor(private readonly reset: AdminResetTwoFactorUseCase) {}

  @Post(':userId/2fa/reset')
  @HttpCode(204)
  execute(
    @CurrentAuth() auth: AccessTokenClaims,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<void> {
    return this.reset.execute(auth, userId);
  }
}
