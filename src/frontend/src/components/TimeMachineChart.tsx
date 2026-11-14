import type { Projection, ScenarioSet } from "../data/timeMachine";
import { horizonLabel } from "../data/timeMachine";

const W = 340;
const H = 210;
const PAD = { top: 16, right: 16, bottom: 26, left: 56 };

const SERIES: { key: keyof ScenarioSet; color: string; dash?: string }[] = [
  { key: "continue", color: "#8e948f", dash: "5 4" },
  { key: "save", color: "#017842" },
];

/** A projection that ends below zero is shown in red. */
const NEGATIVE_COLOR = "#c0372f";

/** A tick step from 1, 2, 2.5 or 5 × 10ⁿ, aiming for about five intervals across the span. */
function niceStep(span: number, target = 5): number {
  const raw = Math.max(1, span / target);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

function formatTick(value: number, step: number, useThousands: boolean): string {
  if (!useThousands) return `${Math.round(value)} €`;
  const inThousands = Math.abs(step) / 1000;
  const decimals = inThousands >= 1 ? 0 : inThousands >= 0.1 ? 1 : inThousands >= 0.01 ? 2 : 3;
  return `${(value / 1000).toFixed(decimals).replace(".", ",")} t€`;
}

/** Line chart of the two projections. Pure SVG so it scales to any phone width. */
export function TimeMachineChart({ scenarios, months }: { scenarios: ScenarioSet; months: number }) {
  const series = SERIES.map((definition) => ({ ...definition, projection: scenarios[definition.key] }));
  const all = series.flatMap((item) => item.projection.points.map((point) => point.balanceEur));
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const rawSpan = rawMax - rawMin;
  const pad = rawSpan > 0 ? rawSpan * 0.12 : Math.max(1, Math.abs(rawMax) * 0.02);

  // Scale to the projected values themselves (not to zero), so small monthly changes stay visible.
  const minY = rawMin - pad;
  const maxY = rawMax + pad;
  const step = niceStep(maxY - minY);
  const useThousands = Math.max(Math.abs(minY), Math.abs(maxY)) >= 2000;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (month: number) => PAD.left + (months > 0 ? (month / months) * plotW : 0);
  const y = (value: number) => PAD.top + (1 - (value - minY) / (maxY - minY || 1)) * plotH;

  const linePath = (projection: Projection) =>
    projection.points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.month).toFixed(1)} ${y(point.balanceEur).toFixed(1)}`)
      .join(" ");

  const ticks: number[] = [];
  for (let value = Math.ceil(minY / step) * step; value <= maxY + step * 1e-6; value += step) {
    ticks.push(value);
  }

  const start = series[0].projection.points[0];
  const saved = scenarios.save.finalBalanceEur - scenarios.continue.finalBalanceEur;
  const endLabel = horizonLabel(months);
  const yearLines: number[] = [];
  for (let month = 12; month < months; month += 12) yearLines.push(month);
  const labelYearLines = months <= 72;

  return (
    <svg
      className="tmachine-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Projected balance over ${endLabel}, keeping today's habits versus saving more`}
    >
      {/* Year boundaries: a faint vertical line every 12 months */}
      {yearLines.map((month) => (
        <g key={month}>
          <line x1={x(month)} x2={x(month)} y1={PAD.top} y2={H - PAD.bottom} stroke="#f0f4f1" strokeWidth={1} />
          {labelYearLines && (
            <text x={x(month)} y={H - 8} textAnchor="middle" className="tmachine-chart__year">
              {month / 12} yr
            </text>
          )}
        </g>
      ))}

      {/* Horizontal grid with adaptive, non-repeating labels */}
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#eef3ef" strokeWidth={1} />
          <text x={PAD.left - 8} y={y(tick) + 3.5} textAnchor="end" className="tmachine-chart__tick">
            {formatTick(tick, step, useThousands)}
          </text>
        </g>
      ))}

      {minY < 0 && maxY > 0 && (
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#cdd5d0" strokeWidth={1} strokeDasharray="3 3" />
      )}

      {/* Where every projection starts */}
      <circle cx={x(0)} cy={y(start.balanceEur)} r={2.6} fill="#fff" stroke="#8e948f" strokeWidth={1.6} />

      {series.map((item) => {
        const last = item.projection.points[item.projection.points.length - 1];
        // The save line turns red when the change costs money (saved total is negative); the reference line
        // turns red when its own end balance is below zero.
        const negative = item.key === "save" ? saved < 0 : item.projection.finalBalanceEur < 0;
        const color = negative ? NEGATIVE_COLOR : item.color;
        return (
          <g key={item.key}>
            <path
              d={linePath(item.projection)}
              fill="none"
              stroke={color}
              strokeWidth={item.key === "continue" ? 2 : 2.8}
              strokeDasharray={item.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={x(last.month)}
              cy={y(last.balanceEur)}
              r={item.key === "continue" ? 3 : 3.8}
              fill={color}
              stroke="#fff"
              strokeWidth={1.6}
            />
          </g>
        );
      })}

      <text x={PAD.left} y={H - 8} className="tmachine-chart__axis">
        Today
      </text>
      <text x={W - PAD.right} y={H - 8} textAnchor="end" className="tmachine-chart__axis">
        {endLabel}
      </text>
    </svg>
  );
}
