import { useEffect, useState } from "react";
import { formatEur } from "../format";
import type { MonthStory } from "./database";
import { fallbackAdvice, fetchSegmentAdvice, type SegmentAdvice } from "./segmentAdvice";

export const OVERVIEW = "Month overview";

export interface Advice extends SegmentAdvice {
  /** true when the text came from the AI service, false for the built-in fallback. */
  fromAi: boolean;
}

/** Amount of a ring segment, an Everyday category, or the income, for the selected name. */
export function amountOf(story: MonthStory, name: string): number {
  if (name === "Income") return story.incomeEur;
  const slice = story.slices.find((item) => item.name === name);
  if (slice) return slice.valueEur;
  const everyday = story.slices.find((item) => item.name === "Everyday");
  return everyday?.categories?.find((item) => item.name === name)?.valueEur ?? 0;
}

/** Built-in text for the whole month. Uses only this customer's numbers. */
function overviewFallback(monthTitle: string, story: MonthStory): SegmentAdvice {
  const fixed = amountOf(story, "Fixed");
  const everyday = amountOf(story, "Everyday");
  const left = amountOf(story, "Left");
  const biggest = story.slices.find((slice) => slice.name === "Everyday")?.categories?.[0];
  const summary = `In ${monthTitle} you earned ${formatEur(story.incomeEur)}, paid ${formatEur(fixed)} in fixed bills and spent ${formatEur(everyday)} on everyday things. ${
    left >= 0 ? `${formatEur(left)} was left.` : `You spent ${formatEur(-left)} more than you earned.`
  }`;
  const recommendation =
    left < 0
      ? biggest
        ? `Start with ${biggest.name}, your largest everyday category at ${formatEur(biggest.valueEur)}.`
        : "Next month, keep bills plus everyday spending under your income."
      : "On payday, move a set part of what is left into savings.";
  return { summary, recommendation };
}

function brief(monthTitle: string, story: MonthStory, target: string): string {
  const everyday = story.slices.find((slice) => slice.name === "Everyday");
  return [
    `Month: ${monthTitle}`,
    `Balance: ${formatEur(story.balanceEur)} on ${story.asOf}`,
    `Income (salary): ${formatEur(story.incomeEur)}`,
    ...story.slices.map((slice) => `${slice.name}: ${formatEur(slice.valueEur)}. ${slice.detail}`),
    `Everyday categories: ${(everyday?.categories ?? []).map((c) => `${c.name} ${formatEur(c.valueEur)} (${c.count})`).join(", ")}`,
    target === OVERVIEW
      ? "Task: give a short overview of this whole month."
      : `Selected slice: ${target}, amount ${formatEur(amountOf(story, target))}.`,
  ].join("\n");
}

/**
 * Advice text for the month overview (target = OVERVIEW) or a selected slice/category. Shows built-in text at once,
 * then swaps in the AI text when the dev server's /api/segment-advice answers. Only this customer's own numbers are sent.
 */
export function useAdvice(monthTitle: string, story: MonthStory, target: string): Advice {
  const [advice, setAdvice] = useState<Advice>(() => builtIn(monthTitle, story, target));

  useEffect(() => {
    setAdvice(builtIn(monthTitle, story, target));
    let active = true;
    fetchSegmentAdvice({ month: monthTitle, segment: target, brief: brief(monthTitle, story, target) })
      .then((next) => {
        if (active && next) setAdvice({ ...next, fromAi: true });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [monthTitle, target, story.month]);

  return advice;
}

function builtIn(monthTitle: string, story: MonthStory, target: string): Advice {
  const base = target === OVERVIEW ? overviewFallback(monthTitle, story) : fallbackAdvice(monthTitle, target, amountOf(story, target));
  return { ...base, fromAi: false };
}
