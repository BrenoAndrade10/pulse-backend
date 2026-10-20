import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import {
  CaptureLeadService,
  type CaptureLeadInput,
} from '../../../leads/application/services/CaptureLeadService';
import type { TrackingRule } from '../../domain/entities/TrackingRule';
import { TRACKING_PAGES_REPOSITORY } from '../../domain/repositories/TrackingPagesRepository';
import type { TrackingPagesRepository } from '../../domain/repositories/TrackingPagesRepository';
import { TRACKING_PIXELS_REPOSITORY } from '../../domain/repositories/TrackingPixelsRepository';
import type { TrackingPixelsRepository } from '../../domain/repositories/TrackingPixelsRepository';
import { TRACKING_EVENTS_SINK } from '../../domain/services/TrackingEventsSink';
import type {
  TrackingEventRow,
  TrackingEventsSink,
} from '../../domain/services/TrackingEventsSink';
import {
  MemoryCache,
  WindowRateLimiter,
} from '../../infra/collector/MemoryCache';
import { pageOf } from '../pageOf';
import {
  browserOf,
  deviceOf,
  isBot,
  parseCollectPayload,
  type CollectedEvent,
} from './collectPayload';
import { PixelConfigProvider, type PixelConfig } from './PixelConfigProvider';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
/** Eventos por minuto por IP e pixel. Uma visita normal manda poucos. */
const EVENTS_PER_MINUTE = 120;

export type CollectInput = {
  publicKey: string;
  origin: string | undefined;
  userAgent: string;
  ip: string;
  body: unknown;
};

/**
 * Recebe o lote do pixel. Nunca falha para a página do cliente: o que não
 * passa nas verificações é descartado e os erros vão só para o log.
 */
@Injectable()
export class CollectEventsUseCase {
  private readonly logger = new Logger(CollectEventsUseCase.name);
  private readonly limiter = new WindowRateLimiter(EVENTS_PER_MINUTE, 60_000);
  private readonly launches = new MemoryCache<string | null>(60_000);
  private warnedLeadsKey = false;

  constructor(
    private readonly configs: PixelConfigProvider,
    private readonly captureLead: CaptureLeadService,

    @Inject(TRACKING_PIXELS_REPOSITORY)
    private readonly pixels: TrackingPixelsRepository,

    @Inject(TRACKING_PAGES_REPOSITORY)
    private readonly pages: TrackingPagesRepository,

    @Inject(TRACKING_EVENTS_SINK)
    private readonly sink: TrackingEventsSink,
  ) {}

  async execute(input: CollectInput): Promise<void> {
    if (isBot(input.userAgent)) return;

    const config = await this.configs.get(input.publicKey);
    const origin = config ? this.allowedOrigin(config, input.origin) : null;
    if (!config || !origin) return;

    const events = parseCollectPayload(input.body);
    if (events.length === 0) return;
    if (!this.limiter.take(`${input.ip}|${input.publicKey}`, events.length))
      return;

    const receivedAt = new Date();
    const context = {
      config,
      receivedAt,
      device: deviceOf(input.userAgent),
      browser: browserOf(input.userAgent),
      ipHash: this.hashIp(input.ip, receivedAt),
    };

    const rows: TrackingEventRow[] = [];
    for (const event of events) {
      try {
        const row = await this.process(event, origin, context);
        if (row) rows.push(row);
      } catch (error) {
        this.logger.error(`Evento ${event.id} descartado: ${String(error)}`);
      }
    }

    await this.sink.write(rows);
    if (rows.length > 0) {
      await this.pixels
        .touchLastEvent(config.pixel.id)
        .catch((error: unknown) => {
          this.logger.warn(
            `Não foi possível marcar o último evento: ${String(error)}`,
          );
        });
    }
  }

  private allowedOrigin(
    config: PixelConfig,
    origin: string | undefined,
  ): URL | null {
    if (!origin) return null;
    try {
      const url = new URL(origin);
      const hostname = url.hostname.toLowerCase();
      const local = LOCAL_HOSTS.has(hostname);
      if (local && !Environment.vars.TRACKING_ALLOW_LOCAL_PAGES) return null;
      if (!local && url.protocol !== 'https:') return null;
      return config.pixel.allowsDomain(hostname.replace(/^www\./, ''))
        ? url
        : null;
    } catch {
      return null;
    }
  }

