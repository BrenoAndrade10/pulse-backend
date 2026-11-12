import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import {
  browserOf,
  deviceOf,
} from '../../../tracking/application/collector/collectPayload';
import { LINK_CLICKS_SINK } from '../../domain/services/LinkClicksSink';
import type {
  LinkClickRow,
  LinkClicksSink,
} from '../../domain/services/LinkClicksSink';

const MAX_BUFFER = 10_000;
const BATCH_SIZE = 200;
const FLUSH_MS = 1000;

export type LinkClickInput = {
  clickId: string;
  linkId: string;
  tenantId: string;
  expertId: string | null;
  launchId: string | null;
  code: string;
  destinationVersion: number;
  destinationUtm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };
  ip: string;
  userAgent: string;
  referrer: string;
  isBot: boolean;
  now: Date;
};

@Injectable()
export class LinkClickRecorder implements OnApplicationShutdown {
  private readonly logger = new Logger(LinkClickRecorder.name);
  private readonly buffer: LinkClickRow[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(LINK_CLICKS_SINK) private readonly sink: LinkClicksSink,
  ) {}

  record(input: LinkClickInput): void {
    const row: LinkClickRow = {
      click_id: input.clickId,
      link_id: input.linkId,
      tenant_id: input.tenantId,
      expert_id: input.expertId ?? '',
      launch_id: input.launchId ?? '',
      code: input.code,
      destination_version: input.destinationVersion,
      occurred_at: input.now.toISOString(),
      received_at: new Date().toISOString(),
      ip_hash: this.hash(
        `tracking-ip:v1:${input.now.toISOString().slice(0, 10)}:${input.ip}`,
      ),
      ua_hash: this.hash(`link-ua:v1:${input.userAgent}`),
      device: deviceOf(input.userAgent),
      browser: browserOf(input.userAgent),
      referrer: input.referrer.slice(0, 500),
      is_bot: input.isBot,
      utm_source: input.destinationUtm.source ?? '',
      utm_medium: input.destinationUtm.medium ?? '',
      utm_campaign: input.destinationUtm.campaign ?? '',
      utm_content: input.destinationUtm.content ?? '',
      utm_term: input.destinationUtm.term ?? '',
    };
    if (this.buffer.length >= MAX_BUFFER) {
      this.buffer.shift();
      this.logger.warn('LINK_CLICK_BUFFER_FULL');
    }
    this.buffer.push(row);
    if (this.buffer.length >= BATCH_SIZE) void this.flush();
    else this.schedule();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.flush();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_MS);
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const rows = this.buffer.splice(0, BATCH_SIZE);
    try {
      await this.sink.write(rows);
    } catch (error) {
      this.logger.error(`Link clicks flush failed: ${String(error)}`);
      try {
        await this.sink.write(rows);
      } catch (retryError) {
        this.logger.error(`Link clicks retry failed: ${String(retryError)}`);
      }
    }
    if (this.buffer.length > 0) this.schedule();
  }

  private hash(value: string): string {
    return createHmac('sha256', Environment.vars.JWT_SECRET)
      .update(value)
      .digest('hex')
      .slice(0, 32);
  }
}
