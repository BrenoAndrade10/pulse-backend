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
import { ForgotPasswordUseCase } from '../../application/use-cases/ForgotPasswordUseCase';
import { LoginUseCase } from '../../application/use-cases/LoginUseCase';
import { LogoutAllSessionsUseCase } from '../../application/use-cases/LogoutAllSessionsUseCase';
import { LogoutUseCase } from '../../application/use-cases/LogoutUseCase';
import { RefreshSessionUseCase } from '../../application/use-cases/RefreshSessionUseCase';
import { ResetPasswordUseCase } from '../../application/use-cases/ResetPasswordUseCase';
import { TwoFactorChallengeUseCase } from '../../application/use-cases/challenge/TwoFactorChallengeUseCase';
import type { ChallengeCompletion } from '../../application/use-cases/challenge/TwoFactorChallengeUseCase';
import { EmailChallengeUseCase } from '../../application/use-cases/challenge/EmailChallengeUseCase';
import type { AccessTokenClaims } from '../../domain/types/AccessTokenClaims';
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from '../cookies/refreshTokenCookie';
import { CurrentAuth } from '../decorators/CurrentAuth';
import { loginSchema } from '../schemas/LoginSchema';
import { forgotPasswordSchema } from '../schemas/ForgotPasswordSchema';
import { resetPasswordSchema } from '../schemas/ResetPasswordSchema';
import {
  clearTrustedDeviceCookie,
  readTrustedDeviceCookie,
  setTrustedDeviceCookie,
} from '../../../two-factor/presentation/cookies/trustedDeviceCookie';
import {
  challengeVerifySchema,
  emailChallengeResendSchema,
  emailChallengeVerifySchema,
} from '../schemas/AuthChallengeSchemas';
import { RateLimit } from '../../../../shared/presentation/decorators/RateLimit';

const FORGOT_RESPONSE = {
  message:
    'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.',
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllSessionsUseCase: LogoutAllSessionsUseCase,
    private readonly getAuthProfileUseCase: GetAuthProfileUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly twoFactorChallenge: TwoFactorChallengeUseCase,
    private readonly emailChallenge: EmailChallengeUseCase,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @RateLimit([
    {
      key: 'auth:login:pair',
      by: ['ip', 'body.email'],
      limit: 5,
      window: 900,
      resetOnSuccess: true,
    },
    { key: 'auth:login:ip', by: ['ip'], limit: 20, window: 900 },
    {
      key: 'auth:login:email',
      by: ['body.email'],
      limit: 50,
      window: 3600,
      resetOnSuccess: true,
    },
  ])
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = await loginSchema.validate(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    const result = await this.withRateLimitHeader(response, () =>
      this.loginUseCase.execute({
        ...input,
        ip: request.ip ?? null,
        userAgent: request.get('user-agent') ?? null,
        trustedDeviceToken: readTrustedDeviceCookie(request),
      }),
    );

    if ('status' in result) {
      response.setHeader('Cache-Control', 'no-store');
      return result;
    }
    return this.sendAuthResult(response, result);
  }

  @Public()
  @Post('challenge/email/verify')
  @HttpCode(200)
  async emailChallengeVerify(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const input = await emailChallengeVerifySchema.validate(body, {
      abortEarly: false,
      stripUnknown: false,
    });
    const result = await this.emailChallenge.verify({
      ...input,
      ip: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    });
    return this.sendChallengeResult(response, result);
  }

  @Public()
  @Post('challenge/email/resend')
  @HttpCode(200)
  @RateLimit([
    {
      key: 'auth:email-code:resend',
      by: ['user'],
      limit: 10,
      window: 3600,
    },
  ])
  async emailChallengeResend(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const input = await emailChallengeResendSchema.validate(body, {
      abortEarly: false,
      stripUnknown: false,
    });
    return this.withRateLimitHeader(response, () =>
      this.emailChallenge.resend({
        ...input,
        ip: request.ip ?? null,
        userAgent: request.get('user-agent') ?? null,
      }),
    );
  }

  @Public()
  @Post('challenge/2fa/verify')
  @HttpCode(200)
  @RateLimit([
    {
      key: 'auth:2fa:verify',
      by: ['user'],
      limit: 5,
      window: 900,
      resetOnSuccess: true,
    },
  ])
  async challengeVerify(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const input = await challengeVerifySchema.validate(body, {
      abortEarly: false,
      stripUnknown: false,
    });
    const result = await this.twoFactorChallenge.verify({
      ...input,
      ip: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    });
    return this.sendChallengeResult(response, result);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(202)
  @RateLimit([{ key: 'auth:forgot:ip', by: ['ip'], limit: 10, window: 3600 }])
  async forgotPassword(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const input = await forgotPasswordSchema.validate(body, {
      abortEarly: false,
      stripUnknown: false,
    });
    await this.withRateLimitHeader(response, () =>
      this.forgotPasswordUseCase.execute(input.email),
    );
    return FORGOT_RESPONSE;
  }

  @Public()
  @Post('password/reset')
  @HttpCode(200)
  @RateLimit([{ key: 'auth:reset:ip', by: ['ip'], limit: 10, window: 3600 }])
  async resetPassword(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const input = await resetPasswordSchema.validate(body, {
      abortEarly: false,
      stripUnknown: false,
    });
    await this.withRateLimitHeader(response, () =>
      this.resetPasswordUseCase.execute(input.token, input.password),
    );
    clearRefreshTokenCookie(response);
    clearTrustedDeviceCookie(response);
    return { message: 'Senha redefinida com sucesso.' };
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
    clearTrustedDeviceCookie(response);
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

  private sendChallengeResult(response: Response, result: ChallengeCompletion) {
    if (result.trustedDevice) {
      setTrustedDeviceCookie(
        response,
        result.trustedDevice.token,
        result.trustedDevice.expiresAt,
      );
    }
    return {
      ...this.sendAuthResult(response, result.auth),
      ...(result.recoveryCodesRemaining !== undefined && {
        recoveryCodesRemaining: result.recoveryCodesRemaining,
      }),
    };
  }

  private async withRateLimitHeader<T>(
    response: Response,
    execute: () => Promise<T>,
  ): Promise<T> {
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
