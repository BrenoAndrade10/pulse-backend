/** Identidade da página: origem + caminho, sem query nem fragmento. */
export function pageOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}
