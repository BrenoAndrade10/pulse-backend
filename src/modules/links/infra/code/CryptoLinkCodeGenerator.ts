import { randomInt as defaultRandomInt } from 'node:crypto';

import { Injectable, Optional } from '@nestjs/common';
import { LinkCodeGenerator } from '../../domain/services/LinkCodeGenerator';

type RandomInt = (max: number) => number;

@Injectable()
export class CryptoLinkCodeGenerator implements LinkCodeGenerator {
  private static readonly ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

  private static readonly DEFAULT_LENGTH = 8;

  private static readonly BLOCKED_SUBSTRINGS = [
    'api',
    'admin',
    'login',
    'logout',
    'assets',
    'static',
    'health',
    'www',
    'app',
    'links',
    'redirect',
    'null',
    'undefined',
    'test',
  ];

  constructor(
    @Optional() private readonly randomInt: RandomInt = defaultRandomInt,
  ) {}

  generate(length = CryptoLinkCodeGenerator.DEFAULT_LENGTH): string {
    if (!Number.isInteger(length) || length < 7 || length > 16) {
      throw new RangeError('Invalid link code length');
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = Array.from(
        { length },
        () =>
          CryptoLinkCodeGenerator.ALPHABET[
            this.randomInt(CryptoLinkCodeGenerator.ALPHABET.length)
          ],
      ).join('');

      if (
        !CryptoLinkCodeGenerator.BLOCKED_SUBSTRINGS.some((term) =>
          code.includes(term),
        )
      ) {
        return code;
      }
    }

    throw new Error('Unable to generate a valid link code');
  }
}
