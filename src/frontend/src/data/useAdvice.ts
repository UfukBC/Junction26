import { useEffect, useState } from "react";
import {
  OVERVIEW,
  amountOf,
  brief,
  factsFor,
  overviewFallback,
  selectedCategory,
  trailingTwelveMonths,
  type Facts,
} from "./adviceBrief";
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
  cachedAdviceFor,
  fallbackAdvice,
  fetchSegmentAdvice,
  type AdviceRequest,
  type SegmentAdvice,
} from "./segmentAdvice";

export {
  OVERVIEW,
  amountOf,
  benchmarkFor,
  categoryTrend,
  monthTrend,
  type Facts,
  type IncomeBand,
  type Trend,
} from "./adviceBrief";

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

/** A precached answer still shows the loading bar briefly, so the demo feels like the AI is working. */
const CACHED_LOADING_MS = 1500;

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
 * Order of preference: a cached/precached answer for this customer/month/segment → the model via
 * `/api/segment-advice` → the data-driven built-in text. `loading` is true while the model works, so the card
 * can show a loading bar instead of the fallback copy. Only this customer's own numbers and places are sent,
 * plus public statistics for the closest income band.
 */
export function useAdvice(customerId: string, monthTitle: string, story: MonthStory, target: string): Advice {
  const cacheScope = { customerId, monthKey: story.month, segment: target };
  const category = selectedCategory(story, target);
  const [advice, setAdvice] = useState<Advice>(() =>
    builtIn(monthTitle, story, target, factsFor(story, target, [], [], [], [], [])),
  );

  useEffect(() => {
    setAdvice(builtIn(monthTitle, story, target, factsFor(story, target, [], [], [], [], [])));
    let active = true;
    let cachedTimer: ReturnType<typeof setTimeout> | undefined;
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
        // Show the loading bar for a moment even though the answer is already on disk.
        cachedTimer = setTimeout(() => {
          if (active) setAdvice({ ...base, ...cached, fromAi: true, loading: false });
        }, CACHED_LOADING_MS);
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
      if (cachedTimer) clearTimeout(cachedTimer);
    };
  }, [customerId, monthTitle, target, story.month, category]);

  return advice;
}
