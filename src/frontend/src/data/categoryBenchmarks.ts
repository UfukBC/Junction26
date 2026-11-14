/* Bridge from the demo DB's spending categories to Statistics Finland's COICOP groups.
 *
 * D-0011 allows comparing a user only with public statistics, never with other customers.
 * The benchmark basket is normalised so the comparison is like for like: the app's purchase
 * categories are a subset of household consumption (housing and utilities are excluded), so
 * each benchmark share is divided by the share of that same subset, not by the total.
 *
 * The customer is placed in the closest income band from their own deposits (see
 * `incomeQuintile`), never from another customer's data.
 */

import { QUINTILES, getCategoryBenchmark, type QuintileId } from "./benchmarks";

interface Mapping {
  codes: string[];
  label: string;
}

const MAPPING: Record<string, Mapping> = {
  Groceries: { codes: ["01"], label: "food and non-alcoholic drinks" },
  Restaurants: { codes: ["111"], label: "eating out and cafés" },
  Transportation: { codes: ["07"], label: "transport" },
  Entertainment: { codes: ["09"], label: "recreation and culture" },
  Health: { codes: ["06"], label: "health" },
  "Home & Tech": { codes: ["05", "081"], label: "furnishings and electronics" },
  Lifestyle: { codes: ["03", "132"], label: "clothing and personal items" },
  Travel: { codes: ["098", "112"], label: "holidays and accommodation" },
};

export const BENCHMARK_YEAR = 2022;

function rawShare(category: string, quintile: QuintileId): number | null {
  const mapping = MAPPING[category];
  if (!mapping) return null;
  let sum = 0;
  let found = false;
  for (const code of mapping.codes) {
    const value = getCategoryBenchmark(code)?.values[quintile]?.shareOfSpendingPct;
    if (typeof value === "number") {
      sum += value;
      found = true;
    }
  }
  return found ? sum : null;
}

function basketShare(quintile: QuintileId): number {
  return Object.keys(MAPPING).reduce((sum, category) => sum + (rawShare(category, quintile) ?? 0), 0);
}

/** Benchmark share of the app's own purchase basket (normalised to 100 %). */
export function benchmarkSharePct(category: string, quintile: QuintileId = "all"): number | null {
  const share = rawShare(category, quintile);
  const basket = basketShare(quintile);
  if (share === null || basket <= 0) return null;
  return (share / basket) * 100;
}

export function benchmarkLabel(category: string): string {
  return MAPPING[category]?.label ?? category.toLowerCase();
}

/** True for the app's purchase categories that have a public benchmark. */
export function hasBenchmark(category: string): boolean {
  return Boolean(MAPPING[category]);
}

/**
 * Closest income band for a yearly income figure, from the public quintile means.
 *
 * The survey quintiles are household disposable income per OECD consumption unit, not salary
 * brackets (see `BENCHMARKS.md`). We assume one adult (one consumption unit) and compare the
 * customer's yearly deposits with each quintile's mean income per consumption unit, picking the
 * nearest. Presenting the result as a "closest band" is deliberate: the file has group means, not
 * cut-off boundaries.
 */
export function incomeQuintile(annualIncomeEur: number): QuintileId {
  if (!Number.isFinite(annualIncomeEur) || annualIncomeEur <= 0) return "all";
  let best: QuintileId = "all";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const quintile of QUINTILES) {
    if (quintile.id === "all" || quintile.meanConsumptionUnits <= 0) continue;
    const perUnit = quintile.meanDisposableIncomeEur / quintile.meanConsumptionUnits;
    if (perUnit <= 0) continue;
    const distance = Math.abs(Math.log(annualIncomeEur / perUnit));
    if (distance < bestDistance) {
      best = quintile.id;
      bestDistance = distance;
    }
  }
  return best;
}

export interface ShareComparison {
  category: string;
  label: string;
  /** The user's share of their own card spending, %. */
  userSharePct: number;
  /** The benchmark household's share of its consumption in the same categories, %. */
  benchmarkSharePct: number;
  /** userShare / benchmarkShare. */
  ratio: number;
  note: string;
}

/**
 * Compare the user's share of card spending with the average Finnish household's share of
 * consumption, inside the same basket, for one income band.
 */
export function compareShare(
  category: string,
  categoryEur: number,
  totalEur: number,
  quintile: QuintileId = "all",
): ShareComparison | null {
  const benchmark = benchmarkSharePct(category, quintile);
  if (benchmark === null || totalEur <= 0) return null;
  const user = (categoryEur / totalEur) * 100;
  const ratio = benchmark > 0 ? user / benchmark : 0;
  let reference: string;
  if (quintile === "all") {
    reference = `The average Finnish household spends ${Math.round(benchmark)} % of its spending there.`;
  } else if (Math.abs(user - benchmark) < 1) {
    // Saying the same percentage twice adds nothing.
    reference = "That is about the same as people with a similar income.";
  } else {
    reference = `People with a similar income spend ${Math.round(benchmark)} %.`;
  }
  return {
    category,
    label: benchmarkLabel(category),
    userSharePct: user,
    benchmarkSharePct: benchmark,
    ratio,
    note: `You spend ${Math.round(user)} % of your card spending on ${benchmarkLabel(category)}. ${reference}`,
  };
}
