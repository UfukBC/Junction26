import { ChevronLeft, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getDataAsOf,
  getMonthlyFlow,
  getSpendingByCategory,
  type CategorySpend,
  type DateRange,
} from "../data/database";
import {
  GOAL_OPTIONS,
  INCOME_OPTIONS,
  goalLabel,
  incomeLabel,
  saveAnswers,
  type FinancialGoal,
  type IncomePredictability,
  type QuestionnaireAnswers,
} from "../data/questionnaire";
import { formatEurWhole } from "../format";

type Step = "goal" | "target" | "income" | "control" | "review";

interface Reference {
  months: number;
  averageIncomeEur: number;
  averageSpendingEur: number;
  averageLeftoverEur: number;
  categories: CategorySpend[];
  asOfMonth: string;
}

interface Props {
  customerId: string;
  initialAnswers: QuestionnaireAnswers | null;
  onClose: () => void;
  onSaved: (answers: QuestionnaireAnswers) => void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "2026-09-30" → "2025-10-01"…"2026-09-30" (twelve full months). */
function trailingYear(asOf: string): DateRange {
  const [year, month] = asOf.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 12, 1));
  return {
    startDate: `${start.getUTCFullYear()}-${pad2(start.getUTCMonth() + 1)}-01`,
    endDate: asOf,
  };
}

