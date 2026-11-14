import { ArrowLeft, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { CategorySpend } from "../data/database";
import { useMonthSpending } from "../data/useSpending";
import { formatEur } from "../format";
import { MonthSwitcher, monthTitle } from "../components/spending/MonthSwitcher";
import { OTHER_KEY, SpendingPie, pct, toSlices, type Slice } from "../components/spending/pie";

/** "+45 €" / "−12 €" change against the previous month, or null when there is no previous month. */
function delta(current: number, categories: string[], previous: CategorySpend[] | undefined) {
  if (!previous) return null;
  const before = previous.filter((c) => categories.includes(c.category)).reduce((s, c) => s + c.totalEur, 0);
  return current - before;
}

function DeltaText({ value }: { value: number | null }) {
  if (value === null) return null;
  if (Math.abs(value) < 0.5) return <span className="analysis-row__delta">same as before</span>;
  return (
    <span className="analysis-row__delta">
      {value > 0 ? "▲" : "▼"} {formatEur(Math.abs(value))}
    </span>
  );
}

/**
 * Full-screen spending analysis for one month: big interactive pie, every category (including what is
 * inside "Other"), change vs the previous month, money in/out, and the space for AI overviews (T-014).
 */
export function SpendingAnalysis({
  customerId,
  month,
  months,
  onMonthChange,
  onBack,
}: {
  customerId: string;
  month: string;
  months: string[];
  onMonthChange: (month: string) => void;
  onBack: () => void;
}) {
  const { data, error } = useMonthSpending(customerId, month, months);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [month, customerId]);

  const slices = data ? toSlices(data.categories) : [];
  const selectedSlice = slices.find((s) => s.key === selected) ?? null;
  const toggle = (key: string) => setSelected((cur) => (cur === key ? null : key));
  const prevCats = data?.previous?.categories;
  const prevLabel = data?.previous ? monthTitle(data.previous.month).split(" ")[0] : null;
  const left = data ? data.incomeEur - data.spendingEur : 0;

  const sliceDelta = (s: Slice) =>
    delta(s.totalEur, s.members ? s.members.map((m) => m.category) : [s.key], prevCats);

  return (
    <div className="analysis">
      <header className="analysis__header">
        <button className="icon-button" aria-label="Back" onClick={onBack}>
          <ArrowLeft size={26} strokeWidth={2} />
        </button>
        <h1 className="analysis__title">Spending analysis</h1>
        <span className="analysis__customer">{customerId}</span>
      </header>

      <MonthSwitcher month={month} months={months} onChange={onMonthChange} />

      {error && <p className="spend--placeholder">Spending data unavailable: {error}</p>}
      {!error && !data && <p className="spend--placeholder">Loading…</p>}
      {data && slices.length === 0 && <p className="spend--placeholder">No spending recorded this month.</p>}

      {data && slices.length > 0 && (
        <>
          <div className="analysis__chart">
            <SpendingPie
              slices={slices}
              size={248}
              selected={selected}
              onSelect={toggle}
              center={
                selectedSlice
                  ? { value: formatEur(selectedSlice.totalEur), label: `${selectedSlice.label} · ${pct(selectedSlice.share)}` }
                  : { value: formatEur(data.spendingEur), label: "spent this month" }
              }
            />
            <p className="analysis__hint">Tap a slice or a row to highlight it.</p>
          </div>

          <section className="analysis__tiles" aria-label="This month">
            <div className="analysis-tile">
              <span>Money in</span>
              <strong>{formatEur(data.incomeEur)}</strong>
            </div>
            <div className="analysis-tile">
              <span>Spent</span>
              <strong>{formatEur(data.spendingEur)}</strong>
            </div>
            <div className="analysis-tile">
              <span>{left >= 0 ? "Left" : "Over by"}</span>
              <strong>{formatEur(Math.abs(left))}</strong>
            </div>
          </section>

          <section className="analysis__list" aria-label="Categories">
            <div className="analysis__list-head">
              <h2>By category</h2>
              {prevLabel && <span>vs {prevLabel}</span>}
            </div>
            {slices.map((s) => (
              <div key={s.key} className="analysis-group">
                <button
                  className={`analysis-row${selected !== null && selected !== s.key ? " analysis-row--dim" : ""}`}
                  aria-pressed={selected === s.key}
                  onClick={() => toggle(s.key)}
                >
                  <span className="legend__swatch" style={{ background: s.color }} />
                  <span className="analysis-row__name">{s.label}</span>
                  <span className="analysis-row__amount">
                    {formatEur(s.totalEur)}
                    <DeltaText value={sliceDelta(s)} />
                  </span>
                  <span className="analysis-row__share">{pct(s.share)}</span>
                </button>
                {s.key === OTHER_KEY &&
                  s.members?.map((m) => (
                    <div key={m.category} className="analysis-subrow">
                      <span className="analysis-row__name">{m.category}</span>
                      <span className="analysis-row__amount">
                        {formatEur(m.totalEur)}
                        <DeltaText value={delta(m.totalEur, [m.category], prevCats)} />
                      </span>
                      <span className="analysis-row__share">{pct(m.share)}</span>
                    </div>
                  ))}
              </div>
            ))}
          </section>

          <section className="ai-overview" aria-label="AI overview">
            <div className="ai-overview__head">
              <Sparkles size={20} strokeWidth={2} />
              <h2>AI overview</h2>
            </div>
            <p>
              Personalised insights about your {monthTitle(month)} spending will appear here: what changed, what it
              means for your goal, and one next step.
            </p>
            <span className="ai-overview__tag">Coming next (task T-014)</span>
          </section>
        </>
      )}
    </div>
  );
}
