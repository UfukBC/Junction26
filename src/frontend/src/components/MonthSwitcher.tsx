import { ChevronLeft, ChevronRight } from "lucide-react";

/** ‹ September 2026 › with the date range under the month; used on Home and in the extended view. */
export function MonthSwitcher({
  label,
  range,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  label: string;
  range: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="month-switcher">
      <button className="month-switcher__arrow" type="button" aria-label="Previous month" disabled={!canPrev} onClick={onPrev}>
        <ChevronLeft size={24} strokeWidth={2.4} />
      </button>
      <div className="month-switcher__label">
        <span className="month-switcher__month">{label}</span>
        <span className="month-switcher__range">{range}</span>
      </div>
      <button className="month-switcher__arrow" type="button" aria-label="Next month" disabled={!canNext} onClick={onNext}>
        <ChevronRight size={24} strokeWidth={2.4} />
      </button>
    </div>
  );
}