  private async process(
    event: CollectedEvent,
    origin: URL,
    context: {
      config: PixelConfig;
      receivedAt: Date;
      device: string;
      browser: string;
      ipHash: string;
    },
  ): Promise<TrackingEventRow | null> {
    let page: URL;
    try {
      page = new URL(event.url);
    } catch {
      return null;
    }
    if (page.origin !== origin.origin) return null;

    const { pixel } = context.config;
    const rule = event.ruleId
      ? context.config.rulesById.get(event.ruleId)
      : null;
    if (event.ruleId && !rule) return null;

    const eventName = rule
      ? rule.eventName
      : event.name === 'PageView'
        ? 'PageView'
        : null;
    if (!eventName) return null;

    const pageUrl = pageOf(event.url);
    const launchId = await this.launches.get(`${pixel.id}|${pageUrl}`, () =>
      this.pages.resolveLaunch({
        tenantId: pixel.tenantId,
        expertId: pixel.expertId,
        pixelId: pixel.id,
        pageUrl,
        at: context.receivedAt,
      }),
    );

    const leadId =
      rule && rule.trigger === 'submit' && rule.fields.length > 0 && event.lead
        ? await this.capture(event, rule, {
            pageUrl,
            launchId,
            receivedAt: context.receivedAt,
          })
        : null;

    return {
      event_id: event.id,
      tenant_id: pixel.tenantId,
      expert_id: pixel.expertId,
      pixel_id: pixel.id,
      rule_id: rule?.id ?? null,
      lead_id: leadId,
      launch_id: launchId,
      event_name: eventName,
      page_url: pageUrl,
      page_path: page.pathname,
      referrer: event.referrer,
      utm_source: event.utm.source ?? '',
      utm_medium: event.utm.medium ?? '',
      utm_campaign: event.utm.campaign ?? '',
      utm_content: event.utm.content ?? '',
      utm_term: event.utm.term ?? '',
      fbclid: event.fbclid,
      anonymous_id: event.anonymousId,
      session_id: event.sessionId,
      device: context.device,
      browser: context.browser,
      ip_hash: context.ipHash,
      occurred_at: context.receivedAt.toISOString(),
      received_at: context.receivedAt.toISOString(),
    };
  }

  private async capture(
    event: CollectedEvent,
    rule: TrackingRule,
    page: { pageUrl: string; launchId: string | null; receivedAt: Date },
  ): Promise<string | null> {
    const lead = event.lead!;
    const values: CaptureLeadInput['values'] = { custom: {} };
    let consent = lead.consent;

    for (const field of rule.fields) {
      const value = lead.values[field.slug];
      if (value === undefined) continue;

      if (field.key === 'consent') {
        consent = value === true || value === 'true' || value === 'on';
      } else if (typeof value === 'string') {
        if (field.key === 'custom') values.custom[field.label] = value;
        else values[field.key] = value;
      }
    }

    try {
      const result = await this.captureLead.capture({
        tenantId: rule.tenantId,
        expertId: rule.expertId,
        pixelId: rule.pixelId,
        ruleId: rule.id,
        eventId: event.id,
        launchId: page.launchId,
        pageUrl: page.pageUrl,
        utm: event.utm,
        submittedAt: page.receivedAt,
        values,
        consent,
      });
      return result.status === 'skipped' ? null : result.leadId;
    } catch (error) {
      if (
        error instanceof DomainError &&
        error.reason === 'LEADS_ENCRYPTION_KEY_NOT_CONFIGURED'
      ) {
        if (!this.warnedLeadsKey) {
          this.logger.error(
            'LEADS_ENCRYPTION_KEY não configurada: leads dos formulários não estão sendo salvos.',
          );
          this.warnedLeadsKey = true;
        }
        return null;
      }
      throw error;
    }
  }

  /**
   * Hash do IP com sal do dia: conta visitantes únicos no dia sem permitir
   * seguir alguém entre dias nem recuperar o IP.
   */
  private hashIp(ip: string, at: Date): string {
    return createHmac('sha256', Environment.vars.JWT_SECRET)
      .update(`tracking-ip:v1:${at.toISOString().slice(0, 10)}:${ip}`)
      .digest('hex')
      .slice(0, 32);
  }
}
