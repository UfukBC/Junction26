import { ArrowLeft, Info, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TimeMachineChart } from "../components/TimeMachineChart";
import {
  DEFAULT_HORIZON_MONTHS,
  MAX_HORIZON_MONTHS,
  MIN_HORIZON_MONTHS,
  SCENARIO_LABELS,
  controllableCategories,
  describeTimeMachine,
  horizonLabel,
  savedOverHorizon,
  scenarioProjections,
  type ScenarioSet,
} from "../data/timeMachine";
import { loadTimeMachineBaseline, type TimeMachineBaseline } from "../data/timeMachineData";
import { formatEurWhole } from "../format";

const PRESETS: { months: number; label: string }[] = [
  { months: 12, label: "1 yr" },
  { months: 36, label: "3 yrs" },
  { months: 60, label: "5 yrs" },
  { months: 120, label: "10 yrs" },
  { months: 240, label: "20 yrs" },
];

/** "−100 €/month on Restaurants" style preview of what the scenario changes. */
function signedEur(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatEurWhole(Math.abs(value))}`;
}

export function TimeMachineScreen({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [baseline, setBaseline] = useState<TimeMachineBaseline | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON_MONTHS);
  /** New monthly spend on the chosen category; null until the baseline sets it to the current average. */
  const [spendEur, setSpendEur] = useState<number | null>(null);
  const [cutCategory, setCutCategory] = useState("Restaurants");

  useEffect(() => {
    let active = true;
    loadTimeMachineBaseline(customerId)
      .then((next) => {
        if (!active) return;
        setBaseline(next);
        setStatus(next.monthsUsed > 0 ? "ready" : "error");
        if (next.monthsUsed === 0) setError("Not enough recent history to project from.");
        else {
          const trims = controllableCategories(next.categories);
          if (trims[0]) {
            setCutCategory(trims[0].category);
            setSpendEur(trims[0].monthlyEur);
          }
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  const trimCategories = useMemo(
    () => controllableCategories(baseline?.categories ?? []),
    [baseline],
  );
  const selectedCategory = trimCategories.find((c) => c.category === cutCategory) ?? trimCategories[0] ?? null;
  const currentSpend = selectedCategory?.monthlyEur ?? 0;
  // The bar is centred on today's average: 0 on the left, twice the average on the right.
  const spendMax = Math.max(50, Math.round(currentSpend * 2));
  const effectiveSpend = Math.min(spendEur ?? currentSpend, spendMax);
  // Signed difference against today: positive means spending less (money saved), negative means spending more.
  const monthlyChange = currentSpend - effectiveSpend;

  const scenarios = useMemo<ScenarioSet | null>(() => {
    if (!baseline || baseline.monthsUsed === 0) return null;
    return scenarioProjections(
      { startingBalanceEur: baseline.startingBalanceEur, monthlyNetEur: baseline.monthlyNetEur },
      { months: horizon, monthlyChangeEur: monthlyChange },
    );
  }, [baseline, horizon, monthlyChange]);

  const narrative = useMemo(() => {
    if (!scenarios || !baseline) return null;
    return describeTimeMachine({
      months: horizon,
      scenarios,
      monthlyNetEur: baseline.monthlyNetEur,
      monthlyChangeEur: monthlyChange,
      cutCategory: selectedCategory?.category ?? "everyday spending",
    });
  }, [scenarios, baseline, horizon, monthlyChange, selectedCategory]);

  const saved = scenarios ? savedOverHorizon(scenarios) : 0;
  const saving = monthlyChange > 0.5;
  const overspending = monthlyChange < -0.5;
  const saveLabel = saving ? "Save more" : overspending ? "Spend more" : "Same as now";

  return (
    <div className="home tmachine">
      <header className="topbar topbar--month">
        <button className="icon-button" type="button" aria-label="Back to home" onClick={onClose}>
          <ArrowLeft size={26} strokeWidth={2} />
        </button>
        <span className="tmachine__bar-title">Time machine</span>
        <span className="icon-button" aria-hidden="true" />
      </header>

      <div className="tmachine__content">
        <p className="tmachine__eyebrow">
          <TrendingUp size={14} strokeWidth={2.4} /> Your future
        </p>
        <h1 className="tmachine__title">Where your savings go next</h1>
        {baseline && status === "ready" ? (
          <p className="tmachine__sub">
            From your own last {baseline.monthsUsed} {baseline.monthsUsed === 1 ? "month" : "months"}
            {baseline.lastMonth ? `, ending ${baseline.lastMonth}` : ""}. A projection, not a promise.
          </p>
        ) : null}

        {status === "loading" && <p className="data-loading">Loading your data…</p>}
        {status === "error" && (
          <div className="placeholder">
            <p>{error}</p>
          </div>
        )}

        {status === "ready" && baseline && scenarios && narrative && (
          <>
            <section className="tmachine__stats" aria-label="Your starting point">
              <div className="tmachine__stat">
                <span>Balance today</span>
                <strong>{formatEurWhole(baseline.startingBalanceEur)}</strong>
              </div>
              <div className="tmachine__stat">
                <span>Monthly surplus</span>
                <strong className={baseline.monthlyNetEur < 0 ? "is-neg" : "is-pos"}>
                  {signedEur(baseline.monthlyNetEur)}
                </strong>
              </div>
              <div className="tmachine__stat">
                <span>Spending / month</span>
                <strong>{formatEurWhole(baseline.monthlySpendingEur)}</strong>
              </div>
            </section>

            <section className="tmachine__panel" aria-label="Timeline">
              <div className="tmachine__panel-head">
                <h2>Time range</h2>
                <span>{horizonLabel(horizon)}</span>
              </div>
              <div className="tmachine__presets" role="group" aria-label="Time range presets">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.months}
                    type="button"
                    aria-pressed={horizon === preset.months}
                    onClick={() => setHorizon(preset.months)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                className="tmachine__range"
                type="range"
                min={MIN_HORIZON_MONTHS}
                max={MAX_HORIZON_MONTHS}
                step={1}
                value={horizon}
                aria-label="Months into the future"
                onChange={(event) => setHorizon(Number(event.target.value))}
              />
              <p className="tmachine__hint">
                {horizon} {horizon === 1 ? "month" : "months"} from today
              </p>
            </section>

            <section className="tmachine__panel" aria-label="Monthly spending scenario">
              <div className="tmachine__panel-head">
                <h2>Spending · {selectedCategory?.category ?? "Category"}</h2>
                <span>{formatEurWhole(effectiveSpend)}/mo</span>
              </div>
              <div className="tmachine__cats" role="group" aria-label="Category to adjust">
                {trimCategories.map((category) => (
                  <button
                    key={category.category}
                    type="button"
                    aria-pressed={cutCategory === category.category}
                    onClick={() => {
                      setCutCategory(category.category);
                      setSpendEur(category.monthlyEur);
                    }}
                  >
                    {category.category}
                  </button>
                ))}
              </div>
              <input
                className="tmachine__range"
                type="range"
                min={0}
                max={spendMax}
                step={1}
                value={effectiveSpend}
                aria-label={`Monthly spending on ${selectedCategory?.category ?? "this category"}`}
                onChange={(event) => setSpendEur(Number(event.target.value))}
              />
              <div className="tmachine__scale">
                <span>0 €</span>
                <span className="tmachine__now">{formatEurWhole(currentSpend)} now</span>
                <span>{formatEurWhole(spendMax)}</span>
              </div>
              <p
                className={`tmachine__change${saving ? " is-pos" : overspending ? " is-neg" : ""}`}
              >
                {saving
                  ? `${formatEurWhole(monthlyChange)} less each month`
                  : overspending
                    ? `${formatEurWhole(-monthlyChange)} more each month`
                    : "Same as your average"}
              </p>
              <p className="tmachine__hint">
                Drag left to spend less, right to spend more. What you spend less is saved every month.
              </p>
            </section>

            <section
              className={`tmachine__saved${saving ? " is-pos" : overspending ? " is-neg" : ""}`}
              aria-label="Amount saved over the chosen time range"
            >
              <p className="tmachine__saved-label">
                {overspending ? `Extra spent over ${horizonLabel(horizon)}` : `Saved over ${horizonLabel(horizon)}`}
              </p>
              <p className="tmachine__saved-value">
                {saving ? `+${formatEurWhole(saved)}` : overspending ? `−${formatEurWhole(Math.abs(saved))}` : "0 €"}
              </p>
              <p className="tmachine__saved-sub">
                {saving
                  ? `${formatEurWhole(monthlyChange)}/month less on ${(selectedCategory?.category ?? "this").toLowerCase()}`
                  : overspending
                    ? `${formatEurWhole(-monthlyChange)}/month more on ${(selectedCategory?.category ?? "this").toLowerCase()}`
                    : "Drag the bar to see what saving would add"}
              </p>
            </section>

            <section className="tmachine__panel tmachine__panel--chart" aria-label="Projected balance">
              <TimeMachineChart scenarios={scenarios} months={horizon} />
              <ul className="tmachine__legend">
                {(["continue", "save"] as const).map((id) => {
                  const final = scenarios[id].finalBalanceEur;
                  const delta = final - scenarios.continue.finalBalanceEur;
                  const color =
                    id === "save"
                      ? delta < 0
                        ? "#c0372f"
                        : "#017842"
                      : final < 0
                        ? "#c0372f"
                        : "#8e948f";
                  return (
                    <li key={id}>
                      <span className="tmachine__dot" style={{ background: color }} />
                      <span className="tmachine__legend-name">{id === "save" ? saveLabel : SCENARIO_LABELS[id]}</span>
                      <span className="tmachine__legend-value">{formatEurWhole(final)}</span>
                      {id === "save" && delta !== 0 && (
                        <span className={`tmachine__delta${delta < 0 ? " is-neg" : ""}`}>
                          {delta > 0 ? "+" : "−"}
                          {formatEurWhole(Math.abs(delta))}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="ai-card tmachine__narrative" aria-label="What this means">
              <div className="ai-card__head">
                <span className="ai-card__kicker">What this means</span>
                <span className="ai-card__tag">built-in projection</span>
              </div>
              <p className="ai-card__title">{narrative.headline}</p>
              <p className="ai-card__text">{narrative.summary}</p>
              <p className="ai-card__text ai-card__rec">
                <strong>Try this:</strong> {narrative.recommendation}
              </p>
            </section>

            <p className="tmachine__note">
              <Info size={13} strokeWidth={2.2} /> Fixed monthly averages from your own accounts. Savings are money left
              in your account; this is not financial advice.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
