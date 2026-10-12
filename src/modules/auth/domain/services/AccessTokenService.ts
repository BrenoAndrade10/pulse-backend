import type { AccessTokenClaims } from '../types/AccessTokenClaims';

export const ACCESS_TOKEN_SERVICE = Symbol('ACCESS_TOKEN_SERVICE');

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): Promise<string>;
  /** Retorna null para token inválido, expirado ou adulterado. */
  verify(token: string): Promise<AccessTokenClaims | null>;
}
