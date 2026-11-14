import { useEffect, useState } from "react";
import { formatEur } from "../format";
import { placeFromMcc, type PaymentFact } from "./advisor";
import { peerFacts, peerNoteFor, type PeerBaseline } from "./benchmarkComparison";
import { getTransactions, monthRange, type MonthStory } from "./database";
import { fallbackAdvice, fetchSegmentAdvice, type SegmentAdvice } from "./segmentAdvice";
import { loadPeerBaseline } from "./usePeerBenchmark";

export const OVERVIEW = "Month overview";

export interface Advice extends SegmentAdvice {
  /** true when the text came from the AI service, false for the built-in fallback. */
  fromAi: boolean;
  loading: boolean;
}

/** Amount of a ring segment, an Everyday category, or the income, for the selected name. */
export function amountOf(story: MonthStory, name: string): number {
  if (name === "Income") return story.incomeEur;
  const slice = story.slices.find((item) => item.name === name);
  if (slice) return slice.valueEur;
  const everyday = story.slices.find((item) => item.name === "Everyday");
  return everyday?.categories?.find((item) => item.name === name)?.valueEur ?? 0;
}

function everydayCategories(story: MonthStory) {
  const everyday = story.slices.find((slice) => slice.name === "Everyday");
  return [...(everyday?.categories ?? [])].sort((a, b) => b.valueEur - a.valueEur);
}

/** Whole month: income, bills, everyday spending and what was left. */
function overviewFallback(monthTitle: string, story: MonthStory): SegmentAdvice {
  const income = story.incomeEur;
  const fixed = amountOf(story, "Fixed");
  const everyday = amountOf(story, "Everyday");
  const left = amountOf(story, "Left");
  const share = (part: number) => (income > 0 ? Math.round((part / income) * 100) : 0);
  const biggest = everydayCategories(story)[0];
  const leftText = left < 0 ? `Short by ${formatEur(-left)}.` : `${formatEur(left)} left.`;
  const top = biggest ? ` Largest everyday category was ${biggest.name}, ${formatEur(biggest.valueEur)}.` : "";
  const summary = `${monthTitle}: income ${formatEur(income)}. Fixed bills ${formatEur(fixed)} (${share(fixed)}% of income). Everyday ${formatEur(everyday)} (${share(everyday)}%). ${leftText}${top}`;
  const recommendation =
    left < 0
      ? biggest
        ? `Keep the bills plus everyday spending under the income. ${biggest.name}, ${formatEur(biggest.valueEur)}, is the first place to look.`
        : "Keep the bills plus everyday spending under the income."
      : `On payday, move part of the ${formatEur(left)} that remained into savings. Leave the fixed bills as they are.`;
  return { summary, recommendation };
}

/** Everyday basket: which categories make it up, then the single largest payment. */
function everydaySummary(story: MonthStory, largest: PaymentFact | null, peerNote?: string): string {
  const cats = everydayCategories(story);
  const total = amountOf(story, "Everyday");
  if (cats.length === 0) return "No everyday purchases this month.";
  const top = cats[0];
  const share = total > 0 ? Math.round((top.valueEur / total) * 100) : 0;
  const second = cats[1];
  const next = second ? ` Next was ${second.name}, ${formatEur(second.valueEur)}.` : "";
  const big = largest
    ? ` Largest payment was ${formatEur(largest.amountEur)} on ${largest.date}, ${largest.place}.`
    : "";
  const peer = peerNote ? ` ${peerNote}` : "";
  return `Everyday spending was ${formatEur(total)} in ${cats.length} categories. ${top.name} was ${formatEur(top.valueEur)} (${share}%).${next}${big}${peer}`;
}

function everydayRecommendation(story: MonthStory, largest: PaymentFact | null): string {
  const top = everydayCategories(story)[0];
  if (!top) return "No everyday purchases to change this month.";
  if (largest) {
    return `Look at the ${formatEur(largest.amountEur)} ${largest.place} payment on ${largest.date}. ${top.name} is the largest everyday category.`;
  }
  return `${top.name}, ${formatEur(top.valueEur)}, is the largest part of everyday spending. Look there before the smaller categories.`;
}

