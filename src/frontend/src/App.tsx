import { useEffect, useState } from "react";
import { TabBar, type Tab } from "./components/TabBar";
import { listCustomers, type Customer } from "./data/database";
import { DataScreen } from "./screens/DataScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MeScreen } from "./screens/MeScreen";

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
  // Demo customer shared by Home, Bank and the Me picker. ?customer=CUST03172 still works.
  const [customerId, setCustomerId] = useState(
    () => new URLSearchParams(window.location.search).get("customer") ?? "CUST04457",
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersError, setCustomersError] = useState("");

  useEffect(() => {
    let active = true;
    listCustomers()
      .then((list) => active && setCustomers(list))
      .catch((cause: unknown) => active && setCustomersError(cause instanceof Error ? cause.message : String(cause)));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="phone">
      <main className="screen">
        {tab === "home" && <HomeScreen customerId={customerId} />}
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
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
