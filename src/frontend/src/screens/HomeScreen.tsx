import { ArrowLeft, LogOut, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GoalCard } from "../components/GoalCard";
import { AccountsList, QuickActions } from "../components/HomeSections";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { MonthlySavePrompt } from "../components/MonthlySavePrompt";
import { SpendingCard } from "../components/spending/SpendingCard";
import { usePhoneHeight } from "../components/spending/usePhoneHeight";
import { SpendingDetail } from "../components/spending/SpendingDetail";
import { TimeHabitCard } from "../components/TimeHabitCard";
import { TimeMachineCard } from "../components/TimeMachineCard";
import { getMonthStory, getMonthlyFlow, listMonths, monthRange, type MonthStory } from "../data/database";
import { fetchSavingsCheck, type SavingsCheckResult } from "../data/savingsCheck";
import { homeData, type Account } from "../data/mock";
import {
  clearAnswers,
  clearSweeps,
  goalLabel,
  loadAnswers,
  loadSweeps,
  monthlySaveCheckIsDue,
  monthsUntil,
  realisticMonthlySave,
  savedBalanceEur,
  savingsAccountName,
  saveSweep,
  type MonthlySaveDecision,
  type QuestionnaireAnswers,
} from "../data/questionnaire";
import { formatEurWhole } from "../format";
import { QuestionnaireScreen } from "./QuestionnaireScreen";
import { TimeMachineScreen } from "./TimeMachineScreen";

// Demo customer. Add ?customer=CUST03172 to the URL to view another demo customer (e.g. one with a time-habit warning).
const HOME_CUSTOMER = new URLSearchParams(window.location.search).get("customer") ?? "CUST04457";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthLabel(month: string) {
  const [year, index] = month.split("-");
  return `${MONTHS[Number(index) - 1]} ${year}`;
}

/** "1.8.–31.8.2026" (Finnish date style) */
function rangeLabel(month: string) {
  const { startDate, endDate } = monthRange(month);
  const [year, m] = startDate!.split("-").map(Number);
  return `1.${m}.–${Number(endDate!.slice(8, 10))}.${m}.${year}`;
}

