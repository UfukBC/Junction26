import { useState } from "react";
import { Analysing } from "../Analysing";
import type { MonthStory } from "../../data/database";
import { ADVISOR_NAME } from "../../data/advisor";
import {
  BENCHMARK_SOURCE,
  bandLabel,
  baselineComparison,
} from "../../data/benchmarkComparison";
import { usePeerBenchmark } from "../../data/usePeerBenchmark";
import { OVERVIEW, amountOf, useAdvice } from "../../data/useAdvice";
import { formatEur, formatEurWhole } from "../../format";
import { Donut } from "./Donut";
import { LegendRow } from "./LegendRow";
import { SLICE_COLORS, categoryParts, monthParts, pct, spentEur } from "./model";

type Mode = "month" | "everyday";

/**
 * Extended view: a large donut (month, or the categories inside Everyday) and the full list.
 * The summary is only for the whole month, or for Everyday as one basket. A single category is not analysed.
 */
export function SpendingDetail({
  customerId,
  story,
  monthTitle,
  initialSegment,
}: {
  customerId: string;
  story: MonthStory;
  monthTitle: string;
  initialSegment: string | null;
}) {
  const [mode, setMode] = useState<Mode>(initialSegment === "Everyday" ? "everyday" : "month");
  const [selected, setSelected] = useState<string | null>(initialSegment === "Everyday" ? null : initialSegment);
  const [seenMonth, setSeenMonth] = useState(story.month);
  if (seenMonth !== story.month) {
    setSeenMonth(story.month);
    setSelected(null);
  }

  const baseline = usePeerBenchmark(customerId);
  const monthRing = monthParts(story);
  const categoryRing = categoryParts(story);
  const parts = mode === "month" ? monthRing : categoryRing;
  const ringTotal = parts.reduce((sum, part) => sum + part.valueEur, 0);
  const selectedPart = parts.find((part) => part.name === selected) ?? null;
  const advice = useAdvice(customerId, monthTitle, story, mode === "everyday" ? "Everyday" : OVERVIEW, baseline);

  const categoryComparison =
    selectedPart && mode === "everyday" && baseline
      ? baselineComparison(baseline, selectedPart.name)
      : null;

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setSelected(null);
  };
  const toggle = (name: string) => {
    if (name === "Everyday") {
      switchMode("everyday");
      return;
    }
    setSelected((current) => (current === name ? null : name));
  };

  const centerValue = selectedPart
    ? formatEur(selectedPart.valueEur)
    : selected === "Income"
      ? formatEur(story.incomeEur)
      : mode === "month"
        ? formatEur(spentEur(story))
        : formatEur(amountOf(story, "Everyday"));
  const centerLabel = selectedPart
    ? `${selectedPart.name} · ${pct(selectedPart.valueEur, ringTotal)}`
    : selected === "Income"
      ? "Income"
      : mode === "month"
        ? "spent this month"
        : "everyday spending";

  return (
    <div className="detail">
      <div className="seg" role="group" aria-label="What to show">
        <button type="button" aria-pressed={mode === "month"} onClick={() => switchMode("month")}>
          Month
        </button>
        <button type="button" aria-pressed={mode === "everyday"} disabled={categoryRing.length === 0} onClick={() => switchMode("everyday")}>
          Everyday
        </button>
      </div>

      <div className="detail__ring">
        <Donut
          key={mode}
          parts={parts}
          size={188}
          selected={selectedPart ? selectedPart.name : null}
          onSelect={toggle}
          centerValue={centerValue}
          centerLabel={centerLabel}
        />
      </div>

      <section className="ai-card" key={selected ?? mode} aria-label="AI overview">
        <div className="ai-card__head">
          <span className="ai-card__kicker">
            {categoryComparison
              ? "Statistics Finland Benchmark"
              : advice.loading
                ? "AI analysing"
                : ADVISOR_NAME}
          </span>
          {categoryComparison && baseline && (
            <span className="ai-card__tag">{bandLabel(baseline.quintile)}</span>
          )}
        </div>
        <p className="ai-card__title">
          {categoryComparison
            ? `${selectedPart!.name} · ${formatEur(selectedPart!.valueEur)}`
            : mode === "everyday"
              ? `Everyday · ${formatEur(amountOf(story, "Everyday"))}`
              : monthTitle}
        </p>
        {categoryComparison && baseline ? (
          <div className="benchmark-detail">
            <p className="ai-card__label">Peer Average ({bandLabel(baseline.quintile)})</p>
            <p className="ai-card__text">
              Finnish households in your band average{" "}
              <strong>{formatEurWhole(categoryComparison.benchmarkMonthEur)}/month</strong> on {categoryComparison.category.toLowerCase()}.
            </p>
            <p className="ai-card__label">Your 12-Month Average</p>
            <p className="ai-card__text">
              You averaged <strong>{formatEurWhole(categoryComparison.userMonthlyEur)}/month</strong>
              <span className={categoryComparison.diffEur > 0 ? " benchmark--above" : " benchmark--below"}>
                {" "}— {categoryComparison.diffEur >= 0 ? "+" : ""}{formatEurWhole(categoryComparison.diffEur)} vs peer average
              </span>
              . This month: {formatEur(selectedPart!.valueEur)}.
            </p>
            <p className="benchmark__source">{BENCHMARK_SOURCE}</p>
          </div>
        ) : advice.loading ? (
          <Analysing showText={false} />
        ) : (
          <>
            <p className="ai-card__label">Summary</p>
            <p className="ai-card__text">{advice.summary}</p>
            {advice.recommendation && (
              <>
                <p className="ai-card__label">Recommendation</p>
                <p className="ai-card__text ai-card__rec">{advice.recommendation}</p>
              </>
            )}
          </>
        )}
        {selected && (
          <button className="ai-card__back" type="button" onClick={() => setSelected(null)}>
            {mode === "everyday" ? "Back to Everyday overview" : "Back to the month overview"}
          </button>
        )}
      </section>

      <ul className="rows rows--grid">
        {mode === "month" ? (
          <>
            <LegendRow
              variant="chip"
              name="Income"
              detail={story.incomeDetail}
              valueEur={story.incomeEur}
              ring
              active={selected === "Income"}
              dim={selected !== null && selected !== "Income"}
              onClick={() => toggle("Income")}
            />
            {story.slices.map((slice) => (
              <LegendRow
                variant="chip"
                key={slice.name}
                name={slice.name}
                detail={slice.name === "Everyday" ? "Everyday purchases" : slice.detail}
                valueEur={slice.valueEur}
                color={SLICE_COLORS[slice.name]}
                share={slice.valueEur > 0.5 ? pct(slice.valueEur, monthRing.reduce((s, p) => s + p.valueEur, 0)) : undefined}
                active={selected === slice.name}
                dim={selected !== null && selected !== slice.name}
                onClick={() => toggle(slice.name)}
              />
            ))}
          </>
        ) : (
          categoryRing.map((part) => (
            <LegendRow
              variant="chip"
              key={part.name}
              name={part.name}
              detail={part.detail}
              valueEur={part.valueEur}
              color={part.color}
              share={pct(part.valueEur, ringTotal)}
              active={selected === part.name}
              dim={selected !== null && selected !== part.name}
              onClick={() => toggle(part.name)}
            />
          ))
        )}
      </ul>
    </div>
  );
}
