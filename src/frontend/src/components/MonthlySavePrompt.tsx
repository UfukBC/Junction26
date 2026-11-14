import { ADVISOR_NAME } from "../data/advisor";
import { Analysing } from "./Analysing";
import { formatEurWhole } from "../format";

/**
 * Monthly savings question. The amount comes from local Qwen 3.5 9B when that call succeeds.
 */
export function MonthlySavePrompt({
  accountName,
  monthLabel,
  incomeEur,
  expenseEur,
  remainingEur,
  goalPaceEur,
  amountEur,
  reason,
  loading,
  fromModel,
  onSave,
  onSkip,
}: {
  accountName: string;
  monthLabel: string;
  incomeEur: number;
  expenseEur: number;
  remainingEur: number;
  goalPaceEur: number | null;
  amountEur: number;
  reason: string | null;
  loading: boolean;
  fromModel: boolean;
  onSave: () => void;
  onSkip: () => void;
}) {
  const nothingToSave = !loading && amountEur <= 0;
  const fallback =
    goalPaceEur == null
      ? `No target amount is set, so the suggestion is half of the ${formatEurWhole(remainingEur)} left in ${monthLabel}. The rest stays in the account.`
      : goalPaceEur === 0
        ? "The goal amount is already in this savings account."
        : amountEur < goalPaceEur
          ? `The goal needs ${formatEurWhole(goalPaceEur)} a month, and ${formatEurWhole(remainingEur)} remained in ${monthLabel}. Half of that remainder is a realistic save, so the month is not emptied.`
          : `The goal needs ${formatEurWhole(goalPaceEur)} a month. ${formatEurWhole(remainingEur)} remained in ${monthLabel}, so this save is the goal pace, not everything left.`;
  const why = loading ? `${ADVISOR_NAME} is reading the goal and what remained in ${monthLabel}.` : (reason ?? fallback);
  return (
    <div className="save-prompt" role="dialog" aria-modal="true" aria-labelledby="save-prompt-title">
      <div className="save-prompt__card">
        <p className="save-prompt__kicker">{fromModel ? `${ADVISOR_NAME} · 1st of the month` : "1st of the month"}</p>
        <h2 id="save-prompt-title">
          {loading
            ? "AI analysing"
            : nothingToSave
              ? "Nothing realistic to save this month"
              : `Do you want to save ${formatEurWhole(amountEur)} to ${accountName}?`}
        </h2>
        {loading ? <Analysing showText={false} /> : <p className="save-prompt__why">{why}</p>}
        <div className="save-prompt__figures">
          <div>
            <span>Income</span>
            <strong>{formatEurWhole(incomeEur)}</strong>
          </div>
          <div>
            <span>Expenses</span>
            <strong>{formatEurWhole(expenseEur)}</strong>
          </div>
          <div>
            <span>Remaining</span>
            <strong>{formatEurWhole(remainingEur)}</strong>
          </div>
          <div>
            <span>Goal pace</span>
            <strong>{goalPaceEur == null ? "No set amount" : `${formatEurWhole(goalPaceEur)} / month`}</strong>
          </div>
          <div>
            <span>Suggested</span>
            <strong>{loading ? "…" : formatEurWhole(amountEur)}</strong>
          </div>
        </div>
        <div className="save-prompt__actions">
          {loading ? null : nothingToSave ? (
            <button type="button" className="save-prompt__yes" onClick={onSkip}>
              OK
            </button>
          ) : (
            <>
              <button type="button" className="save-prompt__no" onClick={onSkip}>
                Not this month
              </button>
              <button type="button" className="save-prompt__yes" onClick={onSave}>
                Save it
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
