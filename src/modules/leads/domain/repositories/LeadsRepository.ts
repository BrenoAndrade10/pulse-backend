import type { EncryptedProfile, Utm } from '../types/LeadProfile';

export const LEADS_REPOSITORY = Symbol('LEADS_REPOSITORY');

export type LeadLaunchRow = {
  launchId: string;
  firstSubmittedAt: Date;
  lastSubmittedAt: Date;
  submissionsCount: number;
  firstUtm: Utm;
};

export type LeadRow = {
  id: string;
  tenantId: string;
  expertId: string;
  profile: EncryptedProfile;
  consent: boolean | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  launches: LeadLaunchRow[];
  /** Posição do lead na listagem, exata como está no banco (ver LeadCursor). */
  cursor: LeadCursor;
};

/**
 * `lastSeenAt` como texto com microssegundos, vindo do próprio banco: comparar
 * com um Date do JavaScript erraria a página seguinte se o fuso do servidor
 * não fosse UTC.
 */
export type LeadCursor = { lastSeenAt: string; id: string };

export type ListLeadsQuery = {
  tenantId: string;
  expertId: string;
  launchId?: string;
  emailHash?: string;
  phoneHash?: string;
  after?: LeadCursor;
  limit: number;
};

export type RecordSubmissionInput = {
  tenantId: string;
  expertId: string;
  emailHash: string | null;
  phoneHash: string | null;
  consent?: boolean;
  launchId: string | null;
  pixelId: string;
  ruleId: string | null;
  eventId: string;
  pageUrl: string;
  utm: Utm;
  submittedAt: Date;
  /** Ids gerados antes, usados se o lead ou o envio forem novos. */
  newLeadId: string;
  submissionId: string;
  /**
   * Junta os dados já guardados com os novos e devolve cifrado. Roda dentro
   * da transação, com o lead travado.
   */
  mergeProfile: (
    leadId: string,
    current: EncryptedProfile | null,
  ) => EncryptedProfile;
};

export interface LeadsRepository {
  /**
   * Grava um envio de formulário numa transação: cria ou atualiza o lead
   * (mesma pessoa pelo e-mail ou telefone), registra o envio e a inscrição no
   * lançamento. O mesmo evento reenviado é ignorado (`duplicate`).
   */
  recordSubmission(
    input: RecordSubmissionInput,
  ): Promise<{ leadId: string; duplicate: boolean }>;
  list(query: ListLeadsQuery): Promise<LeadRow[]>;
  count(query: Omit<ListLeadsQuery, 'after' | 'limit'>): Promise<number>;
  delete(tenantId: string, expertId: string, leadId: string): Promise<boolean>;
  /** Nome dos lançamentos do expert, para a listagem e o CSV. */
  launchNames(tenantId: string, expertId: string): Promise<Map<string, string>>;
  /** Rótulos dos campos personalizados mapeados nas regras do expert (colunas do CSV). */
  customFieldLabels(tenantId: string, expertId: string): Promise<string[]>;
}
