import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { LEADS_REPOSITORY } from '../../domain/repositories/LeadsRepository';
import type { LeadsRepository } from '../../domain/repositories/LeadsRepository';
import { LEAD_CIPHER } from '../../domain/services/LeadCipher';
import type { LeadCipher } from '../../domain/services/LeadCipher';
import {
  mergeProfiles,
  normalizeEmail,
  normalizePhone,
  normalizeText,
} from '../../domain/services/leadValues';
import type { LeadProfile, Utm } from '../../domain/types/LeadProfile';

export type CaptureLeadInput = {
  tenantId: string;
  expertId: string;
  pixelId: string;
  ruleId: string | null;
  eventId: string;
  launchId: string | null;
  pageUrl: string;
  utm: Utm;
  submittedAt: Date;
  values: {
    name?: string;
    email?: string;
    phone?: string;
    custom: Record<string, string>;
  };
  consent?: boolean;
};

export type CaptureLeadResult =
  { status: 'captured' | 'duplicate'; leadId: string } | { status: 'skipped' };

/** Envio de formulário → lead. Usado pelo coletor do pixel. */
@Injectable()
export class CaptureLeadService {
  constructor(
    @Inject(LEADS_REPOSITORY)
    private readonly leads: LeadsRepository,

    @Inject(LEAD_CIPHER)
    private readonly cipher: LeadCipher,

    @Inject(ID_GENERATOR)
    private readonly ids: IdGenerator,
  ) {}

  async capture(input: CaptureLeadInput): Promise<CaptureLeadResult> {
    const email = input.values.email
      ? normalizeEmail(input.values.email)
      : null;
    const phone = input.values.phone
      ? normalizePhone(input.values.phone)
      : null;

    // Sem e-mail nem telefone válidos não há como reconhecer a pessoa.
    if (!email && !phone) return { status: 'skipped' };

    const custom = Object.fromEntries(
      Object.entries(input.values.custom)
        .map(([label, value]) => [normalizeText(label), normalizeText(value)])
        .filter((entry): entry is [string, string] =>
          Boolean(entry[0] && entry[1]),
        ),
    );
    const incoming: LeadProfile = {
      name: input.values.name
        ? (normalizeText(input.values.name) ?? undefined)
        : undefined,
      email: email ?? undefined,
      phone: phone ?? undefined,
      custom,
    };
    const owner = { tenantId: input.tenantId, expertId: input.expertId };

    const result = await this.leads.recordSubmission({
      tenantId: input.tenantId,
      expertId: input.expertId,
      emailHash: email ? this.cipher.hash('email', email) : null,
      phoneHash: phone ? this.cipher.hash('phone', phone) : null,
      consent: input.consent,
      launchId: input.launchId,
      pixelId: input.pixelId,
      ruleId: input.ruleId,
      eventId: input.eventId,
      pageUrl: input.pageUrl,
      utm: input.utm,
      submittedAt: input.submittedAt,
      newLeadId: this.ids.generate(),
      submissionId: this.ids.generate(),
      mergeProfile: (leadId, current) => {
        const ownerWithLead = { ...owner, leadId };
        const existing = current
          ? this.cipher.decrypt(current, ownerWithLead)
          : null;
        return this.cipher.encrypt(
          mergeProfiles(existing, incoming),
          ownerWithLead,
        );
      },
    });

    return {
      status: result.duplicate ? 'duplicate' : 'captured',
      leadId: result.leadId,
    };
  }
}
