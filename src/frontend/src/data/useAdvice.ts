import { useEffect, useState } from "react";
import { formatEur, formatEurWhole } from "../format";
import { compareShare, hasBenchmark, incomeQuintile, type ShareComparison } from "./categoryBenchmarks";
import {
  getCategoryMonthlySpending,
  getFrequentPlaces,
  getLargestPurchases,
  getMonthlyFlow,
  getSpendingByCategory,
  monthRange,
  type CategoryMonthSpend,
  type CategorySpend,
  type LargePurchase,
  type MonthlyFlow,
  type MonthStory,
  type PlaceHabit,
} from "./database";
import {
  cachedAdvice,
  cachedAdviceFor,
  fallbackAdvice,
  fetchSegmentAdvice,
  type AdviceRequest,
  type SegmentAdvice,
} from "./segmentAdvice";

export const OVERVIEW = "Month overview";

export interface Advice extends SegmentAdvice {
  /** true when the text came from the AI service, false for the built-in fallback. */
  fromAi: boolean;
  /** true while the model request is in flight; the built-in text is shown meanwhile. */
  loading: boolean;
  /** This month against the customer's own previous months. */
  trend: string | null;
  /** One category against the public statistics for the closest income band. */
  benchmark: string | null;
  /** The facts sent to the model. Deep thinking sends the same text to both of its agents. */
  brief?: string;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Amount of a ring segment, an Everyday category, or the income, for the selected name. */
export function amountOf(story: MonthStory, name: string): number {
  if (name === "Income") return story.incomeEur;
  const slice = story.slices.find((item) => item.name === name);
  if (slice) return slice.valueEur;
  const everyday = story.slices.find((item) => item.name === "Everyday");
  return everyday?.categories?.find((item) => item.name === name)?.valueEur ?? 0;
}

/**
 * The place this customer visits most in the month, when it repeats enough to call it a habit.
 * Wording describes what happened; the amount and count come from the customer's own payments.
 */
export function habitLine(places: PlaceHabit[], minimumVisits = 3): string | null {
  const top = places.find((place) => place.visits >= minimumVisits);
  if (!top) return null;
  const when = [
    top.weekday !== null ? `usually on ${WEEKDAYS[top.weekday]}s` : "",
    top.hour !== null ? `around ${String(top.hour).padStart(2, "0")}:00` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `${top.name}, ${top.visits} visits, ${formatEur(top.totalEur)}${when ? ` (${when})` : ""}`;
}

/* ------------------------------------------------------ previous months */

export interface Trend {
  /** This month's bills + everyday spending. */
  currentEur: number;
  /** Average spending of the previous months in the window (null when there is no history). */
  averageEur: number | null;
  /** Previous months used for the average. */
  monthsCompared: number;
  /** current - average, positive means this month is higher. */
  differenceEur: number | null;
  /** difference / average, 0 when there is no history. */
  differencePct: number | null;
  text: string | null;
}

function totalSpent(story: MonthStory): number {
  return amountOf(story, "Fixed") + amountOf(story, "Everyday");
}

/** This month against up to 12 earlier months of the same customer, all from `getMonthlyFlow`. */
export function monthTrend(story: MonthStory, flows: MonthlyFlow[], historyMonths = 12): Trend {
  const currentEur = totalSpent(story);
  const previous = flows
    .filter((flow) => flow.month < story.month)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-historyMonths);
  if (previous.length === 0) {
    return {
      currentEur,
      averageEur: null,
      monthsCompared: 0,
      differenceEur: null,
      differencePct: null,
      text: null,
    };
  }
  const averageEur = previous.reduce((sum, flow) => sum + flow.spendingEur, 0) / previous.length;
  const differenceEur = currentEur - averageEur;
  const differencePct = averageEur > 0 ? differenceEur / averageEur : 0;
  const usual = `${formatEurWhole(averageEur)} average of your previous ${previous.length} ${previous.length === 1 ? "month" : "months"}`;
  let text: string;
  if (averageEur <= 0) {
    text = `${formatEurWhole(currentEur)} spent this month; there is no earlier month to compare with.`;
  } else if (Math.abs(differencePct) < 0.05) {
    text = `${formatEurWhole(currentEur)} spent this month, in line with your ${usual}.`;
  } else {
    text = `${formatEurWhole(currentEur)} spent this month, ${Math.round(Math.abs(differencePct) * 100)} % ${
      differenceEur > 0 ? "above" : "below"
    } your ${usual}.`;
  }
  return { currentEur, averageEur, monthsCompared: previous.length, differenceEur, differencePct, text };
}

/** This category's month against up to 12 earlier months of the same category. */
export function categoryTrend(
  story: MonthStory,
  category: string,
  months: CategoryMonthSpend[],
  historyMonths = 12,
): Trend {
  const currentEur = months.find((month) => month.month === story.month)?.totalEur ?? 0;
  const previous = months
    .filter((month) => month.month < story.month)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-historyMonths);
  if (previous.length === 0) {
    return {
      currentEur,
      averageEur: null,
      monthsCompared: 0,
      differenceEur: null,
      differencePct: null,
      text: null,
    };
  }
  const averageEur = previous.reduce((sum, month) => sum + month.totalEur, 0) / previous.length;
  const differenceEur = currentEur - averageEur;
  const differencePct = averageEur > 0 ? differenceEur / averageEur : 0;
  const usual = `${formatEurWhole(averageEur)} average of your previous ${previous.length} ${previous.length === 1 ? "month" : "months"}`;
  let text: string;
  if (averageEur <= 0) {
    text = `${category} was ${formatEurWhole(currentEur)} this month; there is no earlier month to compare with.`;
  } else if (Math.abs(differencePct) < 0.05) {
    text = `${category} was ${formatEurWhole(currentEur)} this month, in line with your ${usual}.`;
  } else {
    text = `${category} was ${formatEurWhole(currentEur)} this month, ${Math.round(Math.abs(differencePct) * 100)} % ${
      differenceEur > 0 ? "above" : "below"
    } your ${usual}.`;
  }
  return { currentEur, averageEur, monthsCompared: previous.length, differenceEur, differencePct, text };
}

