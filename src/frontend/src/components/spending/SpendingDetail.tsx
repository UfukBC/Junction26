import { useState } from "react";
import type { MonthStory } from "../../data/database";
import { OVERVIEW, amountOf, useAdvice } from "../../data/useAdvice";
import { formatEur } from "../../format";
import { Donut } from "./Donut";
import { LegendRow } from "./LegendRow";
import { SLICE_COLORS, categoryParts, monthParts, pct, spentEur } from "./model";

type Mode = "month" | "everyday";

/**
 * Extended view: a large donut (month, or the categories inside Everyday), an AI overview card that follows the
 * selection, and the full list. Tapping a segment or a row selects it; tapping again returns to the month overview.
 */
export function SpendingDetail({
  story,
  monthTitle,
  initialSegment,
}: {
  story: MonthStory;
  monthTitle: string;
  initialSegment: string | null;
}) {
  const [mode, setMode] = useState<Mode>("month");
  const [selected, setSelected] = useState<string | null>(initialSegment);
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
  const advice = useAdvice(monthTitle, story, target);

  const toggle = (name: string) => setSelected((current) => (current === name ? null : name));
  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setSelected(null);
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

      <section className="ai-card" key={target} aria-label="AI overview">
        <div className="ai-card__head">
          <span className="ai-card__kicker">{advice.fromAi ? "AI overview" : "Overview"}</span>
          {!advice.fromAi && <span className="ai-card__tag">built-in tips · AI not connected</span>}
        </div>
        <p className="ai-card__title">{selected ? `${selected} · ${formatEur(amountOf(story, selected))}` : monthTitle}</p>
        <p className="ai-card__text">{advice.summary}</p>
        <p className="ai-card__text ai-card__rec"><strong>Recommendation:</strong> {advice.recommendation}</p>
        {selected && (
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
