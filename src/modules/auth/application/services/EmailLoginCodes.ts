import { Injectable } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Environment } from '../../../../config/Environment';

@Injectable()
export class EmailLoginCodes {
  generate(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  hash(userId: string, code: string): string {
    const subkey = createHmac('sha256', Environment.vars.JWT_SECRET)
      .update('email-login-code:v1')
      .digest();
    return createHmac('sha256', subkey)
      .update(userId)
      .update('\0')
      .update(code)
      .digest('hex');
  }

  matches(userId: string, code: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(userId, code), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  maskEmail(email: string): string {
    const [local = '', domain = ''] = email.split('@');
    const dot = domain.lastIndexOf('.');
    const domainName = dot > 0 ? domain.slice(0, dot) : domain;
    const suffix = dot > 0 ? domain.slice(dot) : '';
    return `${local.slice(0, 1)}****@${domainName.slice(0, 1)}****${suffix}`;
  }
}
