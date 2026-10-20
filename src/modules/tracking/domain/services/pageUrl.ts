export const MAX_PAGE_URL_LENGTH = 2048;

export type NormalizedPageUrl = {
  url: string;
  /** Origem + caminho, sem query: `?utm_source=...` não vira outra página. */
  page: string;
  /** Hostname sem `www.`: é o que entra na lista de domínios do pixel. */
  domain: string;
};

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * Página pública com HTTPS: o pixel só roda em sites seguros, e endereços
 * locais ou IPs não são sites de clientes. Com `allowLocal` (só em
 * desenvolvimento), aceita também `http://localhost` para testes.
 */
export function normalizePageUrl(
  input: string,
  options: { allowLocal?: boolean } = {},
): NormalizedPageUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const local = Boolean(options.allowLocal) && LOCAL_HOSTS.has(hostname);
  const publicHttps =
    url.protocol === 'https:' &&
    hostname.includes('.') &&
    !hostname.endsWith('.local') &&
    !hostname.endsWith('.localhost') &&
    !hostname.startsWith('[') &&
    !IPV4.test(hostname);

  if (url.username || url.password) return null;
  if (!publicHttps && !(local && /^https?:$/.test(url.protocol))) return null;

  url.hash = '';

  return {
    url: url.toString(),
    page: `${url.origin}${url.pathname}`,
    domain: hostname.replace(/^www\./, ''),
  };
}
