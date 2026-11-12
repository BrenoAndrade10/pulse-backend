import { Injectable, Logger } from '@nestjs/common';
import { Environment } from '../../../../config/Environment';
import type {
  LinkClickRow,
  LinkClicksSink,
} from '../../domain/services/LinkClicksSink';

@Injectable()
export class ClickHouseLinkClicksSink implements LinkClicksSink {
  private readonly logger = new Logger(ClickHouseLinkClicksSink.name);

  async write(rows: LinkClickRow[]): Promise<void> {
    if (rows.length === 0) return;
    Environment.assertInitialized();
    const {
      CLICKHOUSE_URL,
      CLICKHOUSE_USERNAME,
      CLICKHOUSE_PASSWORD,
      CLICKHOUSE_DATABASE,
    } = Environment.vars;
    if (!CLICKHOUSE_URL) return;
    const url = new URL(CLICKHOUSE_URL);
    url.searchParams.set('query', 'INSERT INTO link_clicks FORMAT JSONEachRow');
    url.searchParams.set('database', CLICKHOUSE_DATABASE || 'default');
    url.searchParams.set('async_insert', '1');
    url.searchParams.set('wait_for_async_insert', '1');
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          'X-ClickHouse-User': CLICKHOUSE_USERNAME || 'default',
          'X-ClickHouse-Key': CLICKHOUSE_PASSWORD ?? '',
        },
        body: rows.map((row) => JSON.stringify(row)).join('\n'),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok)
        this.logger.error(
          `ClickHouse recusou ${rows.length} cliques (${response.status})`,
        );
    } catch (error) {
      this.logger.error(
        `ClickHouse indisponível; ${rows.length} cliques perdidos: ${String(error)}`,
      );
    }
  }
}
