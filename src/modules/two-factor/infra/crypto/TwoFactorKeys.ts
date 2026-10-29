import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { parseAes256Key } from '../../../../shared/infra/crypto/parseAes256Key';

@Injectable()
export class TwoFactorKeys {
  private cached: {
    source: string;
    encryption: Buffer;
    hashing: Buffer;
  } | null = null;

  encryption(): Buffer {
    return this.keys().encryption;
  }

  hashing(): Buffer {
    return this.keys().hashing;
  }

  private keys() {
    Environment.assertInitialized();
    const source = Environment.vars.TWO_FACTOR_ENCRYPTION_KEY;
    if (!source) {
      throw new DomainError(503, 'TWO_FACTOR_NOT_CONFIGURED');
    }
    if (this.cached?.source === source) return this.cached;

    const master = parseAes256Key(source);
    if (!master) {
      throw new DomainError(500, 'TWO_FACTOR_ENCRYPTION_KEY_INVALID');
    }

    this.cached = {
      source,
      encryption: createHmac('sha256', master)
        .update('two-factor-secret:v1')
        .digest(),
      hashing: createHmac('sha256', master)
        .update('two-factor-hash:v1')
        .digest(),
    };
    return this.cached;
  }
}
