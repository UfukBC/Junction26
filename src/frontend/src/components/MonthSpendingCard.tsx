import { ChevronRight } from "lucide-react";
import { useMonthSpending } from "../data/useSpending";
import { formatEur } from "../format";
import { MonthSwitcher } from "./spending/MonthSwitcher";
import { SpendingPie, pct, toSlices } from "./spending/pie";

/**
 * Compact home-screen card: one month's spending (1st to last day) as a small pie with the top categories.
 * Arrows switch months; tapping the card opens the analysis screen.
 */
export function MonthSpendingCard({
  customerId,
  month,
  months,
  onMonthChange,
  onOpenAnalysis,
}: {
  customerId: string;
  month: string | null;
  months: string[] | null;
  onMonthChange: (month: string) => void;
  onOpenAnalysis: () => void;
}) {
  const { data, error } = useMonthSpending(customerId, month, months);

  if (error) return <section className="spend spend--placeholder">Spending data unavailable: {error}</section>;
  if (!month || !months) return <section className="spend spend--placeholder" aria-busy="true">Loading your spending…</section>;

  const slices = data ? toSlices(data.categories) : [];
  const left = data ? data.incomeEur - data.spendingEur : 0;

  return (
    <section className="spend" aria-label="Spending this month">
      <h1 className="spend__title">Your spending</h1>
      <MonthSwitcher month={month} months={months} onChange={onMonthChange} />

      <button className="spend__body" onClick={onOpenAnalysis} aria-label="Open spending analysis">
        {!data ? (
          <span className="spend__loading">Loading…</span>
        ) : slices.length === 0 ? (
          <span className="spend__loading">No spending recorded this month.</span>
        ) : (
          <>
            <div className="spend__summary">
              <SpendingPie slices={slices} size={112} />
              <div className="spend__figures">
                <span className="spend__total">{formatEur(data.spendingEur)}</span>
                <span className="spend__caption">spent</span>
                <span className="spend__line">
                  Money in <strong>{formatEur(data.incomeEur)}</strong>
                </span>
                <span className="spend__line">
                  {left >= 0 ? "Left" : "Over by"} <strong>{formatEur(Math.abs(left))}</strong>
                </span>
              </div>
            </div>
            <ul className="spend__top">
              {slices.slice(0, 3).map((s) => (
                <li key={s.key}>
                  <span className="legend__swatch" style={{ background: s.color }} />
                  {s.label} <span className="spend__top-share">{pct(s.share)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <span className="link-button spend__cta">
          Analyse spending <ChevronRight size={22} strokeWidth={2.6} />
        </span>
      </button>
    </section>
  );
}
