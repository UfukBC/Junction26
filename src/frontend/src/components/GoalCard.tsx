import { Target } from "lucide-react";
import { goalLabel, type QuestionnaireAnswers } from "../data/questionnaire";
import { formatEurWhole } from "../format";

export function GoalCard({
  answers,
  onEdit,
  onReset,
}: {
  answers: QuestionnaireAnswers | null;
  onEdit: () => void;
  onReset: () => void;
}) {
  if (!answers) {
    return (
      <section className="goal-card">
        <span className="goal-card__icon" aria-hidden="true">
          <Target size={19} strokeWidth={2} />
        </span>
        <div className="goal-card__main">
          <h2 className="goal-card__title">Set your goal</h2>
          <p className="goal-card__text">Four quick questions, advice that fits you.</p>
        </div>
        <button type="button" className="goal-card__cta" onClick={onEdit}>
          Start
        </button>
      </section>
    );
  }

  const focus =
    answers.controlCategories.length > 0 ? ` · focus on ${answers.controlCategories.join(", ")}` : "";
  return (
    <section className="goal-card goal-card--set">
      <span className="goal-card__icon" aria-hidden="true">
        <Target size={19} strokeWidth={2} />
      </span>
      <div className="goal-card__main">
        <h2 className="goal-card__title">{goalLabel(answers.goal)}</h2>
        <p className="goal-card__text">
          {answers.targetAmountEur != null
            ? `${formatEurWhole(answers.targetAmountEur)}${answers.targetDate ? ` by ${answers.targetDate}` : ""}${focus}`
            : `We’ll show you where the money goes${focus}`}
        </p>
      </div>
      <div className="goal-card__actions">
        <button type="button" onClick={onEdit}>
          Edit
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>
    </section>
  );
}
