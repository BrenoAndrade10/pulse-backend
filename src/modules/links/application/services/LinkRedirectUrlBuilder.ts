import { Injectable } from '@nestjs/common';

export type LinkRedirectUrlInput = {
  destinationUrl: string;
  linkUtm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };
  incomingQuery: Record<string, string | string[] | undefined>;
  clickId: string;
};

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

@Injectable()
export class LinkRedirectUrlBuilder {
  build(input: LinkRedirectUrlInput): string {
    const destination = new URL(input.destinationUrl);
    if (!['http:', 'https:'].includes(destination.protocol))
      throw new Error('Destino inválido.');
    const original = destination.toString();
    const query = new URLSearchParams(destination.search);
    const incoming = input.incomingQuery;
    const configured = {
      utm_source: input.linkUtm.source,
      utm_medium: input.linkUtm.medium,
      utm_campaign: input.linkUtm.campaign,
      utm_content: input.linkUtm.content,
      utm_term: input.linkUtm.term,
    };

    for (const key of Object.keys(incoming)) {
      if (key === 'pl' || UTM_KEYS.includes(key as (typeof UTM_KEYS)[number]))
        continue;
      for (const value of this.values(incoming[key])) query.append(key, value);
    }
    for (const key of UTM_KEYS) {
      if (query.has(key)) continue;
      const values = this.values(incoming[key]);
      const value = values[0] ?? configured[key];
      if (value) query.set(key, value);
    }
    query.set('pl', input.clickId);
    destination.search = query.toString();
    const result = destination.toString();
    if (result.length <= 8000) return result;
    const fallback = new URL(original);
    fallback.searchParams.set('pl', input.clickId);
    return fallback.toString();
  }

  private values(value: string | string[] | undefined): string[] {
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  }
}
