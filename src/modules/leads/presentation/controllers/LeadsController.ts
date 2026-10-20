import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/DomainError';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import type { LeadView } from '../../application/leadView';
import { DeleteLeadUseCase } from '../../application/use-cases/DeleteLeadUseCase';
import { ExportLeadsUseCase } from '../../application/use-cases/ExportLeadsUseCase';
import { ListLeadsUseCase } from '../../application/use-cases/ListLeadsUseCase';
import type { LeadCursor } from '../../domain/repositories/LeadsRepository';

const encodeCursor = (cursor: LeadCursor) =>
  Buffer.from(`${cursor.lastSeenAt}|${cursor.id}`, 'utf8').toString(
    'base64url',
  );

function decodeCursor(value: unknown): LeadCursor | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'string') {
    const [lastSeenAt, id] = Buffer.from(value, 'base64url')
      .toString('utf8')
      .split('|');
    if (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(lastSeenAt ?? '') &&
      isUuidV7(id ?? '')
    ) {
      return { lastSeenAt, id };
    }
  }
  throw DomainError.validationFailed({ errors: ['Página inválida.'] });
}

@Controller('experts/:expertId/leads')
export class LeadsController {
  constructor(
    private readonly listLeads: ListLeadsUseCase,
    private readonly deleteLead: DeleteLeadUseCase,
    private readonly exportLeads: ExportLeadsUseCase,
  ) {}

  @Get()
  async list(
    @Param('expertId') expertId: string,
    @Query('launchId') launchId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateId(expertId);
    if (launchId) this.validateId(launchId);

    const result = await this.listLeads.execute(
      {
        expertId,
        launchId,
        search: typeof search === 'string' ? search.slice(0, 254) : undefined,
        after: decodeCursor(cursor),
        limit: limit ? Number(limit) || undefined : undefined,
      },
      auth,
    );

    return {
      data: result.leads.map((lead) => this.toResponse(lead)),
      total: result.total,
      nextCursor: result.next ? encodeCursor(result.next) : null,
    };
  }

  @Post('exports')
  async export(
    @Param('expertId') expertId: string,
    @Body() body: unknown,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateId(expertId);
    const launchId = (body as { launchId?: unknown } | null)?.launchId;
    if (launchId !== undefined && launchId !== null) {
      if (typeof launchId !== 'string') this.validateId('');
      this.validateId(launchId as string);
    }
    return this.exportLeads.createLink(
      { expertId, launchId: (launchId as string | null) ?? undefined },
      auth,
    );
  }

  @Delete(':leadId')
  @HttpCode(204)
  async delete(
    @Param('expertId') expertId: string,
    @Param('leadId') leadId: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<void> {
    this.validateId(expertId);
    this.validateId(leadId);
    await this.deleteLead.execute({ expertId, leadId }, auth);
  }

  private toResponse(lead: LeadView) {
    return {
      id: lead.id,
      name: lead.profile.name ?? null,
      email: lead.profile.email ?? null,
      phone: lead.profile.phone ?? null,
      custom: lead.profile.custom,
      consent: lead.consent,
      firstSeenAt: lead.firstSeenAt,
      lastSeenAt: lead.lastSeenAt,
      launches: lead.launches,
    };
  }

  private validateId(id: string): void {
    if (!isUuidV7(id)) {
      throw DomainError.validationFailed({ errors: ['Informe um id válido.'] });
    }
  }
}
