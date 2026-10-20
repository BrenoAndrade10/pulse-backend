import type { Utm } from '../../../leads/domain/types/LeadProfile';

export const MAX_EVENTS_PER_BATCH = 20;
export const MAX_BODY_BYTES = 64 * 1024;

export type CollectedEvent = {
  id: string;
  name: string;
  ruleId: string | null;
  url: string;
  referrer: string;
  anonymousId: string;
  sessionId: string;
  utm: Utm;
  fbclid: string;
  lead: { values: Record<string, string | boolean>; consent?: boolean } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID = /^[\w-]{1,64}$/;
const SLUG = /^[a-z][a-z0-9_]{0,39}$/;
const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : '';

function parseUtm(value: unknown): Utm {
  if (!value || typeof value !== 'object') return {};
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const item = text((value as Record<string, unknown>)[key], 200).trim();
    if (item) utm[key] = item;
  }
  return utm;
}

function parseLead(value: unknown): CollectedEvent['lead'] {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as { values?: unknown }).values;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const values: Record<string, string | boolean> = {};
  for (const [slug, item] of Object.entries(raw).slice(0, 20)) {
    if (!SLUG.test(slug)) continue;
    if (typeof item === 'boolean') values[slug] = item;
    else if (typeof item === 'string') values[slug] = item.slice(0, 500);
  }

  const consent = (value as { consent?: unknown }).consent;
  return {
    values,
    consent: typeof consent === 'boolean' ? consent : undefined,
  };
}

/**
 * Valida o lote enviado pelo pixel. Escrito à mão (sem biblioteca de esquema)
 * porque roda a cada visita de todas as páginas: o que não está no formato
 * esperado é descartado, nunca repassado.
 */
export function parseCollectPayload(body: unknown): CollectedEvent[] {
  let payload: unknown = body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_BYTES) return [];
    try {
      payload = JSON.parse(body);
    } catch {
      return [];
    }
  }

  const events = (payload as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) return [];

  return events
    .slice(0, MAX_EVENTS_PER_BATCH)
    .flatMap((item): CollectedEvent[] => {
      if (!item || typeof item !== 'object') return [];
      const event = item as Record<string, unknown>;

      const id = text(event.id, 36);
      const url = text(event.url, 2048);
      const ruleId =
        event.ruleId === undefined || event.ruleId === null
          ? null
          : text(event.ruleId, 36);
      if (!UUID.test(id) || !url || (ruleId !== null && !UUID.test(ruleId))) {
        return [];
      }

      const anonymousId = text(event.aid, 64);
      const sessionId = text(event.sid, 64);

      return [
        {
          id: id.toLowerCase(),
          name: text(event.name, 40),
          ruleId: ruleId?.toLowerCase() ?? null,
          url,
          referrer: text(event.referrer, 2048),
          anonymousId: SHORT_ID.test(anonymousId) ? anonymousId : '',
          sessionId: SHORT_ID.test(sessionId) ? sessionId : '',
          utm: parseUtm(event.utm),
          fbclid: text(event.fbclid, 500),
          lead: parseLead(event.lead),
        },
      ];
    });
}

const BOTS =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|pingdom|uptime|headless|lighthouse|python-requests|curl|wget/i;

export const isBot = (userAgent: string) => !userAgent || BOTS.test(userAgent);

export function deviceOf(userAgent: string): string {
  if (
    /ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(userAgent)
  ) {
    return 'tablet';
  }
  if (
    /mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)
  ) {
    return 'mobile';
  }
  return 'desktop';
}

export function browserOf(userAgent: string): string {
  if (/edg\//i.test(userAgent)) return 'edge';
  if (/opr\/|opera/i.test(userAgent)) return 'opera';
  if (/samsungbrowser/i.test(userAgent)) return 'samsung';
  if (/fbav|fban|instagram/i.test(userAgent)) return 'in-app';
  if (/firefox|fxios/i.test(userAgent)) return 'firefox';
  if (/chrome|crios/i.test(userAgent)) return 'chrome';
  if (/safari/i.test(userAgent)) return 'safari';
  return 'other';
}
