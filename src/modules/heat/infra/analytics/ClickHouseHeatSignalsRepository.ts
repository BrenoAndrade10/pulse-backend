import { Injectable, Logger } from '@nestjs/common';
import { Environment } from '../../../../config/Environment';
import type {
  HeatSignalsQuery,
  HeatSignalsRepository,
} from '../../domain/repositories/HeatSignalsRepository';
import type { HeatDailySignals } from '../../domain/services/HeatModel';

const TIMEOUT_MS = 10_000;
const MAX_IDS = 200;
const MAX_WINDOW_DAYS = 90;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMEZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

const TRACKING_SELECT = `SELECT
  e_day AS day,
  countIf(e_name = 'PageView') AS page_views,
  sumIf(toUInt64(e_engaged), e_name = 'Engaged') AS engaged_seconds,
  maxIf(toUInt64(e_scroll), e_name = 'Engaged') AS max_scroll,
  countIf(e_name NOT IN ('PageView', 'Engaged') AND e_rule != '' AND e_lead = '') AS interactions,
  countIf(e_lead != '') AS leads,
  toUInt64(0) AS link_clicks
FROM (
  SELECT
    event_id,
    any(event_name) AS e_name,
    any(engaged_seconds) AS e_engaged,
    any(scroll_depth) AS e_scroll,
    any(ifNull(toString(rule_id), '')) AS e_rule,
    any(ifNull(toString(lead_id), '')) AS e_lead,
    any(toDate(occurred_at, {timezone:String})) AS e_day
  FROM tracking_events
  WHERE tenant_id = {tenantId:String}
    AND anonymous_id IN {anonymousIds:Array(String)}
    AND toDate(occurred_at, {timezone:String}) BETWEEN {fromDay:Date} AND {toDay:Date}
  GROUP BY event_id
)
GROUP BY e_day`;

const LINK_CLICKS_SELECT = `SELECT
  c_day AS day,
  toUInt64(0) AS page_views,
  toUInt64(0) AS engaged_seconds,
  toUInt64(0) AS max_scroll,
  toUInt64(0) AS interactions,
  toUInt64(0) AS leads,
  count() AS link_clicks
FROM (
  SELECT
    click_id,
    any(toDate(occurred_at, {timezone:String})) AS c_day
  FROM link_clicks
  WHERE tenant_id = {tenantId:String}
    AND click_id IN {clickIds:Array(String)}
    AND is_bot = 0
    AND toDate(occurred_at, {timezone:String}) BETWEEN {fromDay:Date} AND {toDay:Date}
  GROUP BY click_id
)
GROUP BY c_day`;

type Row = {
  day: string;
  page_views: string | number;
  engaged_seconds: string | number;
  max_scroll: string | number;
  interactions: string | number;
  leads: string | number;
  link_clicks: string | number;
};

@Injectable()
export class ClickHouseHeatSignalsRepository implements HeatSignalsRepository {
  private readonly logger = new Logger(ClickHouseHeatSignalsRepository.name);
  private warnedMissingConfig = false;

  async findDailySignals(query: HeatSignalsQuery): Promise<HeatDailySignals[]> {
    const timezone = this.resolveTimezone(query.timezone);
    const { fromDay, toDay } = this.resolveWindow(
      query.today,
      query.windowDays,
    );
    const anonymousIds = this.sanitizeIds(query.anonymousIds);
    const clickIds = this.sanitizeIds(query.clickIds);

    if (anonymousIds.length === 0 && clickIds.length === 0) return [];

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
          'CLICKHOUSE_URL não configurado: sinais de heat indisponíveis.',
        );
        this.warnedMissingConfig = true;
      }
      return [];
    }

    const selects: string[] = [];
    if (anonymousIds.length > 0) selects.push(TRACKING_SELECT);
    if (clickIds.length > 0) selects.push(LINK_CLICKS_SELECT);

    const sql = `SELECT
  day,
  sum(page_views) AS page_views,
  sum(engaged_seconds) AS engaged_seconds,
  max(max_scroll) AS max_scroll,
  sum(interactions) AS interactions,
  sum(leads) AS leads,
  sum(link_clicks) AS link_clicks
FROM (
${selects.join('\nUNION ALL\n')}
)
GROUP BY day
ORDER BY day
FORMAT JSONEachRow`;

    const url = new URL(CLICKHOUSE_URL);
    url.searchParams.set('database', CLICKHOUSE_DATABASE || 'default');
    url.searchParams.set('param_tenantId', query.tenantId);
    url.searchParams.set('param_timezone', timezone);
    url.searchParams.set('param_fromDay', fromDay);
    url.searchParams.set('param_toDay', toDay);
    if (anonymousIds.length > 0)
      url.searchParams.set(
        'param_anonymousIds',
        this.toArrayParam(anonymousIds),
      );
    if (clickIds.length > 0)
      url.searchParams.set('param_clickIds', this.toArrayParam(clickIds));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-ClickHouse-User': CLICKHOUSE_USERNAME || 'default',
        'X-ClickHouse-Key': CLICKHOUSE_PASSWORD ?? '',
      },
      body: sql,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      throw new Error(
        `ClickHouse falhou ao ler sinais de heat (${response.status}): ${detail}`,
      );
    }

    const text = await response.text();
    return text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as Row)
      .map((row) => ({
        day: row.day,
        pageViews: Number(row.page_views),
        engagedSeconds: Number(row.engaged_seconds),
        maxScroll: Number(row.max_scroll),
        interactions: Number(row.interactions),
        leads: Number(row.leads),
        linkClicks: Number(row.link_clicks),
      }))
      .filter(
        (s) =>
          s.pageViews +
            s.engagedSeconds +
            s.maxScroll +
            s.interactions +
            s.leads +
            s.linkClicks >
          0,
      )
      .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  }

  private sanitizeIds(ids: string[]): string[] {
    const unique = new Set<string>();
    for (const id of ids) {
      if (typeof id !== 'string' || id === '') continue;
      unique.add(id);
      if (unique.size >= MAX_IDS) break;
    }
    return [...unique];
  }

  private toArrayParam(values: string[]): string {
    const escaped = values.map(
      (v) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`,
    );
    return `[${escaped.join(',')}]`;
  }

  private resolveTimezone(timezone: string): string {
    if (typeof timezone !== 'string' || !TIMEZONE_PATTERN.test(timezone))
      throw new RangeError(`Timezone inválido: ${String(timezone)}`);
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
      }).resolvedOptions().timeZone;
    } catch {
      throw new RangeError(`Timezone inválido: ${timezone}`);
    }
  }

  private resolveWindow(
    today: string,
    windowDays: number,
  ): { fromDay: string; toDay: string } {
    if (
      !Number.isInteger(windowDays) ||
      windowDays < 1 ||
      windowDays > MAX_WINDOW_DAYS
    )
      throw new RangeError(
        `windowDays deve ser inteiro entre 1 e ${MAX_WINDOW_DAYS}`,
      );
    if (typeof today !== 'string' || !DAY_PATTERN.test(today))
      throw new RangeError(`today inválido: ${String(today)}`);
    const [year, month, day] = today.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.toISOString().slice(0, 10) !== today)
      throw new RangeError(`today inválido: ${today}`);
    date.setUTCDate(date.getUTCDate() - windowDays);
    return { fromDay: date.toISOString().slice(0, 10), toDay: today };
  }
}
