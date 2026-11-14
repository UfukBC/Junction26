import { formatEurWhole } from "../format";
import { QUINTILES, getCategoryBenchmark, type QuintileBenchmark, type QuintileId } from "./benchmarks";
import type { CategorySpend, MonthlyFlow } from "./database";

/**
 * Comparison of ONE customer's own spending with Statistics Finland's public Household Budget Survey 2022
 * (`benchmarks.json`). Never uses other S-Bank customers' data (D-0011).
 *
 * Everything is in € per month per OECD consumption unit. One bank account = one adult = 1 consumption unit,
 * so the customer's own figures are compared as they are.
 */

/** Attribution shown wherever a benchmark figure appears. */
export const BENCHMARK_SOURCE = "Statistics Finland, Household Budget Survey 2022 · closest income band · 2022 prices";

/**
 * App purchase category → COICOP codes that are summed for its benchmark.
 *
 * Only the eight `purchase` categories are mapped. Housing and Utilities are fixed bills (not Everyday slices),
 * and the housing benchmark includes imputed rent for owner-occupiers, so they are not compared.
 *
 * Rules: no code appears twice and no code sits inside another mapped code (checked in the unit test).
 * Differences from the table in BENCHMARKS.md, on purpose:
 * - Transportation `072` + `073`, not `07`: `07` includes car purchases (`071`), which are not card spending.
 * - Entertainment `092` + `094` + `096`, not `09`: `09` also contains package holidays (`098`, used by Travel).
 * - Lifestyle `03` + `132`, without `09`: `09` would double-count Entertainment.
 * - Travel `098` + `112`: `073.3` (air) is not in the file (levels 1–2 only), and `073` is already in Transportation.
 */
export const CATEGORY_TO_COICOP: Record<string, readonly string[]> = {
  Groceries: ["01"],
  Restaurants: ["111"],
  Transportation: ["072", "073"],
  Entertainment: ["092", "094", "096"],
  Health: ["06"],
  "Home & Tech": ["05", "081"],
  Lifestyle: ["03", "132"],
  Travel: ["098", "112"],
};

/** Mean disposable income per consumption unit in a band (€/year). Household means would put one person too low. */
export function bandIncomeEur(quintile: QuintileBenchmark): number {
  return quintile.meanDisposableIncomeEur / quintile.meanConsumptionUnits;
}

/**
 * Closest band (Q1–Q5) for a yearly income of one person.
 * Formula: argmin over Q1–Q5 of |annualIncomeEur − meanDisposableIncome / meanConsumptionUnits|.
 * These are group means, not cut-offs, so the UI says "closest income band", never "your bracket".
 */
export function getClosestQuintile(annualIncomeEur: number): QuintileBenchmark {
  const bands = QUINTILES.filter((q) => q.id !== "all");
  return bands.reduce((best, q) =>
    Math.abs(annualIncomeEur - bandIncomeEur(q)) < Math.abs(annualIncomeEur - bandIncomeEur(best)) ? q : best,
  );
}

/** "Q3" */
export function bandLabel(quintile: QuintileBenchmark): string {
  return quintile.id.toUpperCase();
}

/**
 * Benchmark €/month for an app category in a band: sum of `eurMonthPerConsumptionUnit` over its COICOP codes.
 * null when the category is not mapped or any code is missing/suppressed (a partial sum would understate it).
 */
export function benchmarkMonthEur(category: string, quintileId: QuintileId): number | null {
  const codes = CATEGORY_TO_COICOP[category];
  if (!codes) return null;
  let sum = 0;
  for (const code of codes) {
    const value = getCategoryBenchmark(code)?.values[quintileId]?.eurMonthPerConsumptionUnit;
    if (value == null) return null;
    sum += value;
  }
  return sum;
}

export interface CategoryComparison {
  category: string;
  quintileId: QuintileId;
  /** The customer's own average €/month in the category. */
  userMonthlyEur: number;
  /** Band average €/month (Statistics Finland 2022). */
  benchmarkMonthEur: number;
  /** userMonthlyEur − benchmarkMonthEur, rounded to whole euros. */
  diffEur: number;
}

/** Euro comparison only. Shares are not compared: the survey share is of whole-household spending incl. imputed rent. */
export function compareCategory(
  category: string,
  userMonthlyEur: number,
  quintileId: QuintileId,
): CategoryComparison | null {
  const benchmark = benchmarkMonthEur(category, quintileId);
  if (benchmark === null) return null;
  return {
    category,
    quintileId,
    userMonthlyEur,
    benchmarkMonthEur: benchmark,
    diffEur: Math.round(userMonthlyEur - benchmark),
  };
}

/** The customer's own 12-month baseline that every comparison uses. */
export interface PeerBaseline {
  quintile: QuintileBenchmark;
  monthsUsed: number;
  /** Average money in per month over the window. */
  avgMonthlyIncomeEur: number;
  /** Average €/month per spending category over the window. */
  categoryAvgEur: Record<string, number>;
}

/**
 * Builds the baseline from one customer's own rows for a window (normally the last 12 months).
 * Band: average monthly income × 12, so a month without a salary does not move the band.
 * Category averages: window total / number of months in the window.
 */
export function buildPeerBaseline(flows: MonthlyFlow[], categories: CategorySpend[]): PeerBaseline | null {
  if (flows.length === 0) return null;
  const monthsUsed = flows.length;
  const avgMonthlyIncomeEur = flows.reduce((sum, f) => sum + f.incomeEur, 0) / monthsUsed;
  const categoryAvgEur: Record<string, number> = {};
  for (const row of categories) categoryAvgEur[row.category] = row.totalEur / monthsUsed;
  return { quintile: getClosestQuintile(avgMonthlyIncomeEur * 12), monthsUsed, avgMonthlyIncomeEur, categoryAvgEur };
}

/** Comparison of one category on the baseline (the customer's own average vs the band average). */
export function baselineComparison(baseline: PeerBaseline, category: string): CategoryComparison | null {
  const own = baseline.categoryAvgEur[category];
  if (own === undefined) return null;
  return compareCategory(category, own, baseline.quintile.id);
}

/**
 * One plain sentence for the local Everyday summary. Avoids the word "income" on purpose:
 * useAdvice rejects Everyday text that mentions income.
 */
export function peerNoteFor(baseline: PeerBaseline | null, category: string): string {
  if (!baseline) return "";
  const c = baselineComparison(baseline, category);
  if (!c) return "";
  return `Over ${baseline.monthsUsed} months you averaged ${formatEurWhole(c.userMonthlyEur)} a month on ${category.toLowerCase()}; Finnish households in the same band (${bandLabel(baseline.quintile)}) average ${formatEurWhole(c.benchmarkMonthEur)}.`;
}

/** Fact lines for the AI brief, for the given categories (largest first). Also worded without "income". */
export function peerFacts(baseline: PeerBaseline | null, categories: string[], limit = 3): string[] {
  if (!baseline) return [];
  const facts: string[] = [];
  for (const category of categories) {
    if (facts.length >= limit) break;
    const c = baselineComparison(baseline, category);
    if (!c) continue;
    facts.push(
      `${category}: own ${baseline.monthsUsed}-month average ${formatEurWhole(c.userMonthlyEur)}/month; same-band households (${bandLabel(baseline.quintile)}) ${formatEurWhole(c.benchmarkMonthEur)}/month.`,
    );
  }
  return facts;
}
