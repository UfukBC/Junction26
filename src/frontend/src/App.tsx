import { useState } from "react";
import { TabBar, type Tab } from "./components/TabBar";
import { DataScreen } from "./screens/DataScreen";
import { HomeScreen } from "./screens/HomeScreen";

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
        {tab === "bank" && <DataScreen />}
        {tab === "me" && <Placeholder title="Me" />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
