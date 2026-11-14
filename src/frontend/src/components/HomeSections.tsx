import { ArrowLeftRight, Bookmark, ChevronRight, MapPin, Plus } from "lucide-react";
import type { Account } from "../data/mock";
import { formatEur } from "../format";
import { AccountGlyph, CardGlyph } from "./icons";

export function SavingPrompt({ onPress }: { onPress: () => void }) {
  return (
    <button className="saving-prompt" type="button" onClick={onPress}>
      <span>What do you save for?</span>
      <ChevronRight size={18} strokeWidth={2.2} />
    </button>
  );
}

const ACTIONS = [
  { label: "New payment", Icon: Plus },
  { label: "Own transfer", Icon: ArrowLeftRight },
  { label: "Benefits nearby", Icon: MapPin },
  { label: "Saved benefits", Icon: Bookmark },
];

export function QuickActions() {
  return (
    <nav className="actions" aria-label="Quick actions">
      {ACTIONS.map(({ label, Icon }) => (
        <button key={label} className="action">
          <span className="action__circle">
            <Icon size={28} strokeWidth={2} />
          </span>
          <span className="action__label">{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function AccountsList({ accounts }: { accounts: Account[] }) {
  return (
    <section>
      <h2 className="section-title">Accounts and cards</h2>
      <div className="card accounts">
        {accounts.map((a) => (
          <button key={a.id} className="account-row">
            <span className="account-row__icon">{a.kind === "card" ? <CardGlyph /> : <AccountGlyph />}</span>
            <span className="account-row__text">
              <span className="account-row__name">{a.name}</span>
              {a.detail && <span className="account-row__detail">{a.detail}</span>}
            </span>
            {a.balanceEur !== undefined && <span className="account-row__balance">{formatEur(a.balanceEur)}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
