import { useState } from "react";
import type { MonthStory } from "../../data/database";
import { OVERVIEW, amountOf, useAdvice } from "../../data/useAdvice";
import { useDeepAnalysis } from "../../data/useDeepAnalysis";
import { DeepPanel, DeepToggle } from "./DeepThinking";
import { horizonLabel, projectScenario } from "../../data/timeMachine";
import { formatEur, formatEurWhole } from "../../format";
import { Donut } from "./Donut";
import { LegendRow } from "./LegendRow";
import { SLICE_COLORS, categoryParts, monthParts, pct, spentEur } from "./model";

type Mode = "month" | "everyday";

/**
 * Overviews (customer · month · Month/Everyday) with deep thinking turned on. It cannot be turned off again for the
 * same overview, and it stays on when the extended view is closed and reopened during this page session.
 */
const deepOverviews = new Set<string>();

/** AI tips look this far ahead when turning a monthly saving into a total. */
const PROJECTION_MONTHS = 60;

/** What a modest monthly saving from the current selection would add over the projection horizon. */
function savingsProjection(
  mode: Mode,
  selected: string | null,
  selectedPart: { name: string; valueEur: number } | null,
  story: MonthStory,
): { text: string; monthlyEur: number; savedEur: number } | null {
  let monthlyEur: number;
  let text: string;
  if (mode === "everyday" && selectedPart && selectedPart.valueEur > 0) {
    monthlyEur = selectedPart.valueEur * 0.2;
    text = `Spending 20 % less on ${selectedPart.name}`;
  } else if (mode === "month" && !selected) {
    const left = amountOf(story, "Left");
    if (left <= 0) return null;
    monthlyEur = left / 2;
    text = `Saving half of the ${formatEurWhole(left)} left this month`;
  } else {
    return null;
  }
  const savedEur = projectScenario({
    startingBalanceEur: 0,
    monthlyNetEur: 0,
    months: PROJECTION_MONTHS,
    monthlyExtraEur: monthlyEur,
  }).finalBalanceEur;
  return { text, monthlyEur, savedEur };
}

/**
 * Extended view: a large donut (month, or the categories inside Everyday) and the full list.
 * The summary is only for the whole month, or for Everyday as one basket. A single category is not analysed.
 */
export function SpendingDetail({
  customerId,
  story,
  monthTitle,
  initialSegment,
  onOpenTimeMachine,
}: {
  customerId: string;
  story: MonthStory;
  monthTitle: string;
  initialSegment: string | null;
  onOpenTimeMachine?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialSegment === "Everyday" ? "everyday" : "month");
  const [selected, setSelected] = useState<string | null>(initialSegment === "Everyday" ? null : initialSegment);
  const [seenMonth, setSeenMonth] = useState(story.month);
  if (seenMonth !== story.month) {
    setSeenMonth(story.month);
    setSelected(null);
  }

  const monthRing = monthParts(story);
  const categoryRing = categoryParts(story);
  const parts = mode === "month" ? monthRing : categoryRing;
  const ringTotal = parts.reduce((sum, part) => sum + part.valueEur, 0);
  const selectedPart = parts.find((part) => part.name === selected) ?? null;
  const target = selected ?? OVERVIEW;
  const advice = useAdvice(customerId, monthTitle, story, target);

  // Deep thinking is per overview: this customer, month and selection (whole month or one slice/category).
  const overviewKey = `${customerId}|${story.month}|${target}`;
  const [, setDeepCount] = useState(deepOverviews.size);
  const deepOn = deepOverviews.has(overviewKey);
  const turnDeepOn = () => {
    deepOverviews.add(overviewKey);
    setDeepCount(deepOverviews.size);
  };
  const deep = useDeepAnalysis(deepOn, target, advice.brief, overviewKey);

  /** Data-driven comparison blocks; shown with the normal and the deep answer alike. */
  const comparisons = (
    <>
      {advice.trend && (
        <>
          <p className="ai-card__label">Against your previous months</p>
          <p className="ai-card__text">{advice.trend}</p>
        </>
      )}
      {advice.benchmark && (
        <>
          <p className="ai-card__label">Against people with a similar income (last 12 months)</p>
          <p className="ai-card__text">{advice.benchmark}</p>
        </>
      )}
    </>
  );

  /** The normal one-model overview. Also shown, without any notice, when deep thinking gets no answer. */
  const standardAdvice = advice.loading ? (
    <div className="ai-card__loading" role="status" aria-live="polite">
      <span className="ai-card__bar" aria-hidden="true" />
      <span className="ai-card__loading-text">Generating your overview…</span>
    </div>
  ) : (
    <>
      <p className="ai-card__text">{advice.summary}</p>
      {comparisons}
      {advice.recommendation && (
        <p className="ai-card__text ai-card__rec">
          <strong>Recommendation:</strong> {advice.recommendation}
        </p>
      )}
    </>
  );

  const projection = savingsProjection(mode, selected, selectedPart, story);

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
            {deepOn ? "Deep thinking" : advice.fromAi ? "AI overview" : advice.loading ? "AI analysing" : "Overview"}
          </span>
          <span className="ai-card__head-end">
            {!deepOn && !advice.fromAi && !advice.loading && (
              <span className="ai-card__tag">built-in tips · AI not connected</span>
            )}
            <DeepToggle on={deepOn} onTurnOn={turnDeepOn} />
          </span>
        </div>
        <p className="ai-card__title">{selected ? `${selected} · ${formatEur(amountOf(story, selected))}` : monthTitle}</p>
        {deepOn ? <DeepPanel state={deep} fallback={standardAdvice} comparisons={comparisons} /> : standardAdvice}
        {projection && (
          <div className="ai-card__projection">
            <p className="ai-card__text">
              {projection.text} (~{formatEurWhole(projection.monthlyEur)}/month) would add{" "}
              <strong>{formatEurWhole(projection.savedEur)}</strong> over {horizonLabel(PROJECTION_MONTHS)}.
            </p>
            {onOpenTimeMachine && (
              <button className="ai-card__back" type="button" onClick={onOpenTimeMachine}>
                Project it over time →
              </button>
            )}
          </div>
        )}
        {selected && mode === "month" && (
          <button className="ai-card__back" type="button" onClick={() => setSelected(null)}>
            Back to the month overview
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
