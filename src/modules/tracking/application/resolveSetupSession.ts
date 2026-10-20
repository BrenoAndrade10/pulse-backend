import { DomainError } from '../../../shared/errors/DomainError';
import type {
  TrackingSetupSession,
  TrackingSetupSessionStore,
} from '../domain/repositories/TrackingSetupSessionStore';

/** A cada uso pelo editor, a sessão ganha mais uma hora. */
export const SETUP_SESSION_IDLE_SECONDS = 60 * 60;

/**
 * Sessão do modo de configuração. O token autoriza; a origem precisa ser a
 * da página para a qual o link foi gerado, então copiar o token para usar a
 * partir de outro site não funciona.
 */
export async function resolveSetupSession(
  store: TrackingSetupSessionStore,
  token: string | undefined,
  origin: string | undefined,
): Promise<TrackingSetupSession> {
  if (!token || !/^[\w-]{43}$/.test(token)) {
    throw new DomainError(401, 'TRACKING_SETUP_SESSION_INVALID');
  }

  const session = await store.touch(token, SETUP_SESSION_IDLE_SECONDS);
  if (!session) throw new DomainError(401, 'TRACKING_SETUP_SESSION_INVALID');

  if (!origin || new URL(session.url).origin !== origin) {
    throw new DomainError(403, 'TRACKING_SETUP_ORIGIN_MISMATCH');
  }

  return session;
}
