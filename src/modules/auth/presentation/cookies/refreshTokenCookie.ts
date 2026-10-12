import type { CookieOptions, Request, Response } from 'express';
import { Environment } from '../../../../config/Environment';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Só /auth/refresh e /auth/logout recebem o cookie. */
const REFRESH_TOKEN_COOKIE_PATH = '/auth';

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: Environment.vars.AUTH_COOKIE_SECURE,
    sameSite: 'strict',
    path: REFRESH_TOKEN_COOKIE_PATH,
  };
}

export function readRefreshTokenCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_TOKEN_COOKIE];

  return typeof value === 'string' ? value : undefined;
}

/**
 * persistent=false gera um cookie de sessão do navegador (sem Max-Age), que
 * some quando o navegador é fechado. A sessão no Redis expira pelo próprio TTL.
 */
export function setRefreshTokenCookie(
  response: Response,
  refreshToken: string,
  options: { expiresAt: Date; persistent: boolean },
): void {
  response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    ...(options.persistent && {
      maxAge: Math.max(0, options.expiresAt.getTime() - Date.now()),
    }),
  });
}

export function clearRefreshTokenCookie(response: Response): void {
  response.clearCookie(REFRESH_TOKEN_COOKIE, baseCookieOptions());
}