export function HomeScreen() {
  const [months, setMonths] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [story, setStory] = useState<MonthStory | null>(null);
  // Extended view (opened by tapping the chart); `segment` = the slice that was tapped, if any.
  const [hasHabit, setHasHabit] = useState(false);
  const phoneHeight = usePhoneHeight();
  // Tall phones stack the ring above the rows; with a warning banner on the page it needs more room.
  const stacked = phoneHeight >= (hasHabit ? 940 : 840);
  const [analysis, setAnalysis] = useState<{ segment: string | null } | null>(null);
  const [questionnaire, setQuestionnaire] = useState(false);
  const [timeMachine, setTimeMachine] = useState(false);
  const [answers, setAnswers] = useState<QuestionnaireAnswers | null>(null);
  const [sweeps, setSweeps] = useState<MonthlySaveDecision[]>([]);
  const [latestFlow, setLatestFlow] = useState<{ month: string; incomeEur: number; spendingEur: number } | null>(null);
  const [modelCheck, setModelCheck] = useState<SavingsCheckResult | null>(null);
  const [modelState, setModelState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    setAnswers(loadAnswers(HOME_CUSTOMER));
    setSweeps(loadSweeps(HOME_CUSTOMER));
  }, []);

  const latestMonth = months.length > 0 ? months[months.length - 1] : null;
  const savePlan =
    latestFlow && answers
      ? realisticMonthlySave({
          incomeEur: latestFlow.incomeEur,
          expenseEur: latestFlow.spendingEur,
          targetAmountEur: answers.targetAmountEur,
          targetMonth: answers.targetDate,
          analysedMonth: latestFlow.month,
          alreadySavedEur: savedBalanceEur(sweeps),
        })
      : null;
  const saveAmount = modelCheck?.amountEur ?? savePlan?.amountEur ?? 0;
  const monthAlreadyAnswered = latestFlow != null && sweeps.some((row) => row.month === latestFlow.month);
  const showSavePrompt =
    !questionnaire &&
    !analysis &&
    answers?.createSavingsAccount === true &&
    monthlySaveCheckIsDue() &&
    latestFlow != null &&
    !monthAlreadyAnswered;

  const accounts = useMemo<Account[]>(() => {
    const movedEur = savedBalanceEur(sweeps);
    const bankAccounts = homeData.accounts.map((account) =>
      account.id === "acc-1" && account.balanceEur != null
        ? { ...account, balanceEur: Math.round((account.balanceEur - movedEur) * 100) / 100 }
        : account,
    );
    if (!answers?.createSavingsAccount) return homeData.accounts;
    const decision = latestMonth ? sweeps.find((row) => row.month === latestMonth) : undefined;
    const detail = !decision
      ? "Asks on the 1st"
      : decision.accepted
        ? `Saved ${formatEurWhole(decision.amountEur)} on the 1st`
        : "Nothing saved this month";
    const savings: Account = {
      id: "goal-savings",
      name: savingsAccountName(answers.goal),
      kind: "savings",
      detail,
      balanceEur: movedEur,
    };
    return [savings, ...bankAccounts];
  }, [answers, latestMonth, sweeps]);

  useEffect(() => {
    let active = true;
    listMonths(HOME_CUSTOMER)
      .then((list) => {
        if (!active) return;
        setMonths(list);
        setIndex(Math.max(0, list.length - 1));
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const month = months[index];
    if (!month) return;
    let active = true;
    getMonthStory(HOME_CUSTOMER, month)
      .then((next) => {
        if (!active) return;
        setStory(next);
        setStatus(next ? "ready" : "error");
        if (!next) setError("No transactions for this month.");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [months, index]);

  useEffect(() => {
    if (!latestMonth || !answers?.createSavingsAccount) return;
    let active = true;
    getMonthlyFlow(HOME_CUSTOMER, monthRange(latestMonth))
      .then((rows) => {
        const row = rows[rows.length - 1];
        if (!active || !row) return;
        setLatestFlow({ month: row.month, incomeEur: row.incomeEur, spendingEur: row.spendingEur });
      })
      .catch(() => {
        if (active) setLatestFlow(null);
      });
    return () => {
      active = false;
    };
  }, [latestMonth, answers?.createSavingsAccount]);

  const modelKey =
    showSavePrompt && savePlan && latestFlow && answers
      ? [
          latestFlow.month,
          answers.goal,
          answers.targetAmountEur,
          answers.targetDate,
          answers.incomePredictability,
          savePlan.remainingEur,
          savePlan.goalPaceEur,
          savePlan.safeCapEur,
          savedBalanceEur(sweeps),
        ].join("|")
      : "";

  useEffect(() => {
    if (!modelKey || !savePlan || !latestFlow || !answers) return;
    let active = true;
    setModelCheck(null);
    setModelState("loading");
    fetchSavingsCheck({
      goalLabel: goalLabel(answers.goal),
      targetAmountEur: answers.targetAmountEur,
      targetMonth: answers.targetDate,
      analysedMonth: latestFlow.month,
      monthsLeft: answers.targetDate ? monthsUntil(latestFlow.month, answers.targetDate) : 1,
      alreadySavedEur: savedBalanceEur(sweeps),
      incomeEur: latestFlow.incomeEur,
      expenseEur: latestFlow.spendingEur,
      remainingEur: savePlan.remainingEur,
      goalPaceEur: savePlan.goalPaceEur,
      safeCapEur: savePlan.safeCapEur,
      incomePredictability: answers.incomePredictability,
    })
      .then((result) => {
        if (!active) return;
        setModelCheck(result);
        setModelState(result ? "ready" : "fallback");
      })
      .catch(() => {
        if (active) setModelState("fallback");
      });
    return () => {
      active = false;
    };
  }, [modelKey]);

  const answerSavePrompt = (accepted: boolean) => {
    if (!latestFlow || !answers) return;
    const decision: MonthlySaveDecision = {
      month: latestFlow.month,
      amountEur: accepted ? saveAmount : 0,
      accepted,
    };
    if (!saveSweep(HOME_CUSTOMER, decision)) return;
    setSweeps(loadSweeps(HOME_CUSTOMER));
  };

  if (questionnaire) {
    return (
      <QuestionnaireScreen
        customerId={HOME_CUSTOMER}
        initialAnswers={answers}
        onClose={() => setQuestionnaire(false)}
        onSaved={(next) => {
          setAnswers(next);
          setQuestionnaire(false);
        }}
      />
    );
  }

  if (timeMachine) {
    return <TimeMachineScreen customerId={HOME_CUSTOMER} onClose={() => setTimeMachine(false)} />;
  }

  const switcher = (
    <MonthSwitcher
      label={story ? monthLabel(story.month) : "Loading"}
      range={story ? rangeLabel(story.month) : " "}
      canPrev={index > 0}
      canNext={index < months.length - 1}
      onPrev={() => setIndex((current) => Math.max(0, current - 1))}
      onNext={() => setIndex((current) => Math.min(months.length - 1, current + 1))}
    />
  );

  // Extended view: opened by tapping the chart on Home.
  if (analysis) {
    return (
      <div className="home">
        <header className="topbar topbar--month">
          <button className="icon-button" type="button" aria-label="Back to home" onClick={() => setAnalysis(null)}>
            <ArrowLeft size={26} strokeWidth={2} />
          </button>
          {switcher}
          <span className="icon-button" aria-hidden="true" />
        </header>
        <section className="spend spend--analysis" aria-label="Spending analysis">
          {story && status === "ready" ? (
            <SpendingDetail
              key={analysis.segment ?? "none"}
              customerId={HOME_CUSTOMER}
              story={story}
              monthTitle={monthLabel(story.month)}
              initialSegment={analysis.segment}
            />
          ) : (
            <p className="data-loading">Loading your data…</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="home">
      <header className="topbar topbar--month">
        <button className="icon-button" aria-label="Log out">
          <LogOut size={28} strokeWidth={1.8} />
        </button>
        {status === "error" ? <span /> : switcher}
        <button className="icon-button icon-button--dot" aria-label="Chat">
          <MessageSquare size={28} strokeWidth={1.8} />
        </button>
      </header>

      <section className="spend" aria-label="Your spending">
        {status === "error" ? (
          <div className="placeholder">
            <p>{error}</p>
          </div>
        ) : (
          <div className="spend__slot">
            {story && status === "ready" ? (
              <SpendingCard story={story} stacked={stacked} onOpen={(segment) => setAnalysis({ segment })} />
            ) : (
              <p className="data-loading">Loading your data…</p>
            )}
          </div>
        )}
      </section>

      <div className="tinted">
        <TimeHabitCard customerId={HOME_CUSTOMER} month={months[index]} onFound={setHasHabit} />
        <GoalCard
          answers={answers}
          onEdit={() => setQuestionnaire(true)}
          onReset={() => {
            clearAnswers(HOME_CUSTOMER);
            clearSweeps(HOME_CUSTOMER);
            setAnswers(null);
            setSweeps([]);
          }}
        />
        <TimeMachineCard onOpen={() => setTimeMachine(true)} />
        <QuickActions />
        <AccountsList accounts={accounts} />
      </div>
      {showSavePrompt && latestFlow && answers && savePlan && (
        <MonthlySavePrompt
          accountName={savingsAccountName(answers.goal)}
          monthLabel={monthLabel(latestFlow.month)}
          incomeEur={latestFlow.incomeEur}
          expenseEur={latestFlow.spendingEur}
          remainingEur={savePlan.remainingEur}
          goalPaceEur={savePlan.goalPaceEur}
          amountEur={saveAmount}
          reason={modelCheck?.reason ?? null}
          loading={modelState === "loading"}
          fromModel={modelState === "ready"}
          onSave={() => answerSavePrompt(true)}
          onSkip={() => answerSavePrompt(false)}
        />
      )}
    </div>
  );
}