/* ------------------------------------------------------- income band */

export interface IncomeBand {
  /** Nearest public quintile; its figures are used, but the name is not shown to the user. */
  quintile: ReturnType<typeof incomeQuintile>;
  /** Yearly deposits used to pick the nearest group. */
  annualIncomeEur: number | null;
}

/** The comparison group closest to the customer's own last 12 months of deposits. */
export function incomeBand(story: MonthStory, flows: MonthlyFlow[]): IncomeBand {
  const months = flows
    .filter((flow) => flow.month <= story.month)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
  const total = months.reduce((sum, flow) => sum + flow.incomeEur, 0);
  const annualIncomeEur = months.length > 0 ? total : null;
  return { quintile: incomeQuintile(annualIncomeEur ?? 0), annualIncomeEur };
}

/** Category the benchmark panel talks about: the selected one, or the largest everyday category. */
function benchmarkCategory(story: MonthStory, target: string): string | null {
  const categories = story.slices.find((slice) => slice.name === "Everyday")?.categories ?? [];
  if (categories.some((category) => category.name === target)) return target;
  return categories[0]?.name ?? null;
}

/**
 * One category against the public statistics for the closest income band, over the trailing
 * 12 months. A single month is a bad denominator: a sparse month makes one repeated lunch look like
 * most of the customer's spending.
 */
export function benchmarkFor(
  story: MonthStory,
  target: string,
  band: IncomeBand,
  categorySpends: CategorySpend[],
): ShareComparison | null {
  const category = benchmarkCategory(story, target);
  if (!category) return null;
  // Only the card-spending categories the benchmark covers: housing and utilities are not in it.
  const inBasket = categorySpends.filter((row) => hasBenchmark(row.category));
  const totalEur = inBasket.reduce((sum, row) => sum + row.totalEur, 0);
  const categoryEur = inBasket.find((row) => row.category === category)?.totalEur ?? 0;
  return compareShare(category, categoryEur, totalEur, band.quintile);
}

/** Date range for the 12 months ending at `month` (first day of month − 11 through the month's end). */
function trailingTwelveMonths(month: string): { startDate: string; endDate: string } {
  const [year, index] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, index - 12, 1));
  const startMonth = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { startDate: `${startMonth}-01`, endDate: monthRange(month).endDate! };
}

/* --------------------------------------------------------------- text */

function overviewFallback(
  monthTitle: string,
  story: MonthStory,
  places: PlaceHabit[],
  largest: LargePurchase[],
): SegmentAdvice {
  const fixed = amountOf(story, "Fixed");
  const everyday = amountOf(story, "Everyday");
  const left = amountOf(story, "Left");
  const biggest = story.slices.find((slice) => slice.name === "Everyday")?.categories?.[0];
  const habit = habitLine(places);
  const habitText = habit ? ` The clearest habit: ${habit}.` : "";
  const spike = largest[0] && largest[0].amountEur >= 100 ? largest[0] : null;
  // A large one-off outranks a small repeated place, matching the prompt's priority.
  const bigSpike = spike !== null && spike.amountEur >= 200;
  const spikeText = spike
    ? ` The largest single payment was ${formatEur(spike.amountEur)} at ${spike.name} on ${spike.date}.`
    : "";
  const summary = `In ${monthTitle} you earned ${formatEur(story.incomeEur)}, paid ${formatEur(fixed)} in fixed bills and spent ${formatEur(everyday)} on everyday things. ${
    left >= 0 ? `${formatEur(left)} was left.` : `You spent ${formatEur(-left)} more than you earned.`
  }${bigSpike ? spikeText + habitText : habitText + spikeText}`;
  const top = places[0];
  const recommendation = bigSpike
    ? `Check the ${formatEur(spike.amountEur)} payment at ${spike.name} on ${spike.date}: if it was not planned, start there.`
    : habit && top
      ? `Cut this habit first: one visit to ${top.name} less each week saves about ${formatEur((top.totalEur / top.visits) * 4)} a month.`
      : spike
        ? `Check the ${formatEur(spike.amountEur)} payment at ${spike.name} on ${spike.date}: if it was not planned, start there.`
        : left < 0
          ? biggest
            ? `Start with ${biggest.name}, your largest everyday category at ${formatEur(biggest.valueEur)}.`
            : "Next month, keep bills plus everyday spending under your income."
          : "On payday, move a set part of what is left into savings.";
  return { summary, recommendation };
}

