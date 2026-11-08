import { DomainError } from '../../../shared/errors/DomainError';
import type { SessionsRepository } from '../../auth/domain/repositories/SessionsRepository';
import type {
  TrackingSetupSession,
  TrackingSetupSessionStore,
} from '../domain/repositories/TrackingSetupSessionStore';

/** A cada uso pelo editor, a sessão ganha mais uma hora. */
export const SETUP_SESSION_IDLE_SECONDS = 60 * 60;
/** Mesmo em uso, a sessão acaba depois disso: gera-se outro link. */
export const SETUP_SESSION_MAX_AGE_SECONDS = 4 * 60 * 60;

/**
 * Sessão do modo de configuração. O token autoriza enquanto o login de quem
 * gerou o link continuar ativo; a origem precisa ser a da página para a qual
 * o link foi gerado.
 */
export async function resolveSetupSession(
  store: TrackingSetupSessionStore,
  logins: Pick<SessionsRepository, 'exists'>,
  token: string | undefined,
  origin: string | undefined,
): Promise<TrackingSetupSession> {
  if (!token || !/^[\w-]{43}$/.test(token)) {
    throw new DomainError(401, 'TRACKING_SETUP_SESSION_INVALID');
  }

  const session = await store.touch(token, SETUP_SESSION_IDLE_SECONDS);
  const age = session ? Date.now() - Date.parse(session.createdAt) : NaN;
  if (!session || !(age <= SETUP_SESSION_MAX_AGE_SECONDS * 1000)) {
    throw new DomainError(401, 'TRACKING_SETUP_SESSION_INVALID');
  }

  if (!origin || new URL(session.url).origin !== origin) {
    throw new DomainError(403, 'TRACKING_SETUP_ORIGIN_MISMATCH');
  }

  if (!(await logins.exists(session.authSessionId))) {
    throw new DomainError(401, 'TRACKING_SETUP_SESSION_INVALID');
  }

  return session;
}
