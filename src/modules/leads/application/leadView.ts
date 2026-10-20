import type { LeadCipher } from '../domain/services/LeadCipher';
import type { LeadRow } from '../domain/repositories/LeadsRepository';
import type { LeadProfile, Utm } from '../domain/types/LeadProfile';

export type LeadView = {
  id: string;
  profile: LeadProfile;
  consent: boolean | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  launches: {
    launchId: string;
    firstSubmittedAt: Date;
    lastSubmittedAt: Date;
    submissionsCount: number;
    firstUtm: Utm;
  }[];
};

export function toLeadView(row: LeadRow, cipher: LeadCipher): LeadView {
  return {
    id: row.id,
    profile: cipher.decrypt(row.profile, {
      tenantId: row.tenantId,
      expertId: row.expertId,
      leadId: row.id,
    }),
    consent: row.consent,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    launches: row.launches,
  };
}

/** Busca exata: e-mail, ou telefone (8+ dígitos). Os dados cifrados não permitem busca parcial. */
export function searchHashes(
  search: string | undefined,
  cipher: LeadCipher,
  normalize: {
    email: (v: string) => string | null;
    phone: (v: string) => string | null;
  },
): { emailHash?: string; phoneHash?: string } | null {
  const value = search?.trim();
  if (!value) return {};

  if (value.includes('@')) {
    const email = normalize.email(value);
    return email ? { emailHash: cipher.hash('email', email) } : null;
  }

  const phone = normalize.phone(value);
  return phone ? { phoneHash: cipher.hash('phone', phone) } : null;
}
