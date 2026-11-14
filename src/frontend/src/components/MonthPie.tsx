import { useEffect, useRef, useState } from "react";
import type { MonthSlice } from "../data/database";
import { fallbackAdvice, fetchSegmentAdvice, type SegmentAdvice } from "../data/segmentAdvice";
import { formatEur, formatEurWhole } from "../format";

const SLICE_COLOR = {
  Fixed: "#017842",
  Everyday: "#00ac49",
  Left: "#8dceb0",
} as const;

const CATEGORY_COLORS = ["#017842", "#0a8a45", "#3aaa68", "#8dceb0"];

const CATEGORY_SUBTITLE: Record<string, string> = {
  Groceries: "Food shops",
  Restaurants: "Eating out",
  Transportation: "Fuel, taxis and transit",
  Entertainment: "Going out",
  Health: "Pharmacy and care",
  "Home & Tech": "Home and electronics",
  Lifestyle: "Clothes and personal spending",
  Travel: "Trips and tickets",
};

const CX = 100;
const CY = 100;
const R = 88;

interface PiePart {
  name: string;
  valueEur: number;
  color: string;
}

interface Wedge extends PiePart {
  d: string;
  mid: number;
  sweep: number;
}

function buildWedges(parts: PiePart[]): Wedge[] {
  const drawable = parts.filter((part) => part.valueEur > 0.5);
  const total = drawable.reduce((sum, part) => sum + part.valueEur, 0);
  if (total <= 0) return [];
  let angle = -Math.PI / 2;
  return drawable.map((part) => {
    const sweep = (part.valueEur / total) * Math.PI * 2;
    const start = angle;
    const end = start + sweep;
    angle = end;
    let d: string;
    if (sweep >= Math.PI * 2 - 0.0001) {
      d = `M ${CX} ${CY - R} A ${R} ${R} 0 1 1 ${CX - 0.01} ${CY - R} Z`;
    } else {
      const x0 = CX + R * Math.cos(start);
      const y0 = CY + R * Math.sin(start);
      const x1 = CX + R * Math.cos(end);
      const y1 = CY + R * Math.sin(end);
      const large = sweep > Math.PI ? 1 : 0;
      d = `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
    }
    return { ...part, d, mid: start + sweep / 2, sweep };
  });
}

function point(angle: number, radius: number) {
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

function useAnimatedParts(parts: PiePart[]) {
  const signature = parts.map((part) => `${part.name}:${part.valueEur.toFixed(2)}:${part.color}`).join("|");
  const [shown, setShown] = useState(parts);
  const shownRef = useRef(parts);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(parts);
      return;
    }
    const order = [
      ...from.map((part) => part.name),
      ...parts.map((part) => part.name).filter((name) => !from.some((part) => part.name === name)),
    ];
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 560);
      const eased = 1 - (1 - t) ** 3;
      setShown(
        order
          .map((name) => {
            const previous = from.find((part) => part.name === name);
            const target = parts.find((part) => part.name === name);
            const fromValue = previous?.valueEur ?? 0;
            const toValue = target?.valueEur ?? 0;
            return {
              name,
              valueEur: fromValue + (toValue - fromValue) * eased,
              color: target?.color ?? previous?.color ?? "#017842",
            };
          })
          .filter((part) => part.valueEur > 0.4),
      );
      if (t < 1) frame = requestAnimationFrame(tick);
      else setShown(parts);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [signature]);

  return shown;
}

function PieChart({
  parts,
  selected,
  onChoose,
}: {
  parts: PiePart[];
  selected: string | null;
  onChoose: (name: string) => void;
}) {
  const wedges = buildWedges(useAnimatedParts(parts));
  if (wedges.length === 0) {
    return (
      <svg className="pie" viewBox="-32 -32 264 264" role="img" aria-label="No spending this month">
        <circle cx={CX} cy={CY} r={R} fill="#e4e4e6" />
      </svg>
    );
  }
  const names = new Set(wedges.map((wedge) => wedge.name));
  const dim = selected !== null && names.has(selected);
  return (
    <svg className="pie" viewBox="-32 -32 264 264" role="img" aria-label="Where the money goes">
      {wedges.map((wedge) => {
        const inside = wedge.sweep > 0.72;
        const labelAt = point(wedge.mid, inside ? 52 : 112);
        const leadFrom = point(wedge.mid, 90);
        const leadTo = point(wedge.mid, 104);
        const fill = wedge.color === "#8dceb0" || !inside ? "#017842" : "#ffffff";
        return (
          <g key={wedge.name} opacity={dim && wedge.name !== selected ? 0.28 : 1}>
            {!inside && (
              <line
                x1={leadFrom.x}
                y1={leadFrom.y}
                x2={leadTo.x}
                y2={leadTo.y}
                stroke="#017842"
                strokeWidth={1.5}
                pointerEvents="none"
              />
            )}
            <path d={wedge.d} fill={wedge.color} onClick={() => onChoose(wedge.name)}>
              <title>
                {wedge.name} {formatEur(wedge.valueEur)}
              </title>
            </path>
            <text
              className="pie-label"
              x={labelAt.x}
              y={labelAt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={fill}
              fontSize={12}
              fontWeight={800}
              fontFamily="Figtree, system-ui, sans-serif"
              stroke={inside ? undefined : "#ffffff"}
              strokeWidth={inside ? undefined : 3}
              paintOrder="stroke fill"
              pointerEvents="none"
            >
              {formatEurWhole(wedge.valueEur)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LegendValue({ name, value }: { name: string; value: number }) {
  const positive = name === "Income" || (name === "Left" && value > 0);
  return (
    <span className={`legend__value${positive ? " is-pos" : ""}${value < 0 ? " is-neg" : ""}`}>
      {formatEur(value)}
    </span>
  );
}

function purchases(count: number) {
  return count === 1 ? "1 purchase" : `${count} purchases`;
}

function LegendItem({
  name,
  detail,
  value,
  color,
  ring,
  link,
  chevron,
  expanded,
  onClick,
}: {
  name: string;
  detail: string;
  value: number;
  color?: string;
  ring?: boolean;
  link?: boolean;
  chevron?: boolean;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button className="legend__button" type="button" aria-expanded={chevron ? expanded : undefined} onClick={onClick}>
        <span className={ring ? "swatch swatch--ring" : "swatch"} style={ring ? undefined : { background: color }} />
        <span className="legend__copy">
          <span className="legend__name">{name}</span>
          <span className={`legend__detail${link ? " is-link" : ""}`}>{detail}</span>
          <LegendValue name={name} value={value} />
        </span>
        {chevron ? <span className="chevron" aria-hidden="true" /> : null}
      </button>
    </li>
  );
}

export function MonthPie({
  monthTitle,
  asOf,
  balanceEur,
  incomeEur,
  incomeDetail,
  slices,
  open,
  onToggle,
}: {
  monthTitle: string;
  asOf: string;
  balanceEur: number;
  incomeEur: number;
  incomeDetail: string;
  slices: MonthSlice[];
  open: boolean;
  onToggle: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [advice, setAdvice] = useState<SegmentAdvice | null>(null);
  const [seenMonth, setSeenMonth] = useState(monthTitle);
  if (seenMonth !== monthTitle) {
    setSeenMonth(monthTitle);
    setSelected(null);
  }
  const everyday = slices.find((slice) => slice.name === "Everyday");
  const categories = everyday?.categories ?? [];

  function amountFor(name: string) {
    if (name === "Income") return incomeEur;
    const slice = slices.find((item) => item.name === name);
    if (slice) return slice.valueEur;
    return categories.find((item) => item.name === name)?.valueEur ?? 0;
  }

  useEffect(() => {
    if (!selected) return;
    const amount = amountFor(selected);
    setAdvice(fallbackAdvice(monthTitle, selected, amount));
    const brief = [
      `Month: ${monthTitle}`,
      `Balance: ${formatEur(balanceEur)} on ${asOf}`,
      `Income (salary): ${formatEur(incomeEur)}`,
      ...slices.map((slice) => `${slice.name}: ${formatEur(slice.valueEur)}. ${slice.detail}`),
      `Everyday categories: ${categories.map((category) => `${category.name} ${formatEur(category.valueEur)} (${category.count})`).join(", ")}`,
      `Selected slice: ${selected}, amount ${formatEur(amount)}.`,
    ].join("\n");
    let active = true;
    fetchSegmentAdvice({ month: monthTitle, segment: selected, brief })
      .then((next) => {
        if (active && next) setAdvice(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selected, monthTitle]);

  function choose(name: string) {
    setSelected((current) => (current === name ? null : name));
  }

  function toggleEveryday() {
    setSelected(null);
    onToggle();
  }

  const parts: PiePart[] = open
    ? categories.map((category, index) => ({
        name: category.name,
        valueEur: category.valueEur,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }))
    : slices
        .filter((slice) => slice.valueEur > 0)
        .map((slice) => ({
          name: slice.name,
          valueEur: slice.valueEur,
          color: SLICE_COLOR[slice.name],
        }));

  return (
    <section className="data-panel home-panel">
      <div className="data-panel__head">
        <h2>{open ? "Everyday" : "Where the money goes"}</h2>
      </div>
      <div className="pie-row">
        <div className="pie-wrap">
          <PieChart parts={parts} selected={selected} onChoose={choose} />
        </div>
      {selected && advice ? (
        <div className="advice">
          <p className="advice__kicker">Trainer</p>
          <p className="advice__title">
            {selected} · {formatEur(amountFor(selected))}
          </p>
          <p className="advice__summary">{advice.summary}</p>
          <p className="advice__label">Recommendation</p>
          <p className="advice__rec">{advice.recommendation}</p>
          <button className="advice__close" type="button" onClick={() => setSelected(null)}>
            Back to the month
          </button>
        </div>
      ) : (
        <ul className="legend">
          {open ? (
            <>
              <LegendItem
                name="Everyday"
                detail="Hide categories"
                value={everyday?.valueEur ?? 0}
                color={SLICE_COLOR.Everyday}
                link
                chevron
                expanded
                onClick={toggleEveryday}
              />
              {categories.map((category, index) => (
                <LegendItem
                  key={category.name}
                  name={category.name}
                  detail={CATEGORY_SUBTITLE[category.name] ?? purchases(category.count)}
                  value={category.valueEur}
                  color={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                  onClick={() => choose(category.name)}
                />
              ))}
            </>
          ) : (
            <>
              <LegendItem name="Income" detail={incomeDetail} value={incomeEur} ring onClick={() => choose("Income")} />
              {slices.map((slice) => (
                <LegendItem
                  key={slice.name}
                  name={slice.name}
                  detail={slice.name === "Everyday" ? "Tap for categories" : slice.detail}
                  value={slice.valueEur}
                  color={SLICE_COLOR[slice.name]}
                  link={slice.name === "Everyday"}
                  chevron={slice.name === "Everyday"}
                  expanded={false}
                  onClick={slice.name === "Everyday" ? toggleEveryday : () => choose(slice.name)}
                />
              ))}
            </>
          )}
        </ul>
      )}
      </div>
    </section>
  );
}
