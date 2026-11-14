import type { MonthStory } from "../../data/database";
import { formatEur } from "../../format";
import { Donut } from "./Donut";
import { LegendRow } from "./LegendRow";
import { SLICE_COLORS, monthParts, spentEur } from "./model";

/**
 * Compact Home card: the month as a donut beside its four totals. Tapping the ring or a row opens the
 * extended view (`onOpen`, with the tapped row's name when there is one).
 */
export function SpendingCard({
  story,
  onOpen,
  stacked = false,
}: {
  story: MonthStory;
  onOpen: (segment: string | null) => void;
  /** Ring above the rows (for tall phones) instead of beside them. */
  stacked?: boolean;
}) {
  const parts = monthParts(story);
  return (
    <div className="spend__card">
      <div className={`spend__split${stacked ? " spend__split--stacked" : ""}`}>
        <button className="spend__ring" type="button" aria-label="Open spending analysis" onClick={() => onOpen(null)}>
          <Donut parts={parts} size={stacked ? 176 : 146} selected={null} centerValue={formatEur(spentEur(story))} centerLabel="spent" />
        </button>
        <ul className="rows rows--compact">
          <LegendRow variant="compact" name="Income" detail={story.incomeDetail} valueEur={story.incomeEur} ring onClick={() => onOpen("Income")} />
          {story.slices.map((slice) => (
            <LegendRow
              key={slice.name}
              variant="compact"
              name={slice.name}
              detail={slice.detail}
              valueEur={slice.valueEur}
              color={SLICE_COLORS[slice.name]}
              onClick={() => onOpen(slice.name)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