/** "2026-09-30" + 12 months → "2027-09". */
function monthAfter(asOf: string, months: number): string {
  const [year, month] = asOf.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

interface GoalDefaults {
  amountEur: number;
  months: number;
}

/** Example target and horizon per goal; the amount is only a placeholder suggestion. */
function goalDefaults(goal: FinancialGoal | null, reference: Reference | null): GoalDefaults {
  switch (goal) {
    case "emergency_buffer": {
      const monthly = reference?.averageSpendingEur ?? 1500;
      return { amountEur: Math.max(500, Math.round((monthly * 3) / 100) * 100), months: 12 };
    }
    case "home":
      return { amountEur: 25000, months: 60 };
    case "travel":
      return { amountEur: 2000, months: 12 };
    case "debt":
      return { amountEur: 5000, months: 24 };
    case "invest":
      return { amountEur: 5000, months: 36 };
    default:
      return { amountEur: 2000, months: 12 };
  }
}

function defaultTargetDate(goal: FinancialGoal | null, reference: Reference | null): string {
  const base = reference ? `${reference.asOfMonth}-01` : new Date().toISOString().slice(0, 10);
  return monthAfter(base, goalDefaults(goal, reference).months);
}

export function QuestionnaireScreen({ customerId, initialAnswers, onClose, onSaved }: Props) {
  const [goal, setGoal] = useState<FinancialGoal | null>(initialAnswers?.goal ?? null);
  const [targetAmount, setTargetAmount] = useState(
    initialAnswers?.targetAmountEur != null ? String(initialAnswers.targetAmountEur) : "",
  );
  const [targetDate, setTargetDate] = useState(
    initialAnswers?.targetDate ?? monthAfter(new Date().toISOString().slice(0, 10), 12),
  );
  const [income, setIncome] = useState<IncomePredictability | null>(
    initialAnswers?.incomePredictability ?? null,
  );
  const [control, setControl] = useState<string[]>(initialAnswers?.controlCategories ?? []);
  const [controlTouched, setControlTouched] = useState(initialAnswers != null);
  const [stepIndex, setStepIndex] = useState(0);
  const [reference, setReference] = useState<Reference | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "failed">("idle");

  useEffect(() => {
    let active = true;
    (async () => {
      const asOf = await getDataAsOf();
      if (!asOf) return;
      const range = trailingYear(asOf);
      const [flows, categories] = await Promise.all([
        getMonthlyFlow(customerId, range),
        getSpendingByCategory(customerId, range),
      ]);
      if (!active) return;
      const months = flows.length || 1;
      setReference({
        months: flows.length,
        averageIncomeEur: flows.reduce((sum, flow) => sum + flow.incomeEur, 0) / months,
        averageSpendingEur: flows.reduce((sum, flow) => sum + flow.spendingEur, 0) / months,
        averageLeftoverEur: flows.reduce((sum, flow) => sum + flow.netEur, 0) / months,
        categories,
        asOfMonth: asOf.slice(0, 7),
      });
    })().catch(() => {
      if (active) setReference(null);
    });
    return () => {
      active = false;
    };
  }, [customerId]);

  const asksTarget = GOAL_OPTIONS.find((option) => option.value === goal)?.asksTarget ?? true;
  const defaults = goalDefaults(goal, reference);

  const steps = useMemo<Step[]>(
    () => [
      "goal",
      ...(asksTarget ? (["target"] as Step[]) : []),
      "income",
      "control",
      "review",
    ],
    [asksTarget],
  );

  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex];
  const questionSteps: Step[] = steps.filter((candidate) => candidate !== "review");
  const questionNumber = questionSteps.indexOf(step) + 1;
  const progress = safeIndex / (steps.length - 1);

  const amount = Number(targetAmount.replace(",", ".").replace(/\s/g, ""));
  const amountValid = Number.isFinite(amount) && amount > 0;

  const canContinue = (() => {
    switch (step) {
      case "goal":
        return goal !== null;
      case "target":
        return amountValid && targetDate !== "";
      case "income":
        return income !== null;
      case "control":
        return controlTouched;
      case "review":
        return true;
    }
  })();

  const goNext = () => {
    if (!canContinue) return;
    if (step === "review") {
      finish();
      return;
    }
    setStepIndex(safeIndex + 1);
  };

  const goBack = () => {
    if (safeIndex === 0) {
      onClose();
      return;
    }
    setStepIndex(safeIndex - 1);
  };

  const finish = () => {
    if (!goal || !income) return;
    const answers: QuestionnaireAnswers = {
      goal,
      targetAmountEur: asksTarget && amountValid ? Math.round(amount) : null,
      targetDate: asksTarget && targetDate ? targetDate : null,
      incomePredictability: income,
      controlCategories: control,
      completedAt: new Date().toISOString(),
    };
    if (saveAnswers(customerId, answers)) {
      onSaved(answers);
    } else {
      setSaveState("failed");
    }
  };

  return (
    <div className="quiz">
      <header className="quiz__bar">
        <button
          type="button"
          className="quiz__back"
          onClick={goBack}
          aria-label={safeIndex === 0 ? "Close the questionnaire" : "Previous question"}
        >
          <ChevronLeft size={26} strokeWidth={2} />
        </button>
        <div
          className="quiz__progress"
          role="progressbar"
          aria-label="Questionnaire progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span style={{ width: `${Math.max(4, progress * 100)}%` }} />
        </div>
        <button type="button" className="quiz__close" onClick={onClose}>
          Skip
        </button>
      </header>

      <div className="quiz__body">
        {step !== "review" ? (
          <p className="quiz__step">
            Question {questionNumber} of {questionSteps.length}
          </p>
        ) : (
          <p className="quiz__step">Almost done</p>
        )}

        {step === "goal" && (
          <>
            <h1 className="quiz__question">What do you want to achieve?</h1>
            <p className="quiz__why">Your goal decides which numbers we look at and what advice you get.</p>
            <div className="quiz__options">
              {GOAL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`quiz__option ${goal === option.value ? "quiz__option--active" : ""}`}
                  aria-pressed={goal === option.value}
                  onClick={() => {
                    setGoal(option.value);
                    setTargetAmount("");
                    setTargetDate(defaultTargetDate(option.value, reference));
                  }}
                >
                  <span className="quiz__option-main">
                    <span className="quiz__option-label">{option.label}</span>
                    <span className="quiz__option-desc">{option.description}</span>
                  </span>
                  {goal === option.value && <Check size={20} strokeWidth={2.4} className="quiz__tick" />}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "target" && (
          <>
            <h1 className="quiz__question">
              {goal === "debt" ? "How much would you like to pay off?" : "How much would you like to set aside?"}
            </h1>
            <p className="quiz__why">A target turns a wish into a monthly amount you can actually check.</p>

            {reference && (
              <div className="quiz__reference">
                <p className="quiz__reference-title">Your last {reference.months} months</p>
                <div className="quiz__reference-row">
                  <span>Income</span>
                  <strong>~{formatEurWhole(reference.averageIncomeEur)} / month</strong>
                </div>
                <div className="quiz__reference-row">
                  <span>{reference.averageLeftoverEur >= 0 ? "Left over" : "Short by"}</span>
                  <strong>~{formatEurWhole(Math.abs(reference.averageLeftoverEur))} / month</strong>
                </div>
              </div>
            )}

            <label className="quiz__field">
              <span className="quiz__field-label">Target amount</span>
              <span className="quiz__amount">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={100}
                  placeholder={String(defaults.amountEur)}
                  value={targetAmount}
                  onChange={(event) => setTargetAmount(event.target.value)}
                />
                <span className="quiz__amount-unit">€</span>
              </span>
            </label>

            <label className="quiz__field">
              <span className="quiz__field-label">By when?</span>
              <input
                type="month"
                className="quiz__month"
                value={targetDate}
                min={reference?.asOfMonth}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </label>
          </>
        )}

        {step === "income" && (
          <>
            <h1 className="quiz__question">How predictable is your income?</h1>
            <p className="quiz__why">
              Predictable income can carry a firmer plan; variable income needs a bigger buffer.
            </p>
            <div className="quiz__options">
              {INCOME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`quiz__option ${income === option.value ? "quiz__option--active" : ""}`}
                  aria-pressed={income === option.value}
                  onClick={() => setIncome(option.value)}
                >
                  <span className="quiz__option-main">
                    <span className="quiz__option-label">{option.label}</span>
                    <span className="quiz__option-desc">{option.description}</span>
                  </span>
                  {income === option.value && <Check size={20} strokeWidth={2.4} className="quiz__tick" />}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "control" && (
          <>
            <h1 className="quiz__question">Which spending would you most like to control?</h1>
            <p className="quiz__why">
              Pick one or more. Small, frequent purchases are usually where money slips away — so start there.
            </p>
            <div className="quiz__options">
              {reference?.categories.map((category) => (
                <button
                  key={category.category}
                  type="button"
                  className={`quiz__option quiz__option--row ${
                    control.includes(category.category) ? "quiz__option--active" : ""
                  }`}
                  aria-pressed={control.includes(category.category)}
                  onClick={() => {
                    setControlTouched(true);
                    setControl((current) =>
                      current.includes(category.category)
                        ? current.filter((name) => name !== category.category)
                        : [...current, category.category],
                    );
                  }}
                >
                  <span className="quiz__option-main">
                    <span className="quiz__option-label">{category.category}</span>
                    <span className="quiz__option-desc">
                      ~{formatEurWhole(category.totalEur / Math.max(1, reference.months))} / month
                    </span>
                  </span>
                  {control.includes(category.category) && (
                    <Check size={20} strokeWidth={2.4} className="quiz__tick" />
                  )}
                </button>
              ))}
              <button
                type="button"
                className={`quiz__option quiz__option--row ${
                  controlTouched && control.length === 0 ? "quiz__option--active" : ""
                }`}
                aria-pressed={controlTouched && control.length === 0}
                onClick={() => {
                  setControl([]);
                  setControlTouched(true);
                }}
              >
                <span className="quiz__option-main">
                  <span className="quiz__option-label">Not sure yet</span>
                  <span className="quiz__option-desc">Show me where the money goes first.</span>
                </span>
                {controlTouched && control.length === 0 && (
                  <Check size={20} strokeWidth={2.4} className="quiz__tick" />
                )}
              </button>
            </div>
            {!reference && <p className="quiz__loading">Loading your categories…</p>}
          </>
        )}

        {step === "review" && goal && income && (
          <>
            <h1 className="quiz__question">Your goal, in one place</h1>
            <p className="quiz__why">You can edit this any time from the dashboard.</p>
            <dl className="quiz__summary">
              <div>
                <dt>Goal</dt>
                <dd>{goalLabel(goal)}</dd>
              </div>
              {asksTarget && amountValid && (
                <div>
                  <dt>{goal === "debt" ? "Pay off" : "Target"}</dt>
                  <dd>
                    {formatEurWhole(amount)}
                    {targetDate ? ` by ${targetDate}` : ""}
                  </dd>
                </div>
              )}
              <div>
                <dt>Income</dt>
                <dd>{incomeLabel(income)}</dd>
              </div>
              <div>
                <dt>Focus spending</dt>
                <dd>{control.length > 0 ? control.join(", ") : "Not sure yet"}</dd>
              </div>
            </dl>
            {saveState === "failed" && (
              <p className="quiz__error">Could not save on this device. Your answers will not be kept.</p>
            )}
          </>
        )}
      </div>

      <footer className="quiz__footer">
        <button type="button" className="quiz__cta" disabled={!canContinue} onClick={goNext}>
          {step === "review" ? "Save my goal" : "Continue"}
        </button>
      </footer>
    </div>
  );
}
