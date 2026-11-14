import { ArrowLeft, LogOut, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { GoalCard } from "../components/GoalCard";
import { AccountsList, QuickActions } from "../components/HomeSections";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { SpendingCard } from "../components/spending/SpendingCard";
import { usePhoneHeight } from "../components/spending/usePhoneHeight";
import { SpendingDetail } from "../components/spending/SpendingDetail";
import { TimeHabitCard } from "../components/TimeHabitCard";
import { getMonthStory, listMonths, monthRange, type MonthStory } from "../data/database";
import { homeData } from "../data/mock";
import { clearAnswers, loadAnswers, type QuestionnaireAnswers } from "../data/questionnaire";
import { QuestionnaireScreen } from "./QuestionnaireScreen";

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
  const [answers, setAnswers] = useState<QuestionnaireAnswers | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    setAnswers(loadAnswers(HOME_CUSTOMER));
  }, []);

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
            setAnswers(null);
          }}
        />
        <QuickActions />
        <AccountsList accounts={homeData.accounts} />
      </div>
    </div>
  );
}
