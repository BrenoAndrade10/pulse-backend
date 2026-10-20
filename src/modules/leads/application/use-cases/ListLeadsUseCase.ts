import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { LEADS_REPOSITORY } from '../../domain/repositories/LeadsRepository';
import type {
  LeadCursor,
  LeadsRepository,
} from '../../domain/repositories/LeadsRepository';
import { LEAD_CIPHER } from '../../domain/services/LeadCipher';
import type { LeadCipher } from '../../domain/services/LeadCipher';
import {
  normalizeEmail,
  normalizePhone,
} from '../../domain/services/leadValues';
import { searchHashes, toLeadView, type LeadView } from '../leadView';
import { requireExpertTenant } from '../requireExpertTenant';

export const MAX_LEADS_PAGE = 100;

export type ListLeadsInput = {
  expertId: string;
  launchId?: string;
  search?: string;
  after?: LeadCursor;
  limit?: number;
};

export type ListLeadsOutput = {
  leads: LeadView[];
  /** Total do filtro, só na primeira página (contar de novo a cada página é caro à toa). */
  total: number | null;
  next: LeadCursor | null;
};

@Injectable()
export class ListLeadsUseCase {
  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,

    @Inject(LEADS_REPOSITORY)
    private readonly leads: LeadsRepository,

    @Inject(LEAD_CIPHER)
    private readonly cipher: LeadCipher,
  ) {}

  async execute(
    input: ListLeadsInput,
    auth: AccessTokenClaims,
  ): Promise<ListLeadsOutput> {
    const tenantId = await requireExpertTenant(
      this.experts,
      input.expertId,
      auth,
    );
    this.cipher.assertConfigured();

    const hashes = searchHashes(input.search, this.cipher, {
      email: normalizeEmail,
      phone: normalizePhone,
    });
    if (!hashes) {
      throw DomainError.validationFailed({
        errors: ['Busque por um e-mail completo ou por um telefone com DDD.'],
      });
    }

    const limit = Math.min(Math.max(input.limit ?? 50, 1), MAX_LEADS_PAGE);
    const filter = {
      tenantId,
      expertId: input.expertId,
      launchId: input.launchId,
      ...hashes,
    };

    // Busca um a mais para saber se há próxima página sem contar tudo.
    const [rows, total] = await Promise.all([
      this.leads.list({ ...filter, after: input.after, limit: limit + 1 }),
      input.after ? Promise.resolve(null) : this.leads.count(filter),
    ]);
    const page = rows.slice(0, limit);

    return {
      leads: page.map((row) => toLeadView(row, this.cipher)),
      total,
      next: rows.length > limit ? page[page.length - 1].cursor : null,
    };
  }
}
