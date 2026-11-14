import type { ReactNode } from "react";
import { BrainCircuit } from "lucide-react";
import type { DeepState } from "../../data/useDeepAnalysis";

const NEWS_SOURCE = "Yle News";

/**
 * Top-right switch on the AI card. One way only: once on, it stays on for that overview,
 * because the deep answer is the more reliable one and there is no reason to go back.
 */
export function DeepToggle({ on, onTurnOn }: { on: boolean; onTurnOn: () => void }) {
  return (
    <button
      type="button"
      className={`deep-toggle${on ? " deep-toggle--on" : ""}`}
      aria-pressed={on}
      disabled={on}
      title={on ? "Deep thinking is on for this overview" : undefined}
      onClick={onTurnOn}
    >
      <BrainCircuit size={14} strokeWidth={2.4} />
      Deep thinking
    </button>
  );
}

/**
 * The deep-thinking body of the AI card. The two-agent cross-check runs behind the scenes to make the answer more
 * reliable; the card looks the same however many agents answered. If none answered, `fallback` (the normal
 * summary) is shown.
 */
export function DeepPanel({
  state,
  fallback,
  comparisons,
}: {
  state: DeepState;
  fallback: ReactNode;
  /** The card's data blocks (previous months, similar income), placed between summary and recommendation. */
  comparisons?: ReactNode;
}) {
  if (state.status === "idle" || state.status === "running") {
    return (
      <div className="ai-card__loading" role="status" aria-live="polite">
        <span className="ai-card__bar" aria-hidden="true" />
        <span className="ai-card__loading-text">Analysing in depth…</span>
      </div>
    );
  }

  if (state.status === "failed" || !state.result) return <>{fallback}</>;

  const result = state.result;
  const figures = result.unsupportedFigures;
  return (
    <div className="deep">
      <p className="ai-card__text">{result.answer.summary}</p>
      {comparisons}
      {result.answer.recommendation && (
        <p className="ai-card__text ai-card__rec">
          <strong>Recommendation:</strong> {result.answer.recommendation}
        </p>
      )}
      <p className="deep__meta">
        {figures.length === 0
          ? "Every figure matches your data."
          : `Not found in your data: ${figures.join(", ")}.`}
        {result.news.length > 0 ? ` Read ${result.news.length} money headlines from ${NEWS_SOURCE}.` : ""}
      </p>
    </div>
  );
}
