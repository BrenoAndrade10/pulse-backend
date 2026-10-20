import { Inject, Injectable, Logger } from '@nestjs/common';
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
import type { LeadExportGrant } from '../../infra/export/LeadExportLinks';
import { LeadExportLinks } from '../../infra/export/LeadExportLinks';
import { toLeadView, type LeadView } from '../leadView';
import { requireExpertTenant } from '../requireExpertTenant';

const BATCH_SIZE = 500;
const SEPARATOR = ';';
const BOM = String.fromCharCode(0xfeff);
const DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});

/**
 * Célula do CSV: entre aspas quando precisa e, se começar como fórmula
 * (=, +, -, @), vira texto. Senão um lead chamado "=HYPERLINK(...)" rodaria
 * na planilha de quem abrisse o arquivo.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvRow = (cells: (string | number | null | undefined)[]) =>
  `${cells.map(csvCell).join(SEPARATOR)}\r\n`;

@Injectable()
export class ExportLeadsUseCase {
  private readonly logger = new Logger(ExportLeadsUseCase.name);

  constructor(
    @Inject(EXPERTS_REPOSITORY)
    private readonly experts: ExpertsRepository,

    @Inject(LEADS_REPOSITORY)
    private readonly leads: LeadsRepository,

    @Inject(LEAD_CIPHER)
    private readonly cipher: LeadCipher,

    private readonly links: LeadExportLinks,
  ) {}

  /** Link assinado para o navegador baixar o CSV do filtro atual. */
  async createLink(
    input: { expertId: string; launchId?: string },
    auth: AccessTokenClaims,
  ): Promise<{ url: string }> {
    const tenantId = await requireExpertTenant(
      this.experts,
      input.expertId,
      auth,
    );
    this.cipher.assertConfigured();

    return {
      url: this.links.sign({
        tenantId,
        expertId: input.expertId,
        launchId: input.launchId ?? null,
        userId: auth.userId,
      }),
    };
  }

  /**
   * Linhas do CSV, em blocos de 500 leads: a memória fica constante seja qual
   * for o tamanho da base, e o download começa antes de ler tudo.
   */
  async *rows(grant: LeadExportGrant): AsyncGenerator<string> {
    this.logger.log(
      `Exportação de leads (empresa ${grant.tenantId}, expert ${grant.expertId}, lançamento ${grant.launchId ?? 'todos'}, usuário ${grant.userId}).`,
    );

    const [launchNames, customLabels] = await Promise.all([
      this.leads.launchNames(grant.tenantId, grant.expertId),
      this.leads.customFieldLabels(grant.tenantId, grant.expertId),
    ]);

    // BOM: o Excel em português abre com acentos e ; como separador.
    yield `${BOM}${csvRow([
      'Nome',
      'E-mail',
      'Telefone',
      ...customLabels,
      'Outros campos',
      'Lançamentos',
      'Cadastros',
      'Primeiro cadastro',
      'Último cadastro',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'Consentimento',
    ])}`;

    let after: LeadCursor | undefined;
    do {
      const page = await this.leads.list({
        tenantId: grant.tenantId,
        expertId: grant.expertId,
        launchId: grant.launchId ?? undefined,
        after,
        limit: BATCH_SIZE,
      });

      let chunk = '';
      for (const row of page) {
        chunk += this.toCsv(
          toLeadView(row, this.cipher),
          grant.launchId,
          launchNames,
          customLabels,
        );
      }
      if (chunk) yield chunk;

      after =
        page.length === BATCH_SIZE ? page[page.length - 1].cursor : undefined;
    } while (after);
  }

  private toCsv(
    lead: LeadView,
    launchId: string | null,
    launchNames: Map<string, string>,
    customLabels: string[],
  ): string {
    const launches = launchId
      ? lead.launches.filter((launch) => launch.launchId === launchId)
      : lead.launches;
    const first = launches[0];
    const others = Object.entries(lead.profile.custom).filter(
      ([label]) => !customLabels.includes(label),
    );

    return csvRow([
      lead.profile.name,
      lead.profile.email,
      lead.profile.phone,
      ...customLabels.map((label) => lead.profile.custom[label]),
      others.map(([label, value]) => `${label}: ${value}`).join(' | '),
      launches
        .map((launch) => launchNames.get(launch.launchId) ?? launch.launchId)
        .join(' | '),
      launches.reduce((total, launch) => total + launch.submissionsCount, 0) ||
        1,
      DATE.format(first?.firstSubmittedAt ?? lead.firstSeenAt),
      DATE.format(
        launches.length
          ? new Date(
              Math.max(
                ...launches.map((launch) => launch.lastSubmittedAt.getTime()),
              ),
            )
          : lead.lastSeenAt,
      ),
      first?.firstUtm.source,
      first?.firstUtm.medium,
      first?.firstUtm.campaign,
      first?.firstUtm.content,
      first?.firstUtm.term,
      lead.consent === null ? '' : lead.consent ? 'Sim' : 'Não',
    ]);
  }
}
