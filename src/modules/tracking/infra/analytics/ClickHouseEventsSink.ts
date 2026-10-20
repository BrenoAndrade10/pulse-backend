import { Injectable, Logger } from '@nestjs/common';
import { Environment } from '../../../../config/Environment';
import type {
  TrackingEventRow,
  TrackingEventsSink,
} from '../../domain/services/TrackingEventsSink';

const TIMEOUT_MS = 10_000;

/**
 * Grava os eventos pela interface HTTP do ClickHouse, com `async_insert`: o
 * ClickHouse junta as inserções pequenas no servidor e grava em blocos
 * grandes; `wait_for_async_insert` só responde depois de gravar.
 *
 * Sem CLICKHOUSE_URL configurado, os eventos não são guardados (avisa uma vez).
 */
@Injectable()
export class ClickHouseEventsSink implements TrackingEventsSink {
  private readonly logger = new Logger(ClickHouseEventsSink.name);
  private warnedMissingConfig = false;

  async write(rows: TrackingEventRow[]): Promise<void> {
    if (rows.length === 0) return;

    Environment.assertInitialized();
    const {
      CLICKHOUSE_URL,
      CLICKHOUSE_USERNAME,
      CLICKHOUSE_PASSWORD,
      CLICKHOUSE_DATABASE,
    } = Environment.vars;

    if (!CLICKHOUSE_URL) {
      if (!this.warnedMissingConfig) {
        this.logger.warn(
          'CLICKHOUSE_URL não configurado: eventos do pixel não serão guardados.',
        );
        this.warnedMissingConfig = true;
      }
      return;
    }

    const url = new URL(CLICKHOUSE_URL);
    url.searchParams.set(
      'query',
      'INSERT INTO tracking_events FORMAT JSONEachRow',
    );
    url.searchParams.set('database', CLICKHOUSE_DATABASE || 'default');
    url.searchParams.set('async_insert', '1');
    url.searchParams.set('wait_for_async_insert', '1');
    url.searchParams.set('date_time_input_format', 'best_effort');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          'X-ClickHouse-User': CLICKHOUSE_USERNAME || 'default',
          'X-ClickHouse-Key': CLICKHOUSE_PASSWORD ?? '',
        },
        body: rows.map((row) => JSON.stringify(row)).join('\n'),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        this.logger.error(
          `ClickHouse recusou ${rows.length} eventos (${response.status}): ${detail}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `ClickHouse indisponível; ${rows.length} eventos perdidos: ${String(error)}`,
      );
    }
  }
}
