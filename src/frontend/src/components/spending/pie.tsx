import type { CategorySpend } from "../../data/database";
import { formatEur } from "../../format";

/*
 * Shared spending pie (home card + analysis screen).
 * Colours: the 5 largest categories take categorical slots 1-5 in order, the rest fold into a grey "Other".
 * Validated with the dataviz palette checker on white, including the wrap-around pair: every adjacent pair
 * clears CVD ΔE >= 9 and normal-vision ΔE >= 17. Aqua and yellow are below 3:1 contrast, so every view
 * that shows the pie also prints each slice's name and amount as text (colour is never the only cue).
 * Colours follow rank, not category: 10 categories don't fit 5 distinguishable colours.
 */
export const SLICE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#6250d6"];
export const OTHER_COLOR = "#898781";
export const OTHER_KEY = "__other";

export interface Slice {
  key: string;
  label: string;
  totalEur: number;
  share: number;
  color: string;
  /** Categories folded into "Other". */
  members?: CategorySpend[];
}

export function toSlices(categories: CategorySpend[]): Slice[] {
  const named: Slice[] = categories.slice(0, SLICE_COLORS.length).map((c, i) => ({
    key: c.category,
    label: c.category,
    totalEur: c.totalEur,
    share: c.share,
    color: SLICE_COLORS[i],
  }));
  const rest = categories.slice(SLICE_COLORS.length);
  if (rest.length === 0) return named;
  return [
    ...named,
    {
      key: OTHER_KEY,
      label: "Other",
      totalEur: rest.reduce((s, c) => s + c.totalEur, 0),
      share: rest.reduce((s, c) => s + c.share, 0),
      color: OTHER_COLOR,
      members: rest,
    },
  ];
}

export const pct = (share: number) => `${Math.round(share * 100)} %`;

const VIEW = 200;
const C = VIEW / 2;
const R_OUTER = 92;
const R_INNER = 58;

function point(r: number, angle: number) {
  return [C + r * Math.sin(angle), C - r * Math.cos(angle)];
}

/** Donut segment from angle a0 to a1 (radians, clockwise from 12 o'clock). */
function segmentPath(a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = point(R_OUTER, a0);
  const [x1, y1] = point(R_OUTER, a1);
  const [x2, y2] = point(R_INNER, a1);
  const [x3, y3] = point(R_INNER, a0);
  return `M${x0} ${y0} A${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${R_INNER} ${R_INNER} 0 ${large} 0 ${x3} ${y3}Z`;
}

export function SpendingPie({
  slices,
  size,
  selected = null,
  onSelect,
  center,
}: {
  slices: Slice[];
  size: number;
  selected?: string | null;
  onSelect?: (key: string) => void;
  /** Two lines in the hole; omit on small pies. */
  center?: { value: string; label: string };
}) {
  let angle = 0;
  return (
    <svg
      className={`pie${onSelect ? " pie--interactive" : ""}`}
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-label="Spending by category"
    >
      {slices.map((s) => {
        const a0 = angle;
        angle += s.share * 2 * Math.PI;
        const className = `pie__slice${selected !== null && selected !== s.key ? " pie__slice--dim" : ""}`;
        const onClick = onSelect ? () => onSelect(s.key) : undefined;
        const title = <title>{`${s.label}: ${formatEur(s.totalEur)} (${pct(s.share)})`}</title>;
        return s.share >= 0.9999 ? (
          <circle key={s.key} className={`${className} pie__ring`} cx={C} cy={C} r={(R_OUTER + R_INNER) / 2}
            fill="none" stroke={s.color} strokeWidth={R_OUTER - R_INNER} onClick={onClick}>
            {title}
          </circle>
        ) : (
          <path key={s.key} className={className} d={segmentPath(a0, angle)} fill={s.color} onClick={onClick}>
            {title}
          </path>
        );
      })}
      {center && (
        <>
          <text x={C} y={C - 6} textAnchor="middle" className="pie__value">{center.value}</text>
          <text x={C} y={C + 16} textAnchor="middle" className="pie__label">{center.label}</text>
        </>
      )}
    </svg>
  );
}
