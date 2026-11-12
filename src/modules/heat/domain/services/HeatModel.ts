export type HeatDailySignals = {
  day: string;
  pageViews: number;
  engagedSeconds: number;
  maxScroll: number;
  interactions: number;
  leads: number;
  linkClicks: number;
};

export type HeatBand = 'cold' | 'warm' | 'hot';

export type HeatResult = { score: number; band: HeatBand };

export const HEAT_CONFIG = {
  pageViews: { pointsPerVisit: 2, maxVisits: 5 },
  engaged: {
    lowPoints: 3,
    lowEngagedSeconds: 15,
    lowMaxScroll: 50,
    highPoints: 6,
    highEngagedSeconds: 60,
    highMaxScroll: 90,
  },
  interactions: { pointsPerInteraction: 3, maxInteractions: 3 },
  leads: { points: 20 },
  linkClicks: { pointsPerClick: 5, maxClicks: 3 },
  decay: { fullFactorMaxAgeDays: 7, halfFactorMaxAgeDays: 30, halfFactor: 0.5 },
  bands: { warmFrom: 20, hotFrom: 60 },
} as const;

const DAY_MS = 86_400_000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const sanitizeNumber = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

const sanitizeSignals = (signals: HeatDailySignals): HeatDailySignals => ({
  day: signals.day,
  pageViews: sanitizeNumber(signals.pageViews),
  engagedSeconds: sanitizeNumber(signals.engagedSeconds),
  maxScroll: sanitizeNumber(signals.maxScroll),
  interactions: sanitizeNumber(signals.interactions),
  leads: sanitizeNumber(signals.leads),
  linkClicks: sanitizeNumber(signals.linkClicks),
});

const toEpochDays = (value: string): number | null => {
  const match = DAY_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);
  const isSameDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  return isSameDate ? time / DAY_MS : null;
};

const mergeByDay = (days: HeatDailySignals[]): HeatDailySignals[] => {
  const merged = new Map<string, HeatDailySignals>();
  for (const item of days) {
    const sanitized = sanitizeSignals(item);
    const current = merged.get(sanitized.day);
    merged.set(
      sanitized.day,
      current
        ? {
            day: sanitized.day,
            pageViews: current.pageViews + sanitized.pageViews,
            engagedSeconds: current.engagedSeconds + sanitized.engagedSeconds,
            maxScroll: Math.max(current.maxScroll, sanitized.maxScroll),
            interactions: current.interactions + sanitized.interactions,
            leads: current.leads + sanitized.leads,
            linkClicks: current.linkClicks + sanitized.linkClicks,
          }
        : sanitized,
    );
  }
  return [...merged.values()];
};

const engagedPoints = (signals: HeatDailySignals): number => {
  const { engaged } = HEAT_CONFIG;
  if (
    signals.engagedSeconds >= engaged.highEngagedSeconds ||
    signals.maxScroll >= engaged.highMaxScroll
  ) {
    return engaged.highPoints;
  }
  if (
    signals.engagedSeconds >= engaged.lowEngagedSeconds ||
    signals.maxScroll >= engaged.lowMaxScroll
  ) {
    return engaged.lowPoints;
  }
  return 0;
};

const dayPoints = (signals: HeatDailySignals): number => {
  const { pageViews, interactions, leads, linkClicks } = HEAT_CONFIG;
  return (
    Math.min(signals.pageViews, pageViews.maxVisits) *
      pageViews.pointsPerVisit +
    engagedPoints(signals) +
    Math.min(signals.interactions, interactions.maxInteractions) *
      interactions.pointsPerInteraction +
    (signals.leads >= 1 ? leads.points : 0) +
    Math.min(signals.linkClicks, linkClicks.maxClicks) *
      linkClicks.pointsPerClick
  );
};

const decayFactor = (ageDays: number): number => {
  const { decay } = HEAT_CONFIG;
  if (ageDays < 0) {
    return 0;
  }
  if (ageDays <= decay.fullFactorMaxAgeDays) {
    return 1;
  }
  if (ageDays <= decay.halfFactorMaxAgeDays) {
    return decay.halfFactor;
  }
  return 0;
};

const bandFor = (score: number): HeatBand => {
  const { bands } = HEAT_CONFIG;
  if (score >= bands.hotFrom) {
    return 'hot';
  }
  if (score >= bands.warmFrom) {
    return 'warm';
  }
  return 'cold';
};

export function computeHeat(
  days: HeatDailySignals[],
  today: string,
): HeatResult {
  const todayEpochDays = toEpochDays(today);
  if (todayEpochDays === null) {
    throw new RangeError('Invalid today date, expected YYYY-MM-DD');
  }

  let total = 0;
  for (const signals of mergeByDay(days)) {
    const dayEpochDays = toEpochDays(signals.day);
    if (dayEpochDays === null) {
      continue;
    }
    total += dayPoints(signals) * decayFactor(todayEpochDays - dayEpochDays);
  }

  const score = Math.round(total);
  return { score, band: bandFor(score) };
}
