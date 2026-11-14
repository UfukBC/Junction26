import { useEffect, useState } from "react";
import { getCustomerDashboard, type CustomerDashboard } from "../data/database";
import { formatEur, formatPercent } from "../format";

type Status = "loading" | "ready" | "error";

/** Bank tab. The customer is chosen on the Me tab, so `selectedId` comes from the app. */
export function DataScreen({ selectedId }: { selectedId?: string }) {
  const [dashboard, setDashboard] = useState<CustomerDashboard | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setStatus("loading");
    getCustomerDashboard(selectedId)
      .then((next) => {
        if (!active) return;
        setDashboard(next);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  if (status === "error") {
    return (
      <div className="placeholder">
        <h1 className="section-title">Data unavailable</h1>
        <p>{error}</p>
      </div>
    );
  }

  const maxCategory = dashboard?.categories[0]?.totalEur ?? 1;

  return (
    <div className="data-screen">
      <header className="data-hero">
        <p className="data-eyebrow">Demo data</p>
        <h1 className="data-title">Your money, decoded</h1>
        <p className="data-sub">
          Synthetic S-Pankki data, queried in the browser from a slim SQLite file.
        </p>
      </header>

      {status === "loading" || !dashboard ? (
        <p className="data-loading">Loading your data…</p>
      ) : (
        <>
          <section className="data-kpis" aria-label="Summary">
            <div className="data-kpi">
              <span className="data-kpi__label">Balance</span>
              <span className="data-kpi__value">
                {formatEur(dashboard.summary.latestBalanceEur ?? 0)}
              </span>
            </div>
            <div className="data-kpi">
              <span className="data-kpi__label">Income</span>
              <span className="data-kpi__value data-kpi__value--pos">
                {formatEur(dashboard.summary.incomeEur)}
              </span>
            </div>
            <div className="data-kpi">
              <span className="data-kpi__label">Spending</span>
              <span className="data-kpi__value">{formatEur(dashboard.summary.spendingEur)}</span>
            </div>
            <div className="data-kpi">
              <span className="data-kpi__label">Net</span>
              <span
                className={`data-kpi__value ${
                  dashboard.summary.netEur >= 0 ? "data-kpi__value--pos" : "data-kpi__value--neg"
                }`}
              >
                {formatEur(dashboard.summary.netEur)}
              </span>
            </div>
          </section>

          <section className="data-panel">
            <div className="data-panel__head">
              <h2>Where the money goes</h2>
              <span>{dashboard.categories.reduce((sum, category) => sum + category.count, 0)} purchases</span>
            </div>
            <ul className="data-cats">
              {dashboard.categories.map((category) => (
                <li key={category.category} className="data-cat">
                  <div className="data-cat__row">
                    <span className="data-cat__name">{category.category}</span>
                    <span className="data-cat__value">{formatEur(category.totalEur)}</span>
                  </div>
                  <div className="data-cat__track">
                    <div
                      className="data-cat__bar"
                      style={{ width: `${Math.max(4, (category.totalEur / maxCategory) * 100)}%` }}
                    />
                  </div>
                  <span className="data-cat__share">{formatPercent(category.share * 100)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="data-panel">
            <div className="data-panel__head">
              <h2>Recent transactions</h2>
              <span>{dashboard.customer.id}</span>
            </div>
            <ul className="data-txs">
              {dashboard.recentTransactions.map((tx, index) => (
                <li className="data-tx" key={`${tx.id}-${index}`}>
                  <div className="data-tx__main">
                    <span className="data-tx__cat">{tx.category}</span>
                    <span className="data-tx__meta">
                      {tx.date}
                      {tx.merchantId ? ` · ${tx.merchantId}` : ""}
                    </span>
                  </div>
                  <span className={`data-tx__amount ${tx.amountEur > 0 ? "is-pos" : ""}`}>
                    {formatEur(tx.amountEur)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {dashboard.mortgage && (
            <section className="data-panel data-mortgage">
              <div className="data-mortgage__head">
                <div>
                  <h2>Mortgage application</h2>
                  <p>
                    {dashboard.mortgage.link.mortgageId} ·{" "}
                    {dashboard.mortgage.events.length} events
                  </p>
                </div>
                <span
                  className={`data-decision data-decision--${dashboard.mortgage.link.decision ?? "pending"}`}
                >
                  {dashboard.mortgage.link.decision ?? "pending"}
                </span>
              </div>
              <div className="data-mortgage__figs">
                <div>
                  <span>Property</span>
                  <strong>{formatEur(dashboard.mortgage.link.propertyPriceEur ?? 0)}</strong>
                </div>
                <div>
                  <span>Loan</span>
                  <strong>{formatEur(dashboard.mortgage.link.loanEur ?? 0)}</strong>
                </div>
                <div>
                  <span>LTV</span>
                  <strong>{formatPercent((dashboard.mortgage.link.loanToValue ?? 0) * 100)}</strong>
                </div>
              </div>
              {dashboard.mortgage.link.rejectionReason && (
                <p className="data-mortgage__reason">
                  Reason: {dashboard.mortgage.link.rejectionReason.replace(/_/g, " ")}
                </p>
              )}
              <ol className="data-events">
                {dashboard.mortgage.events.slice(-5).map((event, index) => (
                  <li key={`${event.eventType}-${index}`}>
                    <span className="data-events__type">
                      {event.eventType.replace(/_/g, " ")}
                    </span>
                    <span className="data-events__time">{event.timestamp}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
