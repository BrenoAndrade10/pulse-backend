import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { once } from 'node:events';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Public } from '../../../../shared/presentation/decorators/Public';
import { ExportLeadsUseCase } from '../../application/use-cases/ExportLeadsUseCase';
import { LeadExportLinks } from '../../infra/export/LeadExportLinks';

/**
 * Download do CSV. Público porque o navegador baixa por link (sem o token de
 * login); só aceita o link assinado por LeadExportLinks, com validade curta.
 */
@Public()
@Controller('leads/exports')
export class LeadsExportController {
  constructor(
    private readonly links: LeadExportLinks,
    private readonly exportLeads: ExportLeadsUseCase,
  ) {}

  @Get('download')
  async download(
    @Query('p') payload: unknown,
    @Query('s') signature: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const grant = this.links.verify(payload, signature);
    if (!grant) throw new DomainError(403, 'LEADS_EXPORT_LINK_INVALID');

    const date = new Date().toISOString().slice(0, 10);
    response.status(200);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="leads-${date}.csv"`,
    );
    // Dado pessoal: não fica em cache de navegador nem de proxy.
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    try {
      for await (const chunk of this.exportLeads.rows(grant)) {
        // Respeita o ritmo de quem baixa: não acumula o arquivo na memória.
        if (!response.write(chunk)) await once(response, 'drain');
        if (response.destroyed) return;
      }
      response.end();
    } catch {
      response.destroy();
    }
  }
}
