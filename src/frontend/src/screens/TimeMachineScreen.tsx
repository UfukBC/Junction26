import { ArrowLeft, Info, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { TimeMachineChart } from "../components/TimeMachineChart";
import {
  DEFAULT_HORIZON_MONTHS,
  MAX_HORIZON_MONTHS,
  MIN_HORIZON_MONTHS,
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

/** "+663 €", "−120 €", "0 €" */
function signedEur(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${formatEurWhole(Math.abs(rounded))}`;
}

/** "2026-09" → "September 2026" */
function monthName(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Filled part of a range input, for the custom track. */
function fill(value: number, min: number, max: number): CSSProperties {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return { ["--fill" as string]: `${Math.min(100, Math.max(0, pct))}%` };
}

/**
 * Time machine: where the customer's balance goes on today's habits, and what changing one everyday category
 * would add. The result (balance, difference, chart) leads; the controls follow. Only the customer's own data.
 */
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
        if (next.monthsUsed === 0) {
          setError("Not enough recent history to project from yet.");
          setStatus("error");
          return;
        }
        const first = controllableCategories(next.categories)[0];
        if (first) {
          setCutCategory(first.category);
          setSpendEur(first.monthlyEur);
        }
        setStatus("ready");
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

  const categories = useMemo(() => controllableCategories(baseline?.categories ?? []), [baseline]);
  const selected = categories.find((c) => c.category === cutCategory) ?? categories[0] ?? null;
  const categoryName = selected?.category ?? "this category";
  const currentSpend = selected?.monthlyEur ?? 0;
  // The slider is centred on today's average: 0 on the left, twice the average on the right.
  const spendMax = Math.max(50, Math.round(currentSpend * 2));
  const effectiveSpend = Math.min(spendEur ?? currentSpend, spendMax);
  // Signed difference against today: positive means spending less (money saved), negative means spending more.
  const monthlyChange = currentSpend - effectiveSpend;
  const saving = monthlyChange > 0.5;
  const overspending = monthlyChange < -0.5;
  const tone = saving ? " is-pos" : overspending ? " is-neg" : "";

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
      cutCategory: selected?.category ?? "everyday spending",
    });
  }, [scenarios, baseline, horizon, monthlyChange, selected]);

  const saved = scenarios ? savedOverHorizon(scenarios) : 0;
  /** First month the plan's balance is below zero, or null if it never is within the horizon. */
  const belowZeroMonth = scenarios?.save.points.find((point) => point.month > 0 && point.balanceEur < 0)?.month ?? null;
  const period = horizonLabel(horizon);

  return (
    <div className="home tm">
      <header className="topbar topbar--month">
        <button className="icon-button" type="button" aria-label="Back to home" onClick={onClose}>
          <ArrowLeft size={26} strokeWidth={2} />
        </button>
        <span className="tm__bar-title">Time machine</span>
        <span className="icon-button" aria-hidden="true" />
      </header>

      <div className="tm__body">
        {status === "loading" && (
          <div className="tm-skeleton" role="status" aria-label="Loading your projection">
            <div className="tm-skeleton__hero" />
            <div className="tm-skeleton__card" />
          </div>
        )}

        {status === "error" && (
          <div className="tm-empty">
            <TrendingUp size={28} strokeWidth={2} />
            <p>{error}</p>
          </div>
        )}

        {status === "ready" && baseline && scenarios && narrative && (
          <>
            {/* The answer first: balance at the horizon, the difference the change makes, and the curve. */}
            <section className="tm-hero" aria-label={`Projected balance in ${period}`}>
              <p className="tm-hero__eyebrow">Your balance in {period}</p>
              <p className="tm-hero__value">{formatEurWhole(scenarios.save.finalBalanceEur)}</p>
              <div className="tm-hero__pills">
                <p className={`tm-hero__delta${tone}`}>
                  {saving ? (
                    <TrendingUp size={14} strokeWidth={2.6} />
                  ) : overspending ? (
                    <TrendingDown size={14} strokeWidth={2.6} />
                  ) : null}
                  {saving
                    ? `${signedEur(saved)} more than today's habits`
                    : overspending
                      ? `${formatEurWhole(Math.abs(saved))} less than today's habits`
                      : "On today's habits"}
                </p>
                {belowZeroMonth !== null && (
                  <p className="tm-hero__delta is-neg">
                    <TrendingDown size={14} strokeWidth={2.6} />
                    Below 0 € after {horizonLabel(belowZeroMonth)}
                  </p>
                )}
              </div>

              <TimeMachineChart scenarios={scenarios} months={horizon} />

              <ul className="tm-hero__legend">
                {saving || overspending ? (
                  <>
                    <li>
                      <span className={`tm-key tm-key--plan${overspending ? " is-neg" : ""}`} />
                      With change <strong>{formatEurWhole(scenarios.save.finalBalanceEur)}</strong>
                    </li>
                    <li>
                      <span className="tm-key tm-key--habits" />
                      Today's habits <strong>{formatEurWhole(scenarios.continue.finalBalanceEur)}</strong>
                    </li>
                  </>
                ) : (
                  <li>
                    <span className="tm-key tm-key--plan" />
                    Today's habits, projected
                  </li>
                )}
              </ul>

              <div className="tm-seg" role="group" aria-label="Time range">
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
                className="tm-slider tm-slider--light"
                type="range"
                min={MIN_HORIZON_MONTHS}
                max={MAX_HORIZON_MONTHS}
                step={1}
                value={horizon}
                style={fill(horizon, MIN_HORIZON_MONTHS, MAX_HORIZON_MONTHS)}
                aria-label="Months into the future"
                aria-valuetext={period}
                onChange={(event) => setHorizon(Number(event.target.value))}
              />
            </section>

            {/* The what-if, right under the chart so both are on screen while dragging. */}
            <section className="tm-card" aria-label="Change one habit">
              <div className="tm-card__top">
                <div className="tm-card__title">
                  <h2>Change one habit</h2>
                  <p>{categoryName} per month</p>
                </div>
                <p className="tm-readout" aria-live="polite">
                  {formatEurWhole(effectiveSpend)}
                  {(saving || overspending) && <s>{formatEurWhole(currentSpend)}</s>}
                </p>
              </div>

              <div className="tm-chips" role="group" aria-label="Category to change">
                {categories.map((category) => (
                  <button
                    key={category.category}
                    type="button"
                    aria-pressed={selected?.category === category.category}
                    aria-label={`${category.category}, ${formatEurWhole(category.monthlyEur)} a month now`}
                    onClick={() => {
                      setCutCategory(category.category);
                      setSpendEur(category.monthlyEur);
                    }}
                  >
                    {category.category}
                  </button>
                ))}
              </div>

              <div className="tm-track">
                <input
                  className="tm-slider"
                  type="range"
                  min={0}
                  max={spendMax}
                  step={1}
                  value={effectiveSpend}
                  style={fill(effectiveSpend, 0, spendMax)}
                  aria-label={`Monthly spending on ${categoryName}`}
                  aria-valuetext={`${formatEurWhole(effectiveSpend)} per month`}
                  onChange={(event) => setSpendEur(Number(event.target.value))}
                />
                <span className="tm-track__now" style={fill(currentSpend, 0, spendMax)} aria-hidden="true" />
              </div>
              <div className="tm-scale">
                <span>0 €</span>
                <button type="button" className="tm-scale__now" onClick={() => setSpendEur(currentSpend)}>
                  Now {formatEurWhole(currentSpend)}
                </button>
                <span>{formatEurWhole(spendMax)}</span>
              </div>

              <p className={`tm-result${tone}`}>
                {saving ? (
                  <>
                    <strong>{formatEurWhole(monthlyChange)} less a month</strong> adds{" "}
                    <strong>{signedEur(saved)}</strong> in {period}
                  </>
                ) : overspending ? (
                  <>
                    <strong>{formatEurWhole(-monthlyChange)} more a month</strong> costs{" "}
                    <strong>{formatEurWhole(Math.abs(saved))}</strong> in {period}
                  </>
                ) : (
                  <>Drag left to spend less and save more</>
                )}
              </p>
            </section>

            {/* Context, below the fold: where the projection starts and what it means. */}
            <section className="tm-start" aria-label="Your starting point">
              <div>
                <span>Balance today</span>
                <strong>{formatEurWhole(baseline.startingBalanceEur)}</strong>
              </div>
              <div>
                <span>Left each month</span>
                <strong className={baseline.monthlyNetEur < 0 ? "is-neg" : "is-pos"}>
                  {signedEur(baseline.monthlyNetEur)}
                </strong>
              </div>
              <div>
                <span>Spent each month</span>
                <strong>{formatEurWhole(baseline.monthlySpendingEur)}</strong>
              </div>
            </section>

            <section className="ai-card tm-story" aria-label="What this means">
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

            <p className="tm-note">
              <Info size={13} strokeWidth={2.2} />
              <span>
                Averages of your last {baseline.monthsUsed} {baseline.monthsUsed === 1 ? "month" : "months"}
                {baseline.lastMonth ? ` up to ${monthName(baseline.lastMonth)}` : ""}, with no interest or inflation.
                Savings are money left in your account. A projection, not a promise, and not financial advice.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
