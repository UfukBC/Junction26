import { useId } from "react";
import type { Projection, ScenarioSet } from "../data/timeMachine";
import { horizonLabel } from "../data/timeMachine";

const W = 340;
const H = 118;
const PAD = { top: 12, right: 12, bottom: 20, left: 12 };

/** On the green card: the plan is white, today's habits a dashed translucent line, a loss a soft red. */
const PLAN = "#ffffff";
const HABITS = "rgba(255, 255, 255, 0.55)";
const LOSS = "#ffc9c2";

/** A tick step from 1, 2, 2.5 or 5 × 10ⁿ, aiming for about `target` intervals across the span. */
function niceStep(span: number, target = 3): number {
  const raw = Math.max(1, span / target);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

function formatTick(value: number, step: number): string {
  if (Math.max(Math.abs(value), step) < 2000) return `${Math.round(value)} €`;
  const decimals = step >= 1000 ? 0 : 1;
  return `${(value / 1000).toFixed(decimals).replace(".", ",")} t€`;
}

/**
 * Projected balance on the Time machine hero card: the plan (with the chosen change) against today's habits.
 * Pure SVG, scales to any phone width. The y-axis fits the projected values (not zero), so small changes show.
 */
export function TimeMachineChart({ scenarios, months }: { scenarios: ScenarioSet; months: number }) {
  const gradientId = useId();
  const plan = scenarios.save;
  const habits = scenarios.continue;
  const all = [...plan.points, ...habits.points].map((point) => point.balanceEur);
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const span = rawMax - rawMin;
  const pad = span > 0 ? span * 0.14 : Math.max(1, Math.abs(rawMax) * 0.05);
  const minY = rawMin - pad;
  const maxY = rawMax + pad;
  const step = niceStep(maxY - minY);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const bottom = PAD.top + plotH;
  const x = (month: number) => PAD.left + (months > 0 ? (month / months) * plotW : 0);
  const y = (value: number) => PAD.top + (1 - (value - minY) / (maxY - minY || 1)) * plotH;

  const line = (projection: Projection) =>
    projection.points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.month).toFixed(1)} ${y(point.balanceEur).toFixed(1)}`)
      .join(" ");
  const planLine = line(plan);
  const start = plan.points[0];
  const lastPlan = plan.points[plan.points.length - 1];
  const lastHabits = habits.points[habits.points.length - 1];
  const area = `${planLine} L${x(lastPlan.month).toFixed(1)} ${bottom} L${x(0).toFixed(1)} ${bottom} Z`;

  const ticks: number[] = [];
  for (let value = Math.ceil(minY / step) * step; value <= maxY; value += step) ticks.push(value);

  const losing = plan.finalBalanceEur < habits.finalBalanceEur;
  const planColor = losing ? LOSS : PLAN;

  return (
    <svg
      className="tm-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Projected balance over ${horizonLabel(months)}: with your change versus today's habits`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={planColor} stopOpacity="0.32" />
          <stop offset="100%" stopColor={planColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="tm-chart__grid" />
          {/* Labels sit at the left edge; skip one that would sit on the starting dot. */}
          {Math.abs(y(tick) - 4 - y(start.balanceEur)) > 12 && (
            <text x={PAD.left} y={y(tick) - 4} className="tm-chart__tick">
              {formatTick(tick, step)}
            </text>
          )}
        </g>
      ))}
      {/* Only when the balance actually goes below zero. */}
      {rawMin < 0 && rawMax > 0 && (
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="tm-chart__zero" />
      )}

      <path className="tm-chart__area" d={area} fill={`url(#${gradientId})`} />
      <path className="tm-chart__line" d={line(habits)} stroke={HABITS} strokeWidth={1.8} strokeDasharray="4 4" />
      <path className="tm-chart__line" d={planLine} stroke={planColor} strokeWidth={2.8} />

      <circle cx={x(0)} cy={y(start.balanceEur)} r={3} fill="#fff" className="tm-chart__start" />
      <circle cx={x(lastHabits.month)} cy={y(lastHabits.balanceEur)} r={3} fill={HABITS} />
      <circle cx={x(lastPlan.month)} cy={y(lastPlan.balanceEur)} r={8} fill={planColor} opacity={0.22} />
      <circle cx={x(lastPlan.month)} cy={y(lastPlan.balanceEur)} r={4.2} fill={planColor} />

      <text x={PAD.left} y={H - 4} className="tm-chart__axis">
        Today
      </text>
      <text x={W - PAD.right} y={H - 4} textAnchor="end" className="tm-chart__axis">
        {horizonLabel(months)}
      </text>
    </svg>
  );
}
