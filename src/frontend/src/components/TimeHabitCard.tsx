import { ChevronRight, Clock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getPurchases, monthRange } from "../data/database";
import { describeHabit, detectTimeHabits, type TimeHabitFinding } from "../data/timeHabits";
import { formatEur } from "../format";

/** "2026-09" → "2026-07" (first month of the 3-month window that ends at `month`). */
function windowStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 3, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function when(timestampIso: string) {
  const [date, time] = timestampIso.split("T");
  const [, m, d] = date.split("-").map(Number);
  return `${d}.${m}. ${time.slice(0, 5)}`;
}

/**
 * Personal spending-time warning (T-016). Looks only at this customer's own purchases in the 3 months ending at
 * `month`. Renders nothing when no habit is found; otherwise a one-line banner that opens a sheet with the details,
 * so the Home screen keeps fitting on one page. The wording comes from `describeHabit` (rule-based).
 */
export function TimeHabitCard({
  customerId,
  month,
  onFound,
}: {
  customerId: string;
  month: string | undefined;
  /** Called with true while a warning banner is shown (the page layout needs room for it). */
  onFound?: (found: boolean) => void;
}) {
  const [finding, setFinding] = useState<TimeHabitFinding | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setFinding(null);
    setOpen(false);
    if (!month) return;
    let active = true;
    const range = { startDate: monthRange(windowStart(month)).startDate, endDate: monthRange(month).endDate };
    getPurchases(customerId, range)
      .then((purchases) => active && setFinding(detectTimeHabits(purchases)[0] ?? null))
      .catch(() => active && setFinding(null)); // a missing warning is better than a broken home screen
    return () => {
      active = false;
    };
  }, [customerId, month]);

  useEffect(() => {
    onFound?.(finding !== null);
  }, [finding]);

  if (!finding) return null;
  const text = describeHabit(finding);
  const phone = document.querySelector(".phone");
  return (
    <>
      <button className="habit-banner" type="button" onClick={() => setOpen(true)}>
        <Clock size={20} strokeWidth={2.2} />
        <span className="habit-banner__text">
          <strong>{text.headline}</strong>
          <span>
            {finding.bigInWindowCount} of {finding.bigCount} big purchases, {formatEur(finding.bigInWindowTotalEur)}
          </span>
        </span>
        <ChevronRight size={20} strokeWidth={2.4} />
      </button>
      {open &&
        phone &&
        createPortal(
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Spending habit warning">
            <button className="sheet__backdrop" type="button" aria-label="Close" onClick={() => setOpen(false)} />
            <div className="sheet__panel">
              <div className="habit__head">
                <Clock size={20} strokeWidth={2.2} />
                <h2>{text.headline}</h2>
                <button className="icon-button sheet__close" type="button" aria-label="Close" onClick={() => setOpen(false)}>
                  <X size={22} strokeWidth={2.2} />
                </button>
              </div>
              <p className="habit__detail">{text.detail}</p>
              <ul className="habit__examples">
                {finding.examples.map((p) => (
                  <li key={p.timestampIso}>
                    <span>
                      {when(p.timestampIso)} · {p.category}
                    </span>
                    <strong>{formatEur(p.amountEur)}</strong>
                  </li>
                ))}
              </ul>
              <p className="habit__tip">{text.tip}</p>
              <p className="habit__note">Based only on your own purchases in the last 3 months.</p>
            </div>
          </div>,
          phone,
        )}
    </>
  );
}
