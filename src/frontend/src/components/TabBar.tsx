import { User, Wallet } from "lucide-react";
import { HomeGlyph, SGlyph } from "./icons";

export type Tab = "home" | "etukortti" | "bank" | "me";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "etukortti", label: "S-Etukortti" },
  { id: "bank", label: "Bank" },
  { id: "me", label: "Me" },
];

function TabIcon({ id, active }: { id: Tab; active: boolean }) {
  const color = active ? "var(--green-bright)" : "var(--gray-icon)";
  switch (id) {
    case "home":
      return <HomeGlyph size={30} color={color} filled={active} />;
    case "etukortti":
      return <SGlyph size={30} color={color} />;
    case "bank":
      return <Wallet size={28} strokeWidth={1.6} color={color} />;
    case "me":
      return <User size={28} strokeWidth={1.6} color={color} />;
  }
}

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab ${active === t.id ? "tab--active" : ""}`}
          aria-current={active === t.id ? "page" : undefined}
          onClick={() => onChange(t.id)}
        >
          <TabIcon id={t.id} active={active === t.id} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
