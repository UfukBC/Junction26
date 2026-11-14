import type { Purchase } from "./database";

/*
 * Personal spending-time habits (T-016).
 *
 * Input: ONE customer's purchases for a period. Output: whether THEIR big purchases pile up in a time window
 * (late evening/night, or weekends) more than their purchases overall do. Everything is relative to that same
 * customer: "big" is a multiple of their own median purchase, and "unusual timing" compares their big purchases
 * with their own purchases overall. No other customer's data and no population statistic is used anywhere, and
 * the function is pure (no database, no module state), so the same purchases always give the same result.
 *
 * Wording rule: a finding describes WHAT happened (numbers from the customer's own data). Why it happens
 * (tiredness, impulse) is only ever offered as a possibility.
 */

export type HabitWindowId = "night" | "weekend";

export interface HabitOptions {
  /** A purchase is "big" when it is at least this many times the customer's own median purchase... */
  bigMultiple: number;
  /** ...and at least this many euros. */
  bigMinEur: number;
  /** Fewer purchases than this in the period = not enough history for a personal baseline: no finding. */
  minPurchases: number;
  /** Fewer big purchases than this in the period = too little to call it a habit. */
  minBigPurchases: number;
  /** Fewer big purchases than this inside the window = one-offs, not a habit. */
  minBigInWindow: number;
  /** At least this share of the customer's big purchases must fall inside the window. */
  minShareOfBig: number;
  /** The window's share of big purchases must be at least this many times its share of all purchases. */
  minOverRepresentation: number;
}

export const DEFAULT_HABIT_OPTIONS: HabitOptions = {
  bigMultiple: 3,
  bigMinEur: 100,
  minPurchases: 30,
  minBigPurchases: 5,
  minBigInWindow: 3,
  minShareOfBig: 0.4,
  minOverRepresentation: 2,
};

interface WindowDef {
  id: HabitWindowId;
  label: string;
  contains: (p: Purchase) => boolean;
}

// Purchases in the dataset happen 05:00–23:59, so "night" is effectively 21:00 onwards.
const WINDOWS: WindowDef[] = [
  { id: "night", label: "after 21:00", contains: (p) => p.hour >= 21 || p.hour < 5 },
  { id: "weekend", label: "at weekends", contains: (p) => p.weekday === 0 || p.weekday === 6 },
];

export interface TimeHabitFinding {
  window: HabitWindowId;
  windowLabel: string;
  /** The customer's own median purchase in the period. */
  medianEur: number;
  /** Purchases at or above this amount count as big for this customer. */
  bigThresholdEur: number;
  bigCount: number;
  bigTotalEur: number;
  bigInWindowCount: number;
  bigInWindowTotalEur: number;
  /** Share of the customer's big purchases that fall in the window (0–1). */
  windowShareOfBig: number;
  /** Share of all the customer's purchases that fall in the window (0–1). */
  windowShareOfAll: number;
  /** Up to three largest big purchases in the window, largest first. */
  examples: Purchase[];
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

/**
 * Time windows in which this customer's big purchases are over-represented, strongest (most money) first.
 * Empty when there is not enough history or no habit.
 */
export function detectTimeHabits(
  purchases: Purchase[],
  overrides: Partial<HabitOptions> = {},
): TimeHabitFinding[] {
  const o = { ...DEFAULT_HABIT_OPTIONS, ...overrides };
  if (purchases.length < o.minPurchases) return [];

  const medianEur = median(purchases.map((p) => p.amountEur));
  const bigThresholdEur = Math.max(o.bigMinEur, o.bigMultiple * medianEur);
  const big = purchases.filter((p) => p.amountEur >= bigThresholdEur);
  if (big.length < o.minBigPurchases) return [];

  const findings: TimeHabitFinding[] = [];
  for (const w of WINDOWS) {
    const bigIn = big.filter(w.contains);
    if (bigIn.length < o.minBigInWindow) continue;
    const shareOfBig = bigIn.length / big.length;
    const shareOfAll = purchases.filter(w.contains).length / purchases.length;
    if (shareOfBig < o.minShareOfBig) continue;
    if (shareOfAll > 0 && shareOfBig / shareOfAll < o.minOverRepresentation) continue;
    findings.push({
      window: w.id,
      windowLabel: w.label,
      medianEur,
      bigThresholdEur,
      bigCount: big.length,
      bigTotalEur: sum(big.map((p) => p.amountEur)),
      bigInWindowCount: bigIn.length,
      bigInWindowTotalEur: sum(bigIn.map((p) => p.amountEur)),
      windowShareOfBig: shareOfBig,
      windowShareOfAll: shareOfAll,
      examples: [...bigIn].sort((a, b) => b.amountEur - a.amountEur).slice(0, 3),
    });
  }
  return findings.sort((a, b) => b.bigInWindowTotalEur - a.bigInWindowTotalEur);
}

export interface HabitText {
  headline: string;
  detail: string;
  tip: string;
}

const eur0 = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 });

/**
 * Rule-based wording for a finding (the fallback when no AI text is available, and the structured input an AI
 * layer can start from). Uses only the customer's own numbers; the cause is offered as a possibility.
 */
export function describeHabit(f: TimeHabitFinding): HabitText {
  const bigLabel = `over ${eur0.format(Math.floor(f.bigThresholdEur / 10) * 10)} €`;
  const counts = `${f.bigInWindowCount} of your ${f.bigCount} big purchases (${bigLabel}) were ${f.windowLabel}, ${eur0.format(f.bigInWindowTotalEur)} € in total`;
  if (f.window === "night") {
    return {
      headline: "Your big purchases cluster late in the evening",
      detail: `${counts}. Only ${Math.round(f.windowShareOfAll * 100)} % of your purchases happen then. Late in the day, when you may be tired, it is easier to spend on impulse.`,
      tip: "Try a 24-hour rule: put big evening purchases in a cart and decide the next morning.",
    };
  }
  return {
    headline: "Your big purchases cluster at weekends",
    detail: `${counts}. Only ${Math.round(f.windowShareOfAll * 100)} % of your purchases happen then. Free time can make bigger spending feel easier to justify.`,
    tip: "Try setting a weekend spending limit on Friday, so big purchases are planned instead of spontaneous.",
  };
}
