import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthRange } from "../../data/database";

export function monthTitle(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "1.9.–30.9.2026" (Finnish date style). */
export function finnishRange(month: string) {
  const { startDate, endDate } = monthRange(month);
  const [y, m, d0] = startDate!.split("-").map(Number);
  return `${d0}.${m}.–${Number(endDate!.slice(8, 10))}.${m}.${y}`;
}

/** ‹ September 2026 › — steps through the months that have data. */
export function MonthSwitcher({
  month,
  months,
  onChange,
}: {
  month: string;
  months: string[];
  onChange: (month: string) => void;
}) {
  const i = months.indexOf(month);
  const prev = i > 0 ? months[i - 1] : null;
  const next = i >= 0 && i < months.length - 1 ? months[i + 1] : null;
  return (
    <div className="month-switcher">
      <button
        className="month-switcher__arrow"
        aria-label={prev ? `Previous month: ${monthTitle(prev)}` : "No earlier data"}
        disabled={!prev}
        onClick={(e) => {
          e.stopPropagation();
          if (prev) onChange(prev);
        }}
      >
        <ChevronLeft size={24} strokeWidth={2.4} />
      </button>
      <div className="month-switcher__label">
        <span className="month-switcher__month">{monthTitle(month)}</span>
        <span className="month-switcher__range">{finnishRange(month)}</span>
      </div>
      <button
        className="month-switcher__arrow"
        aria-label={next ? `Next month: ${monthTitle(next)}` : "No later data"}
        disabled={!next}
        onClick={(e) => {
          e.stopPropagation();
          if (next) onChange(next);
        }}
      >
        <ChevronRight size={24} strokeWidth={2.4} />
      </button>
    </div>
  );
}
