import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { Environment } from '../../../../config/Environment';

@Injectable()
export class TrustedDeviceTokens {
  generate(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    const subkey = createHmac('sha256', Environment.vars.JWT_SECRET)
      .update('trusted-device:v1')
      .digest();
    return createHmac('sha256', subkey).update(token).digest('hex');
  }
}
