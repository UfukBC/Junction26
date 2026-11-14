import { useEffect, useState } from "react";
import { buildPeerBaseline, type PeerBaseline } from "./benchmarkComparison";
import { getMonthlyFlow, getSpendingByCategory, monthRange } from "./database";

const cache = new Map<string, PeerBaseline | null>();

/** Loads the 12-month baseline from SQLite. Cached per customer in memory. */
export async function loadPeerBaseline(customerId: string): Promise<PeerBaseline | null> {
  const cached = cache.get(customerId);
  if (cached !== undefined) return cached;

  const allFlows = await getMonthlyFlow(customerId);
  if (allFlows.length === 0) {
    cache.set(customerId, null);
    return null;
  }

  // Use the last 12 months available in the customer's dataset
  const flows = allFlows.slice(-12);
  const startMonth = flows[0].month;
  const endMonth = flows[flows.length - 1].month;
  const { startDate } = monthRange(startMonth);
  const { endDate } = monthRange(endMonth);

  const categories = await getSpendingByCategory(customerId, { startDate, endDate });
  const result = buildPeerBaseline(flows, categories);
  cache.set(customerId, result);
  return result;
}

/** Hook: returns the customer's 12-month peer baseline (band, category averages). */
export function usePeerBenchmark(customerId: string): PeerBaseline | null {
  const [baseline, setBaseline] = useState<PeerBaseline | null>(() => cache.get(customerId) ?? null);

  useEffect(() => {
    let active = true;
    loadPeerBaseline(customerId)
      .then((res) => {
        if (active) setBaseline(res);
      })
      .catch(() => {
        if (active) setBaseline(null);
      });

    return () => {
      active = false;
    };
  }, [customerId]);

  return baseline;
}
