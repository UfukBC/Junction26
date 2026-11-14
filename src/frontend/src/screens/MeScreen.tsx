import type { Customer } from "../data/database";

/** Me tab: pick which synthetic S-Pankki customer the app is exploring. */
export function MeScreen({
  customers,
  customersError,
  selectedId,
  onSelect,
}: {
  customers: Customer[];
  customersError: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="me-screen">
      <header className="data-hero">
        <p className="data-eyebrow">Demo data</p>
        <h1 className="data-title">Your profile</h1>
        <p className="data-sub">
          Switch the synthetic S-Pankki customer you are exploring. Bank and Home follow your choice.
        </p>
      </header>

      {customersError && <p className="spend--placeholder">Customers unavailable: {customersError}</p>}

      <section className="data-users" aria-label="Choose a customer">
        {customers.map((customer) => (
          <button
            key={customer.id}
            type="button"
            className={`data-user ${customer.id === selectedId ? "data-user--active" : ""}`}
            aria-pressed={customer.id === selectedId}
            onClick={() => onSelect(customer.id)}
          >
            <span className="data-user__id">{customer.id}</span>
            <span className="data-user__meta">
              {customer.age} yrs · {customer.postalCode}
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}
