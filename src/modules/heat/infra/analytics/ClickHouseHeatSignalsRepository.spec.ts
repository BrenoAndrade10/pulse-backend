import { Environment } from '../../../../config/Environment';
import { ClickHouseHeatSignalsRepository } from './ClickHouseHeatSignalsRepository';
import type { HeatSignalsQuery } from '../../domain/repositories/HeatSignalsRepository';

const baseQuery: HeatSignalsQuery = {
  tenantId: 'tenant-1',
  anonymousIds: ['anon-1'],
  clickIds: ['click-1'],
  timezone: 'America/Sao_Paulo',
  today: '2026-11-12',
  windowDays: 30,
};

function setVars(vars: Record<string, string | undefined>): void {
  (Environment as unknown as { vars: unknown }).vars = vars;
}

function okResponse(lines: object[]): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(lines.map((l) => JSON.stringify(l)).join('\n')),
  } as unknown as Response;
}

describe('ClickHouseHeatSignalsRepository', () => {
  let fetchMock: jest.Mock;
  let repository: ClickHouseHeatSignalsRepository;

  const call = () => {
    const [url, init] = fetchMock.mock.calls[0] as [
      URL,
      { body: string; headers: Record<string, string> },
    ];
    return { url, sql: init.body, headers: init.headers };
  };

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(okResponse([]));
    global.fetch = fetchMock;
    setVars({
      CLICKHOUSE_URL: 'http://clickhouse.test:8123',
      CLICKHOUSE_USERNAME: 'user',
      CLICKHOUSE_PASSWORD: 'pass',
      CLICKHOUSE_DATABASE: 'pulse',
    });
    repository = new ClickHouseHeatSignalsRepository();
  });

  it('envia parâmetros tipados e não interpola valores no SQL', async () => {
    const evil = "x'; DROP TABLE tracking_events; --";
    await repository.findDailySignals({
      ...baseQuery,
      tenantId: evil,
      anonymousIds: [evil, "a\\b'c"],
      clickIds: ['click-9'],
    });

    const { url, sql, headers } = call();
    expect(url.searchParams.get('database')).toBe('pulse');
    expect(url.searchParams.get('param_tenantId')).toBe(evil);
    expect(url.searchParams.get('param_timezone')).toBe('America/Sao_Paulo');
    expect(url.searchParams.get('param_fromDay')).toBe('2026-10-13');
    expect(url.searchParams.get('param_toDay')).toBe('2026-11-12');
    expect(url.searchParams.get('param_anonymousIds')).toBe(
      "['x\\'; DROP TABLE tracking_events; --','a\\\\b\\'c']",
    );
    expect(url.searchParams.get('param_clickIds')).toBe("['click-9']");
    expect(headers['X-ClickHouse-User']).toBe('user');
    expect(headers['X-ClickHouse-Key']).toBe('pass');

    expect(sql).toContain('{tenantId:String}');
    expect(sql).toContain('{anonymousIds:Array(String)}');
    expect(sql).toContain('{clickIds:Array(String)}');
    expect(sql).toContain('{timezone:String}');
    expect(sql).toContain('{fromDay:Date}');
    expect(sql).toContain('{toDay:Date}');
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain('tenant-1');
    expect(sql).not.toContain('Sao_Paulo');
    expect(sql).not.toContain('2026-');
    expect(sql).toContain('FORMAT JSONEachRow');
  });

  it('o SQL deduplica por event_id/click_id, filtra tenant e exclui bots', async () => {
    await repository.findDailySignals(baseQuery);
    const { sql } = call();
    expect(sql).toContain('FROM tracking_events');
    expect(sql).toContain('GROUP BY event_id');
    expect(sql).toContain('tenant_id = {tenantId:String}');
    expect(sql).toContain('anonymous_id IN {anonymousIds:Array(String)}');
    expect(sql).toContain('FROM link_clicks');
    expect(sql).toContain('GROUP BY click_id');
    expect(sql).toContain('click_id IN {clickIds:Array(String)}');
    expect(sql).toContain('is_bot = 0');
    expect(sql).toContain('toDate(occurred_at, {timezone:String})');
    expect(sql).toContain("ifNull(toString(lead_id), '')");
    expect(sql).toContain("ifNull(toString(rule_id), '')");
    expect(sql).toContain('UNION ALL');
  });

  it('remove vazios e duplicados e limita a 200 ids', async () => {
    const many = Array.from({ length: 300 }, (_, i) => `a${i}`);
    await repository.findDailySignals({
      ...baseQuery,
      anonymousIds: ['', 'dup', 'dup', ...many],
      clickIds: ['', 'c1', 'c1'],
    });
    const { url } = call();
    const anon = url.searchParams.get('param_anonymousIds') as string;
    expect(anon.split(',')).toHaveLength(200);
    expect(anon.match(/'dup'/g)).toHaveLength(1);
    expect(anon).not.toContain("''");
    expect(url.searchParams.get('param_clickIds')).toBe("['c1']");
  });

  it('usa só a parte de tracking quando não há clickIds', async () => {
    await repository.findDailySignals({ ...baseQuery, clickIds: [''] });
    const { url, sql } = call();
    expect(sql).not.toContain('FROM link_clicks');
    expect(sql).not.toContain('UNION ALL');
    expect(url.searchParams.has('param_clickIds')).toBe(false);
  });

  it('usa só a parte de link clicks quando não há anonymousIds', async () => {
    await repository.findDailySignals({ ...baseQuery, anonymousIds: [] });
    const { url, sql } = call();
    expect(sql).not.toContain('FROM tracking_events');
    expect(url.searchParams.has('param_anonymousIds')).toBe(false);
  });

  it('não chama o ClickHouse quando ambos ficam vazios', async () => {
    const result = await repository.findDailySignals({
      ...baseQuery,
      anonymousIds: ['', ''],
      clickIds: [],
    });
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([0, 91, 1.5, Number.NaN])('rejeita windowDays %p', async (days) => {
    await expect(
      repository.findDailySignals({ ...baseQuery, windowDays: days }),
    ).rejects.toThrow(RangeError);
  });

  it.each(['2026-02-30', '2026-13-01', '12/11/2026', '', '2026-1-1'])(
    'rejeita today %p',
    async (today) => {
      await expect(
        repository.findDailySignals({ ...baseQuery, today }),
      ).rejects.toThrow(RangeError);
    },
  );

  it.each(['Nao/Existe', "x'; DROP", '', '+03:00', 'America/Sao Paulo'])(
    'rejeita timezone %p',
    async (timezone) => {
      await expect(
        repository.findDailySignals({ ...baseQuery, timezone }),
      ).rejects.toThrow(RangeError);
    },
  );

  it('aceita UTC e calcula a janela atravessando ano bissexto', async () => {
    await repository.findDailySignals({
      ...baseQuery,
      timezone: 'UTC',
      today: '2028-03-01',
      windowDays: 2,
    });
    const { url } = call();
    expect(url.searchParams.get('param_timezone')).toBe('UTC');
    expect(url.searchParams.get('param_fromDay')).toBe('2028-02-28');
  });

  it('retorna [] e avisa uma vez sem CLICKHOUSE_URL', async () => {
    setVars({});
    const warn = jest
      .spyOn(
        (repository as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    expect(await repository.findDailySignals(baseQuery)).toEqual([]);
    expect(await repository.findDailySignals(baseQuery)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lança quando o HTTP não é ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Code: 60'),
    });
    await expect(repository.findDailySignals(baseQuery)).rejects.toThrow(/500/);
  });

  it('propaga erro de rede', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    await expect(repository.findDailySignals(baseQuery)).rejects.toThrow(
      'boom',
    );
  });

  it('mapeia strings para números, ordena por dia e omite dias zerados', async () => {
    fetchMock.mockResolvedValue(
      okResponse([
        {
          day: '2026-11-10',
          page_views: '2',
          engaged_seconds: '40',
          max_scroll: 80,
          interactions: '1',
          leads: '0',
          link_clicks: '0',
        },
        {
          day: '2026-11-08',
          page_views: '0',
          engaged_seconds: '0',
          max_scroll: '0',
          interactions: '0',
          leads: '0',
          link_clicks: '3',
        },
        {
          day: '2026-11-09',
          page_views: '0',
          engaged_seconds: '0',
          max_scroll: '0',
          interactions: '0',
          leads: '0',
          link_clicks: '0',
        },
      ]),
    );
    expect(await repository.findDailySignals(baseQuery)).toEqual([
      {
        day: '2026-11-08',
        pageViews: 0,
        engagedSeconds: 0,
        maxScroll: 0,
        interactions: 0,
        leads: 0,
        linkClicks: 3,
      },
      {
        day: '2026-11-10',
        pageViews: 2,
        engagedSeconds: 40,
        maxScroll: 80,
        interactions: 1,
        leads: 0,
        linkClicks: 0,
      },
    ]);
  });

  it('mescla tracking e link clicks do mesmo dia numa linha só', async () => {
    fetchMock.mockResolvedValue(
      okResponse([
        {
          day: '2026-11-10',
          page_views: '1',
          engaged_seconds: '5',
          max_scroll: '30',
          interactions: '0',
          leads: '1',
          link_clicks: '2',
        },
      ]),
    );
    const result = await repository.findDailySignals(baseQuery);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ pageViews: 1, leads: 1, linkClicks: 2 });
  });
});
