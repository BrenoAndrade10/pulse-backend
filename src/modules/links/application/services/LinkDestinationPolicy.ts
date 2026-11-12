export function buildLinkBlockedHosts(
  linksPublicUrl?: string,
  apiPublicUrl?: string,
): string[] {
  const hosts = new Set<string>();

  for (const value of [linksPublicUrl, apiPublicUrl]) {
    if (!value?.trim()) {
      continue;
    }

    hosts.add(new URL(value).hostname);
  }

  return [...hosts];
}
