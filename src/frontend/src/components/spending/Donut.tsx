import { formatEur } from "../../format";
import type { Part } from "./model";

const VIEW = 200;
const C = VIEW / 2;
const R = 78;
const STROKE = 28;
const CIRC = 2 * Math.PI * R;
const GAP = 3; // visible gap between segments, in ring length units

/**
 * Donut ring. Segments are circles drawn with stroke-dasharray, so values glide between months with a CSS
 * transition, and a freshly mounted ring sweeps in segment by segment (keyframes in styles.css). Remount it
 * with a new `key` to replay the sweep (e.g. when switching between the month and the Everyday categories).
 * Selecting a segment thickens it and dims the others; the middle shows the total or the selected segment.
 */
export function Donut({
  parts,
  size,
  selected,
  onSelect,
  centerValue,
  centerLabel,
}: {
  parts: Part[];
  size: number;
  selected: string | null;
  onSelect?: (name: string) => void;
  centerValue: string;
  centerLabel: string;
}) {
  const total = parts.reduce((sum, part) => sum + part.valueEur, 0);
  let start = 0;
  return (
    <svg
      className="donut"
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-label={`Spending: ${centerValue} ${centerLabel}`}
      style={{ ["--c" as string]: CIRC }}
    >
      <circle cx={C} cy={C} r={R} fill="none" stroke="#eef3ef" strokeWidth={STROKE} />
      {total > 0 && (
        <g transform={`rotate(-90 ${C} ${C})`}>
          {parts.map((part, index) => {
            const share = part.valueEur / total;
            const offset = start * CIRC;
            start += share;
            const length = Math.max(0.01, share * CIRC - (parts.length > 1 ? GAP : 0));
            const isSelected = selected === part.name;
            const dim = selected !== null && !isSelected;
            return (
              <circle
                key={part.name}
                className={`donut__seg${onSelect ? " donut__seg--tap" : ""}`}
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke={part.color}
                strokeWidth={isSelected ? STROKE + 8 : STROKE}
                opacity={dim ? 0.3 : 1}
                style={{
                  strokeDasharray: `${length} ${CIRC}`,
                  strokeDashoffset: -offset,
                  animationDelay: `${index * 110}ms`,
                }}
                onClick={onSelect ? () => onSelect(part.name) : undefined}
              >
                <title>{`${part.name}: ${formatEur(part.valueEur)}`}</title>
              </circle>
            );
          })}
        </g>
      )}
      <text x={C} y={C - 2} textAnchor="middle" className="donut__value">
        {centerValue}
      </text>
      <text x={C} y={C + 18} textAnchor="middle" className="donut__label">
        {centerLabel}
      </text>
    </svg>
  );
}
