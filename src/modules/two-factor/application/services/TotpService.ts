import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';

export type TotpVerification =
  { valid: true; step: number } | { valid: false; step: null };

@Injectable()
export class TotpService {
  generateSecret(): string {
    return generateSecret({ length: 20 });
  }

  keyUri(email: string, secret: string): string {
    const uri = generateURI({
      issuer: 'Pulse Lead',
      label: email,
      secret,
    });
    return `${uri}&algorithm=SHA1&digits=6&period=30`;
  }

  async verify(
    secret: string,
    code: string,
    lastUsedStep: number | null,
  ): Promise<TotpVerification> {
    if (!/^\d{6}$/.test(code)) return { valid: false, step: null };

    const result = await verify({
      secret,
      token: code,
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      epoch: Math.floor(Date.now() / 1000),
      epochTolerance: 30,
      ...(lastUsedStep === null ? {} : { afterTimeStep: lastUsedStep }),
    });
    if (!result.valid || !('timeStep' in result)) {
      return { valid: false, step: null };
    }
    return { valid: true, step: result.timeStep };
  }
}