/** Compact trend context; the full sentence is displayed below the summary and must not be repeated. */
function trendFact(trend: Trend): string {
  if (trend.averageEur === null || trend.differencePct === null) return "no earlier month to compare";
  if (Math.abs(trend.differencePct) < 0.05) return "about the same as the usual month";
  return `${Math.round(Math.abs(trend.differencePct) * 100)} % ${trend.differencePct > 0 ? "above" : "below"} the usual month`;
}

function categoryBrief(monthTitle: string, story: MonthStory, facts: Facts): string {
  const category = facts.category!;
  const everyday = story.slices.find((slice) => slice.name === "Everyday");
  const row = everyday?.categories?.find((item) => item.name === category);
  const total = amountOf(story, "Everyday");
  const share = total > 0 && row ? Math.round((row.valueEur / total) * 100) : 0;
  return [
    `Month: ${monthTitle}`,
    `Selected category: ${category}. This month ${formatEur(row?.valueEur ?? 0)} in ${row?.count ?? 0} payments, ${share} % of everyday spending.`,
    `Category vs its usual month: ${trendFact(facts.trend)}.`,
    facts.places.length > 0
      ? `Frequent places in this category: ${facts.places.map((place) => `${place.name} ${place.visits} visits ${formatEur(place.totalEur)}`).join("; ")}`
      : "",
    facts.largest.length > 0
      ? `Largest payments in this category: ${facts.largest.map((item) => `${item.date} ${item.name} ${formatEur(item.amountEur)}`).join("; ")}`
      : "",
    facts.comparison ? `Comparison with people on a similar income, last 12 months: ${facts.comparison.note}` : "",
    `Task: write only about ${category}. Do not mention other categories or the whole month.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function brief(
  monthTitle: string,
  story: MonthStory,
  target: string,
  facts: Facts,
): string {
  if (facts.category) return categoryBrief(monthTitle, story, facts);
  const everyday = story.slices.find((slice) => slice.name === "Everyday");
  const habit = habitLine(facts.places);
  const [biggest, second] = facts.largest;
  const standout =
    biggest && biggest.amountEur >= 200 && biggest.amountEur >= (second?.amountEur ?? 0) * 2
      ? `Standout: ${biggest.name} ${formatEur(biggest.amountEur)} on ${biggest.date}, far above every other payment this month.`
      : "";
  return [
    `Month: ${monthTitle}`,
    `Balance: ${formatEur(story.balanceEur)} on ${story.asOf}`,
    `Income (salary): ${formatEur(story.incomeEur)}`,
    ...story.slices.map((slice) => `${slice.name}: ${formatEur(slice.valueEur)}. ${slice.detail}`),
    `Everyday categories: ${(everyday?.categories ?? []).map((c) => `${c.name} ${formatEur(c.valueEur)} (${c.count})`).join(", ")}`,
    facts.places.length > 0
      ? `Most frequent places: ${facts.places.map((place) => `${place.name} ${place.visits} visits ${formatEur(place.totalEur)}`).join("; ")}`
      : "",
    facts.largest.length > 0
      ? `Largest payments: ${facts.largest.map((item) => `${item.date} ${item.name} (${item.category}) ${formatEur(item.amountEur)}`).join("; ")}`
      : "",
    standout,
    habit ? `Repeating habit: ${habit}.` : "",
    `Month vs the customer's usual spending: ${trendFact(facts.trend)}.`,
    facts.band.annualIncomeEur !== null
      ? `Comparison group: people with a similar income (the customer's deposits are about ${formatEurWhole(facts.band.annualIncomeEur)} a year). Public statistics, never other customers.`
      : "",
    facts.comparison ? `Comparison with people on a similar income, last 12 months: ${facts.comparison.note}` : "",
    target === OVERVIEW
      ? "Task: give a short overview of this whole month."
      : `Selected slice: ${target}, amount ${formatEur(amountOf(story, target))}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

interface Facts {
  places: PlaceHabit[];
  largest: LargePurchase[];
  trend: Trend;
  band: IncomeBand;
  comparison: ShareComparison | null;
  /** Set when the user selected one Everyday category; all facts are then scoped to it. */
  category: string | null;
}

/** The selected Everyday category, or null for the month overview and the non-category slices. */
function selectedCategory(story: MonthStory, target: string): string | null {
  const categories = story.slices.find((slice) => slice.name === "Everyday")?.categories ?? [];
  return categories.some((category) => category.name === target) ? target : null;
}

function factsFor(
  story: MonthStory,
  target: string,
  places: PlaceHabit[],
  largest: LargePurchase[],
  flows: MonthlyFlow[],
  categorySpends: CategorySpend[],
  categoryMonths: CategoryMonthSpend[],
): Facts {
  const category = selectedCategory(story, target);
  const trend = category ? categoryTrend(story, category, categoryMonths) : monthTrend(story, flows);
  const band = incomeBand(story, flows);
  // Wait for the history before showing a band; otherwise the first paint would say "all households".
  const comparison =
    flows.length > 0 && categorySpends.length > 0 ? benchmarkFor(story, target, band, categorySpends) : null;
  return {
    places: category ? places.filter((place) => place.category === category) : places,
    largest: category ? largest.filter((item) => item.category === category) : largest,
    trend,
    band,
    comparison,
    category,
  };
}

function builtIn(monthTitle: string, story: MonthStory, target: string, facts: Facts): Advice {
  const base =
    target === OVERVIEW
      ? overviewFallback(monthTitle, story, facts.places, facts.largest)
      : fallbackAdvice(monthTitle, target, amountOf(story, target));
  return {
    ...base,
    fromAi: false,
    loading: true,
    trend: facts.trend.text,
    benchmark: facts.comparison?.note ?? null,
  };
}

/**
 * Advice text for the month overview (target = OVERVIEW) or a selected slice/category.
 *
 * Order of preference: a cached overview for this customer/month/segment → the model via
 * `/api/segment-advice` → the data-driven built-in text. `loading` is true while the model works, so the card
 * can show a loading bar instead of the fallback copy. Only this customer's own numbers and places are sent,
 * plus public statistics for the closest income band.
 */
export function useAdvice(customerId: string, monthTitle: string, story: MonthStory, target: string): Advice {
  const cacheScope = { customerId, monthKey: story.month, segment: target };
  const category = selectedCategory(story, target);
  const [advice, setAdvice] = useState<Advice>(() => {
    const base = builtIn(monthTitle, story, target, factsFor(story, target, [], [], [], [], []));
    const cached = cachedAdvice(cacheScope);
    return cached ? { ...base, ...cached, fromAi: true, loading: false } : base;
  });

  useEffect(() => {
    setAdvice(builtIn(monthTitle, story, target, factsFor(story, target, [], [], [], [], [])));
    let active = true;
    const run = async () => {
      const range = monthRange(story.month);
      const [places, largest, flows, categorySpends, categoryMonths] = await Promise.all([
        getFrequentPlaces(customerId, { ...range, limit: 4 }).catch(() => [] as PlaceHabit[]),
        getLargestPurchases(customerId, { ...range, limit: 4, minEur: 40 }).catch(() => [] as LargePurchase[]),
        getMonthlyFlow(customerId).catch(() => [] as MonthlyFlow[]),
        getSpendingByCategory(customerId, trailingTwelveMonths(story.month)).catch(() => [] as CategorySpend[]),
        category
          ? getCategoryMonthlySpending(customerId, category).catch(() => [] as CategoryMonthSpend[])
          : Promise.resolve([] as CategoryMonthSpend[]),
      ]);
      if (!active) return;
      const facts = factsFor(story, target, places, largest, flows, categorySpends, categoryMonths);
      const request: AdviceRequest = {
        ...cacheScope,
        monthTitle,
        brief: brief(monthTitle, story, target, facts),
      };
      // The brief rides along so deep thinking can send the same facts to its agents.
      const base = { ...builtIn(monthTitle, story, target, facts), brief: request.brief };
      const cached = cachedAdviceFor(request, request.brief);
      if (cached) {
        setAdvice({ ...base, ...cached, fromAi: true, loading: false });
        return;
      }
      // No cached text for this data: show the loading bar, not the fallback copy.
      setAdvice(base);
      const next = await fetchSegmentAdvice(request).catch(() => null);
      if (!active) return;
      if (next) {
        setAdvice({ ...base, ...next, fromAi: true, loading: false });
      } else {
        // Model unavailable: keep the data-driven text, but stop saying it is still working.
        setAdvice((current) => ({ ...current, loading: false }));
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [customerId, monthTitle, target, story.month, category]);

  return advice;
}
