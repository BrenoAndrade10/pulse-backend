import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Public } from '../../../../shared/presentation/decorators/Public';
import type { AuthProfile, AuthResult } from '../../application/AuthProfile';
import { GetAuthProfileUseCase } from '../../application/use-cases/GetAuthProfileUseCase';
import { LoginUseCase } from '../../application/use-cases/LoginUseCase';
import { LogoutAllSessionsUseCase } from '../../application/use-cases/LogoutAllSessionsUseCase';
import { LogoutUseCase } from '../../application/use-cases/LogoutUseCase';
import { RefreshSessionUseCase } from '../../application/use-cases/RefreshSessionUseCase';
import type { AccessTokenClaims } from '../../domain/types/AccessTokenClaims';
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from '../cookies/refreshTokenCookie';
import { CurrentAuth } from '../decorators/CurrentAuth';
import { loginSchema } from '../schemas/LoginSchema';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllSessionsUseCase: LogoutAllSessionsUseCase,
    private readonly getAuthProfileUseCase: GetAuthProfileUseCase,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = await loginSchema.validate(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    const result = await this.loginUseCase.execute({
      ...input,
      ip: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    });

    return this.sendAuthResult(response, result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.refreshSessionUseCase.execute({
        refreshToken: readRefreshTokenCookie(request),
      });

      return this.sendAuthResult(response, result);
    } catch (error) {
      if (error instanceof DomainError && error.statusCode === 401) {
        clearRefreshTokenCookie(response);
      }

      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logoutUseCase.execute({
      refreshToken: readRefreshTokenCookie(request),
    });

    clearRefreshTokenCookie(response);
  }

  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(
    @CurrentAuth() auth: AccessTokenClaims,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logoutAllSessionsUseCase.execute(auth.userId);

    clearRefreshTokenCookie(response);
  }

  @Get('me')
  me(@CurrentAuth() auth: AccessTokenClaims): Promise<AuthProfile> {
    return this.getAuthProfileUseCase.execute({
      userId: auth.userId,
      tenantId: auth.tenantId,
    });
  }

  private sendAuthResult(response: Response, result: AuthResult) {
    if (result.refreshToken) {
      setRefreshTokenCookie(response, result.refreshToken, {
        expiresAt: result.refreshTokenExpiresAt,
        persistent: result.rememberMe,
      });
    }

    return {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: result.accessTokenExpiresIn,
      ...result.profile,
    };
  }
}
