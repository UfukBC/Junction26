import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "../src/server.mjs";

const config = {
  provider: "mock",
  model: "mock",
  apiKey: "",
  port: 0,
  timeoutMs: 2000,
  maxTokens: 200,
};

let base;
let app;

before(async () => {
  app = createServer(config);
  await new Promise((done) => app.server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

after(() => app.server.close());

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

const overviewBody = {
  year: 2025,
  totals: { spendingEur: 24000, incomeEur: 30000, monthsWithData: 12, averageMonthlySpendingEur: 2000 },
  months: [
    { month: "2025-01", spendingEur: 1800, incomeEur: 2500 },
    { month: "2025-02", spendingEur: null, incomeEur: null },
  ],
  goal: { label: "Emergency buffer", targetAmountEur: 6000 },
};

test("health reports the provider and endpoints", async () => {
  const response = await fetch(`${base}/api/health`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.provider, "mock");
  assert.ok(data.endpoints.includes("POST /api/ai/overview"));
});

test("overview returns deterministic text and is cached", async () => {
  const first = await post("/api/ai/overview", overviewBody);
  assert.equal(first.status, 200);
  assert.match(first.data.text, /2025/);
  const second = await post("/api/ai/overview", overviewBody);
  assert.deepEqual(second.data, first.data);
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.cacheEntries, 1);
});

test("mock narration respects the language field", async () => {
  const english = await post("/api/ai/overview", { ...overviewBody, year: 2024 });
  const finnish = await post("/api/ai/overview", { ...overviewBody, year: 2024, language: "fi" });
  assert.match(english.data.text, /you spent/);
  assert.match(finnish.data.text, /käytit/);
});

test("unknown language is rejected", async () => {
  const result = await post("/api/ai/overview", { ...overviewBody, language: "sv" });
  assert.equal(result.status, 400);
  assert.equal(result.data.error.code, "bad_request");
});

test("missing and oversized fields are rejected", async () => {
  const missing = await post("/api/ai/overview", { year: 2025 });
  assert.equal(missing.status, 400);
  assert.match(missing.data.error.message, /totals/);

  const badMonth = await post("/api/ai/month-summary", {
    month: "2025-13",
    spendingEur: 100,
    topCategories: [],
  });
  assert.equal(badMonth.status, 400);

  const big = await post("/api/ai/category", { category: "x".repeat(61), amountEur: 10, sharePct: 10 });
  assert.equal(big.status, 400);

  const huge = await post("/api/ai/overview", { ...overviewBody, months: Array(25).fill({ month: "2025-01" }) });
  assert.equal(huge.status, 400);
});

test("a body over the byte cap returns 413", async () => {
  const result = await post("/api/ai/category", "x".repeat(40_000));
  assert.equal(result.status, 413);
  assert.equal(result.data.error.code, "payload_too_large");
});

test("non-JSON bodies return a structured 400", async () => {
  const result = await post("/api/ai/category", "not json");
  assert.equal(result.status, 400);
  assert.equal(result.data.error.code, "bad_request");
});

test("month-summary, category and insight answer with text", async () => {
  const summary = await post("/api/ai/month-summary", {
    month: "2026-09",
    spendingEur: 2100,
    incomeEur: 2500,
    topCategories: [{ name: "Groceries", amountEur: 600, sharePct: 28.6 }],
    yearAverageMonthlySpendingEur: 1900,
  });
  assert.equal(summary.status, 200);
  assert.match(summary.data.text, /September 2026/);

  const category = await post("/api/ai/category", {
    category: "Restaurants",
    amountEur: 180,
    sharePct: 12.5,
    benchmarkSharePct: 7.8,
  });
  assert.match(category.data.text, /Restaurants/);

  const insight = await post("/api/ai/insight", {
    insights: [{ title: "Restaurants are 12.5 % of your spending" }],
    questionnaire: { goal: "understand_spending" },
  });
  assert.match(insight.data.text, /Restaurants/);
});

test("what-if states the saving", async () => {
  const result = await post("/api/ai/what-if", {
    scenario: "you cut restaurants by 20 %",
    baseline: { spendingEur: 2100 },
    result: { spendingEur: 2064 },
  });
  assert.equal(result.status, 200);
  assert.match(result.data.text, /36/);
});

test("segment advice keeps the summary/recommendation contract", async () => {
  const result = await post("/api/segment-advice", {
    month: "April 2026",
    segment: "Restaurants",
    brief: "Restaurants: 36,82 € in April 2026.",
  });
  assert.equal(result.status, 200);
  assert.equal(typeof result.data.summary, "string");
  assert.equal(typeof result.data.recommendation, "string");
});

test("cache clear reports how many entries it dropped", async () => {
  const result = await post("/api/cache/clear", {});
  assert.equal(result.status, 200);
  assert.ok(result.data.cleared >= 1);
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.cacheEntries, 0);
});

test("unknown routes are 404 and wrong methods are 405", async () => {
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  assert.equal((await fetch(`${base}/api/ai/overview`)).status, 405);
  assert.equal((await fetch(`${base}/api/cache/clear`)).status, 405);
});
