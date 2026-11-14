import { ChevronRight, TrendingUp } from "lucide-react";

/** Compact Home entry to the Time machine projection. */
export function TimeMachineCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="time-card" type="button" onClick={onOpen}>
      <span className="time-card__icon" aria-hidden="true">
        <TrendingUp size={19} strokeWidth={2.2} />
      </span>
      <span className="time-card__text">
        <span className="time-card__title">Time machine</span>
        <span className="time-card__sub">See where your habits take your money</span>
      </span>
      <ChevronRight size={20} strokeWidth={2.4} />
    </button>
  );
}
