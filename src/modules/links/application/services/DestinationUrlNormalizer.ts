import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';

export type LinkDestinationPolicy = {
  allowLocal: boolean;
  blockedHosts: string[];
};

export const LINK_DESTINATION_POLICY = Symbol('LINK_DESTINATION_POLICY');

@Injectable()
export class DestinationUrlNormalizer {
  constructor(
    @Inject(LINK_DESTINATION_POLICY)
    private readonly policy: LinkDestinationPolicy,
  ) {}

  normalize(input: string): string {
    const value = input.trim();
    if (!value) throw DomainError.linkDestinationInvalid();

    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
    const isHostPort = /^[^/?#]+:\d+(?:[/?#]|$)/.test(value);
    const href = hasScheme && !isHostPort ? value : `https://${value}`;

    if (!/^https?:/i.test(href)) {
      throw DomainError.linkDestinationInvalid();
    }

    let url: URL;
    try {
      url = new URL(href);
    } catch {
      throw DomainError.linkDestinationInvalid();
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw DomainError.linkDestinationInvalid();
    }

    if (url.username || url.password) {
      throw DomainError.linkDestinationInvalid();
    }

    const host = this.hostname(url.hostname);
    const isLocalHttpHost = host === 'localhost' || host === '127.0.0.1';

    if (
      url.protocol === 'http:' &&
      (!this.policy.allowLocal || !isLocalHttpHost)
    ) {
      throw DomainError.linkDestinationInsecure();
    }

    if (
      this.isBlockedHost(host) &&
      !(this.policy.allowLocal && isLocalHttpHost)
    ) {
      throw DomainError.linkDestinationBlocked();
    }

    const normalized = url.toString();
    if (normalized.length > 2048) {
      throw DomainError.linkDestinationTooLong();
    }

    return normalized;
  }

  private hostname(hostname: string): string {
    return hostname.replace(/^\[|\]$/g, '').toLowerCase();
  }

  private isBlockedHost(host: string): boolean {
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      (!host.includes('.') && !host.includes(':'))
    ) {
      return true;
    }

    if (
      this.policy.blockedHosts.some((blockedHost) =>
        this.matchesHost(host, blockedHost),
      )
    ) {
      return true;
    }

    if (this.isBlockedIpv4(host)) return true;
    if (host === '::1' || this.isBlockedIpv6(host)) return true;

    return false;
  }

  private matchesHost(host: string, blockedHost: string): boolean {
    const normalized = this.hostname(blockedHost.trim());
    return host === normalized || host.endsWith(`.${normalized}`);
  }

  private isBlockedIpv4(host: string): boolean {
    const parts = host.split('.');
    if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
      return false;
    }

    const octets = parts.map(Number);
    if (octets.some((octet) => octet > 255)) return false;

    const [first, second] = octets;
    return (
      first === 0 ||
      first === 10 ||
      (first === 127 && second !== undefined) ||
      (first === 169 && second === 254) ||
      (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  private isBlockedIpv6(host: string): boolean {
    const firstHextet = Number.parseInt(host.split(':')[0] ?? '', 16);
    if (Number.isNaN(firstHextet)) return false;
    return (
      (firstHextet & 0xfe00) === 0xfc00 || (firstHextet & 0xffc0) === 0xfe80
    );
  }
}
