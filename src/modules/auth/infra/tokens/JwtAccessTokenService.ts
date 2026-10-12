import type { JwtService } from '@nestjs/jwt';
import type { UserRole } from '../../../users/domain/enums/UserRole';
import type { AccessTokenService } from '../../domain/services/AccessTokenService';
import type { AccessTokenClaims } from '../../domain/types/AccessTokenClaims';

type AccessTokenPayload = {
  sub: string;
  sid: string;
  tid: string | null;
  role: UserRole | null;
};

/**
 * O JwtService recebido já vem configurado com segredo, algoritmo fixo
 * (HS256), issuer, audience e expiração — ver AuthModule.
 */
export class JwtAccessTokenService implements AccessTokenService {
  constructor(private readonly jwtService: JwtService) {}

  sign(claims: AccessTokenClaims): Promise<string> {
    const payload: Omit<AccessTokenPayload, 'sub'> = {
      sid: claims.sessionId,
      tid: claims.tenantId,
      role: claims.role,
    };

    return this.jwtService.signAsync(payload, { subject: claims.userId });
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        return null;
      }

      return {
        userId: payload.sub,
        sessionId: payload.sid,
        tenantId: payload.tid ?? null,
        role: payload.role ?? null,
      };
    } catch {
      return null;
    }
  }
}
