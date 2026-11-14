import { LogOut, MessageSquare } from "lucide-react";
import { useState } from "react";
import { BonusCarousel } from "./components/BonusCarousel";
import { AccountsList, MessagesCard, QuickActions } from "./components/HomeSections";
import { TabBar, type Tab } from "./components/TabBar";
import { homeData } from "./data/mock";

function HomeScreen() {
  return (
    <>
      <header className="topbar">
        <button className="icon-button" aria-label="Log out">
          <LogOut size={30} strokeWidth={1.8} />
        </button>
        <button className="icon-button icon-button--dot" aria-label="Chat">
          <MessageSquare size={30} strokeWidth={1.8} />
        </button>
      </header>
      <BonusCarousel bonus={homeData.bonus} />
      <div className="tinted">
        <MessagesCard unread={homeData.unreadMessages} />
        <QuickActions />
        <AccountsList accounts={homeData.accounts} />
      </div>
    </>
  );
}

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
  return (
    <div className="phone">
      <main className="screen">
        {tab === "home" && <HomeScreen />}
        {tab === "etukortti" && <Placeholder title="S-Etukortti" />}
        {tab === "bank" && <Placeholder title="Bank" />}
        {tab === "me" && <Placeholder title="Me" />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
