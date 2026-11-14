import { LogOut, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { MonthSpendingCard } from "./components/MonthSpendingCard";
import { AccountsList, QuickActions } from "./components/HomeSections";
import { GoalCard } from "./components/GoalCard";
import { TabBar, type Tab } from "./components/TabBar";
import { listCustomers, type Customer } from "./data/database";
import { homeData } from "./data/mock";
import { clearAnswers, loadAnswers, type QuestionnaireAnswers } from "./data/questionnaire";
import { useSpendingMonths } from "./data/useSpending";
import { DataScreen } from "./screens/DataScreen";
import { MeScreen } from "./screens/MeScreen";
import { QuestionnaireScreen } from "./screens/QuestionnaireScreen";
import { SpendingAnalysis } from "./screens/SpendingAnalysis";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="placeholder">
      <h1 className="section-title">{title}</h1>
      <p>Not part of the prototype yet.</p>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  // Demo "signed-in" customer, shared by the home card, the analysis screen and the Bank tab.
  // Default: the young-adult profile (see DATA.md).
  const [customerId, setCustomerId] = useState("CUST03953");
  const [answers, setAnswers] = useState<QuestionnaireAnswers | null>(null);
  // Demo customers for the picker, loaded once and shared with the Me tab.
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersError, setCustomersError] = useState("");
  // Selected month (YYYY-MM). null = the latest month with data, i.e. the "current month".
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const { months } = useSpendingMonths(customerId);

  useEffect(() => {
    let active = true;
    listCustomers()
      .then((list) => active && setCustomers(list))
      .catch((cause: unknown) => active && setCustomersError(cause instanceof Error ? cause.message : String(cause)));
    return () => {
      active = false;
    };
  }, []);

  const month = months?.length
    ? pickedMonth && months.includes(pickedMonth)
      ? pickedMonth
      : months[months.length - 1]
    : null;

  useEffect(() => {
    setAnswers(loadAnswers(customerId));
  }, [customerId]);

  const changeTab = (next: Tab) => {
    setAnalysisOpen(false);
    setQuizOpen(false);
    setTab(next);
  };

  const resetGoal = () => {
    clearAnswers(customerId);
    setAnswers(null);
  };

  return (
    <div className="phone">
      {/* key: a new screen starts scrolled to the top */}
      <main className="screen" key={quizOpen ? "quiz" : analysisOpen ? "analysis" : tab}>
        {quizOpen ? (
          <QuestionnaireScreen
            customerId={customerId}
            initialAnswers={answers}
            onClose={() => setQuizOpen(false)}
            onSaved={(next) => {
              setAnswers(next);
              setQuizOpen(false);
            }}
          />
        ) : analysisOpen && month && months ? (
          <SpendingAnalysis
            customerId={customerId}
            month={month}
            months={months}
            onMonthChange={setPickedMonth}
            onBack={() => setAnalysisOpen(false)}
          />
        ) : (
          <>
            {tab === "home" && (
              <>
                <header className="topbar">
                  <button className="icon-button" aria-label="Log out">
                    <LogOut size={30} strokeWidth={1.8} />
                  </button>
                  <button className="icon-button icon-button--dot" aria-label="Chat">
                    <MessageSquare size={30} strokeWidth={1.8} />
                  </button>
                </header>
                <MonthSpendingCard
                  customerId={customerId}
                  month={month}
                  months={months}
                  onMonthChange={setPickedMonth}
                  onOpenAnalysis={() => setAnalysisOpen(true)}
                />
                <div className="tinted">
                  <GoalCard answers={answers} onEdit={() => setQuizOpen(true)} onReset={resetGoal} />
                  <QuickActions />
                  <AccountsList accounts={homeData.accounts} />
                </div>
              </>
            )}
            {tab === "etukortti" && <Placeholder title="S-Etukortti" />}
            {tab === "bank" && <DataScreen selectedId={customerId} />}
            {tab === "me" && (
              <MeScreen
                customers={customers}
                customersError={customersError}
                selectedId={customerId}
                onSelect={setCustomerId}
              />
            )}
          </>
        )}
      </main>
      <TabBar active={tab} onChange={changeTab} />
    </div>
  );
}