async function loadPayments(customerId: string, month: string, categories: string[]): Promise<PaymentFact[]> {
  const groups = await Promise.all(
    categories.map((category) =>
      getTransactions(customerId, { ...monthRange(month), category, limit: 40, order: "asc" }),
    ),
  );
  return groups
    .flat()
    .map((tx) => ({
      date: tx.date,
      place: placeFromMcc(tx.mccCode, tx.category),
      amountEur: Math.abs(tx.amountEur),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Summary for the whole month, or for Everyday as one basket. Individual categories are not analysed.
 */
export function useAdvice(
  customerId: string,
  monthTitle: string,
  story: MonthStory,
  target: string,
  baselineProp?: PeerBaseline | null,
): Advice {
  const [advice, setAdvice] = useState<Advice>(() => builtIn(monthTitle, story, target, baselineProp));

  useEffect(() => {
    setAdvice(builtIn(monthTitle, story, target, baselineProp));
    let active = true;
    const run = async () => {
      const baseline = baselineProp ?? (await loadPeerBaseline(customerId));
      if (!active) return;

      const local = builtIn(monthTitle, story, target, baseline);
      let summary = local.summary;
      let recommendation = local.recommendation;
      let largest: PaymentFact | null = null;
      let peerNote = "";
      if (target === "Everyday") {
        const top = everydayCategories(story)[0];
        peerNote = top ? peerNoteFor(baseline, top.name) : "";
        summary = everydaySummary(story, null, peerNote);
        recommendation = everydayRecommendation(story, null);
        setAdvice({ summary, recommendation, fromAi: false, loading: false });
        const names = everydayCategories(story).map((category) => category.name);
        const payments = names.length > 0 ? await loadPayments(customerId, story.month, names) : [];
        if (!active) return;
        largest = payments.reduce<PaymentFact | null>(
          (best, row) => (best === null || row.amountEur > best.amountEur ? row : best),
          null,
        );
        summary = everydaySummary(story, largest, peerNote);
        recommendation = everydayRecommendation(story, largest);
      }
      const top = everydayCategories(story)[0]?.name ?? "";
      const lines =
        target === "Everyday"
          ? everydayCategories(story)
              .map((category) => `${category.name}: ${formatEur(category.valueEur)} (${category.count})`)
              .join("\n")
          : "";
      const benchmarkFacts =
        target === "Everyday"
          ? peerFacts(
              baseline,
              everydayCategories(story).map((c) => c.name),
            )
          : [];
      const brief = [
        target === "Everyday"
          ? "This is the Everyday basket only. Do not mention income, fixed bills, or what was left. Do not use the word income; refer to peers as 'Finnish households in the same band'."
          : "This is the whole month.",
        `Summary so far: ${summary}`,
        `Recommendation so far: ${recommendation}`,
        lines ? `Categories:\n${lines}` : "",
        largest ? `Largest payment: ${formatEur(largest.amountEur)} on ${largest.date}, ${largest.place}.` : "",
        benchmarkFacts.length > 0 ? `Peer benchmarks:\n${benchmarkFacts.join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const next = await fetchSegmentAdvice({ month: monthTitle, segment: target, brief });
      if (!active) return;
      const modelSummary = next?.summary ?? "";
      const modelRecommendation = next?.recommendation ?? "";
      const summaryOk =
        target !== "Everyday" ||
        (top !== "" &&
          modelSummary.toLowerCase().includes(top.toLowerCase()) &&
          !/\bincome\b|fixed bill|was left|short by/i.test(modelSummary));
      const recommendationOk =
        target !== "Everyday" ||
        (modelRecommendation !== "" && !/\bpayday\b|fixed bill|\bincome\b|into savings/i.test(modelRecommendation));
      setAdvice({
        summary: summaryOk && modelSummary ? modelSummary : summary,
        recommendation: recommendationOk && modelRecommendation ? modelRecommendation : recommendation,
        fromAi: Boolean(modelSummary) && summaryOk,
        loading: false,
      });
    };
    run().catch(() => {
      if (active) setAdvice((current) => ({ ...current, loading: false }));
    });
    return () => {
      active = false;
    };
  }, [customerId, monthTitle, target, story.month, baselineProp]);

  return advice;
}

function builtIn(monthTitle: string, story: MonthStory, target: string, baseline?: PeerBaseline | null): Advice {
  if (target === "Everyday") {
    const top = everydayCategories(story)[0];
    const peerNote = top ? peerNoteFor(baseline ?? null, top.name) : "";
    const summary = everydaySummary(story, null, peerNote);
    const recommendation = everydayRecommendation(story, null);
    return { summary, recommendation, fromAi: false, loading: true };
  }
  const base = target === OVERVIEW ? overviewFallback(monthTitle, story) : fallbackAdvice(monthTitle, target, amountOf(story, target));
  return { ...base, fromAi: false, loading: true };
}
