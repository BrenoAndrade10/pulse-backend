import { Injectable } from '@nestjs/common';
import { LinkChannel } from '../../domain/enums/LinkChannel';

export type LinkUtm = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
};

export type LinkUtmInput = {
  channel: LinkChannel;
  placement?: string | null;
  campaign?: string | null;
  linkName?: string | null;
  launchName?: string | null;
  overrides?: Partial<LinkUtm> | null;
};

export const LINK_PLACEMENTS: Record<LinkChannel, readonly string[]> = {
  [LinkChannel.INSTAGRAM]: ['bio', 'stories', 'direct', 'reels', 'feed'],
  [LinkChannel.WHATSAPP]: ['group', 'private', 'status', 'broadcast'],
  [LinkChannel.TELEGRAM]: ['channel', 'group', 'private'],
  [LinkChannel.EMAIL]: ['newsletter', 'automation', 'signature'],
  [LinkChannel.ADS]: ['feed', 'stories', 'reels', 'search', 'display'],
  [LinkChannel.OTHER]: [],
};

const DEFAULTS: Record<LinkChannel, Pick<LinkUtm, 'source' | 'medium'>> = {
  [LinkChannel.INSTAGRAM]: { source: 'instagram', medium: 'social' },
  [LinkChannel.WHATSAPP]: { source: 'whatsapp', medium: 'message' },
  [LinkChannel.EMAIL]: { source: 'email', medium: 'email' },
  [LinkChannel.TELEGRAM]: { source: 'telegram', medium: 'message' },
  [LinkChannel.ADS]: { source: 'ads', medium: 'paid' },
  [LinkChannel.OTHER]: { source: 'other', medium: 'link' },
};

@Injectable()
export class LinkUtmBuilder {
  normalize(value: string | null | undefined): string | null {
    return this.slug(value);
  }

  build(input: LinkUtmInput): LinkUtm {
    const defaults = DEFAULTS[input.channel];
    const overrides = input.overrides ?? {};
    const placement = this.slug(input.placement);
    const medium = LINK_PLACEMENTS[input.channel].includes(placement ?? '')
      ? placement
      : (placement ?? defaults.medium);

    return {
      source: this.override(overrides.source, defaults.source),
      medium: this.override(overrides.medium, medium),
      campaign: this.override(
        overrides.campaign,
        this.slug(input.campaign) ?? this.slug(input.launchName),
      ),
      content: this.override(overrides.content, this.slug(input.linkName)),
      term: this.slug(overrides.term),
    };
  }

  private override(
    value: string | null | undefined,
    fallback: string | null,
  ): string | null {
    const normalized = this.slug(value);
    return normalized ?? fallback;
  }

  private slug(value: string | null | undefined): string | null {
    if (!value) return null;

    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
      .replace(/-+$/g, '');

    return normalized || null;
  }
}
