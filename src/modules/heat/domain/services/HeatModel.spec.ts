import { computeHeat, HEAT_CONFIG, HeatDailySignals } from './HeatModel';

const TODAY = '2026-11-12';

const signals = (
  overrides: Partial<HeatDailySignals> = {},
): HeatDailySignals => ({
  day: TODAY,
  pageViews: 0,
  engagedSeconds: 0,
  maxScroll: 0,
  interactions: 0,
  leads: 0,
  linkClicks: 0,
  ...overrides,
});

const scoreOf = (days: HeatDailySignals[]): number =>
  computeHeat(days, TODAY).score;

const daysAgo = (age: number): string => {
  const date = new Date(Date.UTC(2026, 10, 12 - age));
  return date.toISOString().slice(0, 10);
};

describe('computeHeat', () => {
  describe('lista vazia', () => {
    it('retorna score 0 e faixa cold', () => {
      expect(computeHeat([], TODAY)).toEqual({ score: 0, band: 'cold' });
    });
  });

  describe('pageViews', () => {
    it.each([
      [1, 2],
      [3, 6],
      [5, 10],
      [9, 10],
    ])('%i visitas geram %i pontos', (pageViews, expected) => {
      expect(scoreOf([signals({ pageViews })])).toBe(expected);
    });
  });

  describe('engaged (faixa única por dia)', () => {
    it('não pontua abaixo do limiar inferior', () => {
      expect(scoreOf([signals({ engagedSeconds: 14, maxScroll: 49 })])).toBe(0);
    });

    it('pontua faixa menor por tempo (15s)', () => {
      expect(scoreOf([signals({ engagedSeconds: 15 })])).toBe(3);
    });

    it('pontua faixa menor por scroll (50%)', () => {
      expect(scoreOf([signals({ maxScroll: 50 })])).toBe(3);
    });

    it('pontua faixa maior por tempo (60s)', () => {
      expect(scoreOf([signals({ engagedSeconds: 60 })])).toBe(6);
    });

    it('pontua faixa maior por scroll (90%)', () => {
      expect(scoreOf([signals({ maxScroll: 90 })])).toBe(6);
    });

    it('faixa maior substitui a menor e não soma (60s + 50%)', () => {
      expect(scoreOf([signals({ engagedSeconds: 60, maxScroll: 50 })])).toBe(6);
    });

    it('faixa maior por scroll substitui a menor por tempo (15s + 90%)', () => {
      expect(scoreOf([signals({ engagedSeconds: 15, maxScroll: 90 })])).toBe(6);
    });
  });

  describe('interactions', () => {
    it('pontua 3 por interação até o teto de 3', () => {
      expect(scoreOf([signals({ interactions: 2 })])).toBe(6);
      expect(scoreOf([signals({ interactions: 3 })])).toBe(9);
    });

    it('limita a 9 pontos por dia', () => {
      expect(scoreOf([signals({ interactions: 4 })])).toBe(9);
    });
  });

  describe('leads', () => {
    it('pontua 20 com 1 lead', () => {
      expect(scoreOf([signals({ leads: 1 })])).toBe(20);
    });

    it('pontua no máximo 1x por dia', () => {
      expect(scoreOf([signals({ leads: 3 })])).toBe(20);
    });

    it('pontua 1x em cada dia diferente', () => {
      expect(
        scoreOf([
          signals({ leads: 1 }),
          signals({ day: daysAgo(1), leads: 1 }),
        ]),
      ).toBe(40);
    });
  });

  describe('linkClicks', () => {
    it('pontua 5 por clique até o teto de 3', () => {
      expect(scoreOf([signals({ linkClicks: 2 })])).toBe(10);
      expect(scoreOf([signals({ linkClicks: 3 })])).toBe(15);
    });

    it('limita a 15 pontos por dia', () => {
      expect(scoreOf([signals({ linkClicks: 10 })])).toBe(15);
    });
  });

  describe('decaimento pela idade do dia', () => {
    it.each([
      [0, 20],
      [7, 20],
      [8, 10],
      [30, 10],
      [31, 0],
    ])('idade %i dias com lead gera %i', (age, expected) => {
      expect(scoreOf([signals({ day: daysAgo(age), leads: 1 })])).toBe(
        expected,
      );
    });

    it('ignora dia futuro', () => {
      expect(
        scoreOf([signals({ day: '2026-11-13', pageViews: 5, leads: 1 })]),
      ).toBe(0);
    });
  });

  describe('dias duplicados', () => {
    it('soma pageViews antes do teto', () => {
      expect(
        scoreOf([signals({ pageViews: 3 }), signals({ pageViews: 4 })]),
      ).toBe(10);
    });

    it('soma engagedSeconds antes de aplicar a faixa', () => {
      expect(
        scoreOf([
          signals({ engagedSeconds: 10 }),
          signals({ engagedSeconds: 10 }),
        ]),
      ).toBe(3);
    });

    it('usa o maior maxScroll', () => {
      expect(
        scoreOf([signals({ maxScroll: 40 }), signals({ maxScroll: 60 })]),
      ).toBe(3);
    });

    it('soma interactions antes do teto', () => {
      expect(
        scoreOf([signals({ interactions: 2 }), signals({ interactions: 2 })]),
      ).toBe(9);
    });

    it('não duplica lead do mesmo dia', () => {
      expect(scoreOf([signals({ leads: 1 }), signals({ leads: 1 })])).toBe(20);
    });

    it('soma linkClicks antes do teto', () => {
      expect(
        scoreOf([signals({ linkClicks: 2 }), signals({ linkClicks: 2 })]),
      ).toBe(15);
    });
  });

  describe('entrada inválida', () => {
    it.each([
      ['NaN', Number.NaN],
      ['negativo', -3],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
    ])('trata %s como 0', (_label, value) => {
      expect(
        scoreOf([
          signals({
            pageViews: value,
            engagedSeconds: value,
            maxScroll: value,
            interactions: value,
            leads: value,
            linkClicks: value,
          }),
        ]),
      ).toBe(0);
    });

    it('zera só o campo inválido', () => {
      expect(
        scoreOf([signals({ pageViews: Number.POSITIVE_INFINITY, leads: 1 })]),
      ).toBe(20);
    });

    it('ignora dia com data inexistente', () => {
      expect(
        scoreOf([signals({ day: '2026-02-30', pageViews: 5, leads: 1 })]),
      ).toBe(0);
    });

    it('ignora dia fora do formato YYYY-MM-DD', () => {
      expect(scoreOf([signals({ day: '12/11/2026', pageViews: 5 })])).toBe(0);
    });

    it('lança erro quando today não é uma data válida', () => {
      expect(() => computeHeat([], '2026-13-01')).toThrow(RangeError);
    });
  });

  describe('faixas', () => {
    it('19 pontos é cold', () => {
      expect(
        computeHeat([signals({ pageViews: 5, interactions: 3 })], TODAY),
      ).toEqual({ score: 19, band: 'cold' });
    });

    it('20 pontos é warm', () => {
      expect(computeHeat([signals({ leads: 1 })], TODAY)).toEqual({
        score: 20,
        band: 'warm',
      });
    });

    it('59 pontos é warm', () => {
      expect(
        computeHeat(
          [
            signals({ leads: 1, pageViews: 5, interactions: 3, linkClicks: 2 }),
            signals({ day: daysAgo(1), pageViews: 5 }),
          ],
          TODAY,
        ),
      ).toEqual({ score: 59, band: 'warm' });
    });

    it('60 pontos é hot', () => {
      expect(
        computeHeat(
          [
            signals({
              pageViews: 5,
              engagedSeconds: 60,
              interactions: 3,
              leads: 1,
              linkClicks: 3,
            }),
          ],
          TODAY,
        ),
      ).toEqual({ score: 60, band: 'hot' });
    });

    it('expõe os cortes em HEAT_CONFIG', () => {
      expect(HEAT_CONFIG.bands).toEqual({ warmFrom: 20, hotFrom: 60 });
    });
  });

  describe('arredondamento', () => {
    it('fator 0.5 com 3 pontos arredonda 1.5 para 2', () => {
      expect(
        computeHeat([signals({ day: daysAgo(8), engagedSeconds: 15 })], TODAY)
          .score,
      ).toBe(2);
    });

    it('fator 0.5 com 5 pontos arredonda 2.5 para 3', () => {
      expect(
        computeHeat([signals({ day: daysAgo(8), linkClicks: 1 })], TODAY).score,
      ).toBe(3);
    });

    it('arredonda apenas o total final, não por dia', () => {
      expect(
        scoreOf([
          signals({ day: daysAgo(8), engagedSeconds: 15 }),
          signals({ day: daysAgo(9), engagedSeconds: 15 }),
        ]),
      ).toBe(3);
    });
  });
});
