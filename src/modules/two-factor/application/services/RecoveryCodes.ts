import { Injectable } from '@nestjs/common';
import { createHmac, randomInt } from 'node:crypto';
import { TwoFactorKeys } from '../../infra/crypto/TwoFactorKeys';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

@Injectable()
export class RecoveryCodes {
  constructor(private readonly keys: TwoFactorKeys) {}

  generate(): string[] {
    const codes = new Set<string>();
    while (codes.size < 10) codes.add(this.generateOne());
    return [...codes];
  }

  normalize(code: string): string {
    return code.toUpperCase().replace(/[\s-]/g, '');
  }

  hash(userId: string, code: string): string {
    return createHmac('sha256', this.keys.hashing())
      .update('recovery-code')
      .update('\0')
      .update(userId)
      .update('\0')
      .update(this.normalize(code))
      .digest('hex');
  }

  private generateOne(): string {
    let value = '';
    for (let index = 0; index < 10; index += 1) {
      value += ALPHABET[randomInt(ALPHABET.length)];
    }
    return `${value.slice(0, 5)}-${value.slice(5)}`;
  }
}
