import { ChevronLeft, ChevronRight, LogOut, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { GoalCard } from "../components/GoalCard";
import { AccountsList, QuickActions } from "../components/HomeSections";
import { MonthPie } from "../components/MonthPie";
import { getMonthStory, listMonths, type MonthStory } from "../data/database";
import { homeData } from "../data/mock";
import { clearAnswers, loadAnswers, type QuestionnaireAnswers } from "../data/questionnaire";
import { QuestionnaireScreen } from "./QuestionnaireScreen";

const HOME_CUSTOMER = "CUST04457";

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

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(month: string) {
  const [year, index] = month.split("-");
  return `${MONTHS[Number(index) - 1]} ${year}`;
}

function asOfLabel(date: string) {
  const [year, month, day] = date.split("-");
  return `${Number(day)} ${MONTHS_SHORT[Number(month) - 1]} ${year}`;
}

export function HomeScreen() {
  const [months, setMonths] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [story, setStory] = useState<MonthStory | null>(null);
  const [open, setOpen] = useState(false);
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

  return (
    <div className="home-fit">
      <header className="topbar">
        <button className="icon-button" aria-label="Log out">
          <LogOut size={30} strokeWidth={1.8} />
        </button>
        <button className="icon-button icon-button--dot" aria-label="Chat">
          <MessageSquare size={30} strokeWidth={1.8} />
        </button>
      </header>

      {status === "error" ? (
        <div className="placeholder">
          <h1 className="section-title">Data unavailable</h1>
          <p>{error}</p>
        </div>
      ) : (
        <div className="home-story">
          <div className="month-nav">
            <button
              className="month-nav__button"
              type="button"
              aria-label="Previous month"
              disabled={index <= 0}
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft size={22} strokeWidth={2.2} />
            </button>
            <p className="data-eyebrow">{story ? monthLabel(story.month) : "Loading"}</p>
            <button
              className="month-nav__button"
              type="button"
              aria-label="Next month"
              disabled={index >= months.length - 1}
              onClick={() => setIndex((current) => Math.min(months.length - 1, current + 1))}
            >
              <ChevronRight size={22} strokeWidth={2.2} />
            </button>
          </div>

          {story && status === "ready" ? (
            <>
              <MonthPie
                monthTitle={monthLabel(story.month)}
                asOf={asOfLabel(story.asOf)}
                balanceEur={story.balanceEur}
                incomeEur={story.incomeEur}
                incomeDetail={story.incomeDetail}
                slices={story.slices}
                open={open}
                onToggle={() => setOpen((current) => !current)}
              />
            </>
          ) : (
            <p className="data-loading">Loading your data…</p>
          )}
        </div>
      )}
      <div className="tinted">
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
