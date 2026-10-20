import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../domain/types/AccessTokenClaims';
import type { AuthenticatedRequest } from '../AuthenticatedRequest';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenClaims => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.auth) {
      throw new DomainError(401, 'UNAUTHENTICATED');
    }

    return request.auth;
  },
);
