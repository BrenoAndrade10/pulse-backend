import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 bytes aleatórios em base64url, sem padding. */
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GeneratedRefreshToken = {
  token: string;
  hash: string;
};

export type ParsedRefreshToken = {
  sessionId: string;
  secret: string;
};

export class RefreshTokenCodec {
  static generate(sessionId: string): GeneratedRefreshToken {
    const secret = randomBytes(32).toString('base64url');

    return {
      token: `${sessionId}.${secret}`,
      hash: RefreshTokenCodec.hashSecret(secret),
    };
  }

  static parse(token: string | undefined | null): ParsedRefreshToken | null {
    if (!token || token.length > 128) {
      return null;
    }

    const [sessionId, secret, ...rest] = token.split('.');

    if (
      rest.length > 0 ||
      !sessionId ||
      !secret ||
      !SESSION_ID_PATTERN.test(sessionId) ||
      !SECRET_PATTERN.test(secret)
    ) {
      return null;
    }

    return { sessionId, secret };
  }

  static hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  static hashesMatch(hash: string, expectedHash: string | null): boolean {
    if (!expectedHash) {
      return false;
    }

    const hashBuffer = Buffer.from(hash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    return (
      hashBuffer.length === expectedBuffer.length &&
      timingSafeEqual(hashBuffer, expectedBuffer)
    );
  }
}
