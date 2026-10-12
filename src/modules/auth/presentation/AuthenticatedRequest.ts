import type { Request } from 'express';
import type { AccessTokenClaims } from '../domain/types/AccessTokenClaims';

export type AuthenticatedRequest = Request & {
  auth?: AccessTokenClaims;
};
