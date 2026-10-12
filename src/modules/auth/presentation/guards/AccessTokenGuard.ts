import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError } from '../../../../shared/errors/DomainError';
import { IS_PUBLIC_ROUTE } from '../../../../shared/presentation/decorators/Public';
import { SESSIONS_REPOSITORY } from '../../domain/repositories/SessionsRepository';
import type { SessionsRepository } from '../../domain/repositories/SessionsRepository';
import { ACCESS_TOKEN_SERVICE } from '../../domain/services/AccessTokenService';
import type { AccessTokenService } from '../../domain/services/AccessTokenService';
import type { AuthenticatedRequest } from '../AuthenticatedRequest';

/**
 * Guard global: toda rota exige `Authorization: Bearer <accessToken>`,
 * exceto as marcadas com @Public().
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,

    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokenService: AccessTokenService,

    @Inject(SESSIONS_REPOSITORY)
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new DomainError(401, 'UNAUTHENTICATED');
    }

    const claims = await this.accessTokenService.verify(token);

    if (!claims) {
      throw new DomainError(401, 'INVALID_ACCESS_TOKEN');
    }

    // Logout e revogação valem na hora, sem esperar o access token expirar.
    if (!(await this.sessionsRepository.exists(claims.sessionId))) {
      throw new DomainError(401, 'SESSION_REVOKED');
    }

    request.auth = claims;

    return true;
  }

  private extractBearerToken(request: AuthenticatedRequest): string | null {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    return scheme === 'Bearer' && token ? token : null;
  }
}
