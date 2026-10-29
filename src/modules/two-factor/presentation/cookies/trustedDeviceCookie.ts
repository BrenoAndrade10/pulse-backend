import type { CookieOptions, Request, Response } from 'express';
import { Environment } from '../../../../config/Environment';

export const TRUSTED_DEVICE_COOKIE = 'pulse_trusted_device';

function options(): CookieOptions {
  return {
    httpOnly: true,
    secure: Environment.vars.AUTH_COOKIE_SECURE,
    sameSite: 'strict',
    path: '/auth',
  };
}

export function readTrustedDeviceCookie(request: Request): string | null {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[TRUSTED_DEVICE_COOKIE];
  return typeof value === 'string' ? value : null;
}

export function setTrustedDeviceCookie(
  response: Response,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(TRUSTED_DEVICE_COOKIE, token, {
    ...options(),
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

export function clearTrustedDeviceCookie(response: Response): void {
  response.clearCookie(TRUSTED_DEVICE_COOKIE, options());
}
