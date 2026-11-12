import type { LinkStatus } from '../enums/LinkStatus';

export type LinkRedirectEntry =
  | {
      v: 1;
      id: string;
      tenantId: string;
      expertId: string | null;
      launchId: string | null;
      destinationUrl: string;
      destinationVersion: number;
      status: LinkStatus;
      utm: {
        source: string | null;
        medium: string | null;
        campaign: string | null;
        content: string | null;
        term: string | null;
      };
    }
  | { v: 1; missing: true };

export const LINK_REDIRECT_CACHE = Symbol('LINK_REDIRECT_CACHE');

export interface LinkRedirectCache {
  get(code: string): Promise<LinkRedirectEntry | null>;
  set(code: string, entry: LinkRedirectEntry): Promise<void>;
  invalidate(code: string): Promise<void>;
}
