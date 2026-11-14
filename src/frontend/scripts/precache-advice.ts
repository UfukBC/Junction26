/**
 * Generate the static AI answers that ship with the demo: one overview per month and per sub-menu
 * (month overview, income, fixed, left and every Everyday category). The app then runs with no backend.
 *
 *   npm run build:ai-cache                       # default demo customer, all months
 *   npm run build:ai-cache -- --dry-run          # list what would be generated, no API calls
 *   npm run build:ai-cache -- --customers CUST04457,CUST03172 --force
 *
 * Needs VERDA_INFERENCE_KEY (in .env or the environment). Existing answers are kept unless --force,
 * so a long run can be resumed after an interruption without paying for the same prompt twice.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { loadEnv } from "vite";
import { OVERVIEW, brief, factsFor, monthTitle, trailingTwelveMonths } from "../src/data/adviceBrief";
import type {
  CategoryMonthSpend,
  CategorySpend,
  LargePurchase,
  MonthlyFlow,
  MonthStory,
  PlaceHabit,
} from "../src/data/database";
import { requestSegmentAdvice, TRAINER_SYSTEM } from "../src/server/segmentAdvice";
import { claudeAgent, nemotronAgent } from "../src/server/agents";
import { runDeepAnalysis, type DeepResult } from "../src/server/deepAnalysis";
import { fetchMoneyNews } from "../src/server/news";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(__dirname, "..");

interface Args {
  customers: string[];
  out: string;
  db: string;
  concurrency: number;
  force: boolean;
  dryRun: boolean;
  limit: number | null;
  /** Generate deep-thinking answers instead of the normal overviews. */
  deepOnly: boolean;
  deepOut: string;
  deepConcurrency: number;
  deepSegments: string[];
  deepForce: boolean;
  deepLimit: number | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    customers: ["CUST04457"],
    out: path.join(FRONTEND, "public/data/ai-cache.json"),
    db: path.join(FRONTEND, "public/data/s_pankki-demo.db"),
    concurrency: 4,
    force: false,
    dryRun: false,
    limit: null,
    deepOnly: false,
    deepOut: path.join(FRONTEND, "public/data/ai-deep-cache.json"),
    deepConcurrency: 2,
    // The whole-month targets the Deep thinking button can be turned on for. (Everyday opens its own view.)
    deepSegments: [OVERVIEW, "Income", "Fixed", "Left"],
    deepForce: false,
    deepLimit: null,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];
    if (arg === "--customer" || arg === "--customers") args.customers = (next() ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--out") args.out = path.resolve(next() ?? args.out);
    else if (arg === "--db") args.db = path.resolve(next() ?? args.db);
    else if (arg === "--concurrency") args.concurrency = Math.max(1, Number(next()) || args.concurrency);
    else if (arg === "--limit") args.limit = Math.max(1, Number(next()) || 1);
    else if (arg === "--force") args.force = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--deep-only") args.deepOnly = true;
    else if (arg === "--deep-out") args.deepOut = path.resolve(next() ?? args.deepOut);
    else if (arg === "--deep-concurrency") args.deepConcurrency = Math.max(1, Number(next()) || args.deepConcurrency);
    else if (arg === "--deep-segments") args.deepSegments = (next() ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--deep-force") args.deepForce = true;
    else if (arg === "--deep-limit") args.deepLimit = Math.max(1, Number(next()) || 1);
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: vite-node scripts/precache-advice.ts [--customers CUST04457,CUST03172] [--out path] [--concurrency 4] [--limit N] [--force] [--dry-run]\n" +
          "       vite-node scripts/precache-advice.ts --deep-only [--deep-out path] [--deep-concurrency 2] [--deep-limit N] [--deep-force] [--dry-run]\n" +
          `       --deep-segments defaults to: ${[OVERVIEW, "Income", "Fixed", "Left"].join(", ")}`,
      );
      process.exit(0);
    }
  }
  return args;
}

/* ------------------------------------------------------------------ DB */

const NOT_SPENDING = `category NOT IN ('Salary Sweep', 'Invest Deposit')`;
const pad2 = (n: number) => String(n).padStart(2, "0");

function monthRange(month: string): { startDate: string; endDate: string } {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${pad2(lastDay)}` };
}

function rangeClause(range?: { startDate?: string; endDate?: string }) {
  const clauses: string[] = [];
  const params: string[] = [];
  if (range?.startDate) {
    clauses.push("tx_date >= ?");
    params.push(range.startDate);
  }
  if (range?.endDate) {
    clauses.push("tx_date <= ?");
    params.push(range.endDate);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

function query(db: any, sql: string, params: unknown[] = []): any[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function listMonths(db: any, customerId: string): string[] {
  return query(
    db,
    `SELECT DISTINCT substr(tx_date, 1, 7) AS month FROM transactions WHERE customer_id = ? ORDER BY month`,
    [customerId],
  ).map((row) => row.month);
}

function monthStory(db: any, customerId: string, month: string): MonthStory | null {
  const rows = query(
    db,
    `SELECT transaction_type AS type, category, COUNT(*) AS count, SUM(tx_amount_eur) AS totalEur
     FROM transactions WHERE customer_id = ? AND substr(tx_date, 1, 7) = ?
     GROUP BY transaction_type, category`,
    [customerId, month],
  );
  const end = query(
    db,
    `SELECT tx_date AS date, balance_after_eur AS balanceEur FROM transactions
     WHERE customer_id = ? AND substr(tx_date, 1, 7) = ?
     ORDER BY tx_ts_iso DESC, id DESC LIMIT 1`,
    [customerId, month],
  )[0];
  if (!end) return null;

  const round2 = (value: number) => Math.round(value * 100) / 100;
  const incomeRows = rows.filter((row) => row.totalEur > 0);
  const incomeEur = round2(incomeRows.reduce((sum, row) => sum + row.totalEur, 0));
  const incomeDetail = incomeRows.length > 0 && incomeRows.every((row) => row.category === "Salary") ? "Salary" : "Income";
  const fixedEur = round2(
    -rows.filter((row) => row.type === "housing_payment" || row.type === "utilities_payment").reduce((sum, row) => sum + row.totalEur, 0),
  );
  const purchases = rows.filter((row) => row.type === "purchase");
  const everydayEur = round2(-purchases.reduce((sum, row) => sum + row.totalEur, 0));
  const categories = purchases
    .map((row) => ({ name: row.category, count: row.count, valueEur: round2(-row.totalEur) }))
    .sort((a, b) => b.valueEur - a.valueEur);
  const leftEur = round2(incomeEur - fixedEur - everydayEur);

  return {
    month,
    asOf: end.date,
    balanceEur: end.balanceEur,
    incomeEur,
    incomeDetail,
    calm: leftEur >= 0,
    slices: [
      { name: "Fixed", detail: "Housing and utilities", valueEur: fixedEur },
      { name: "Everyday", detail: "Tap for categories", valueEur: everydayEur, categories },
      { name: "Left", detail: leftEur >= 0 ? "Still in the account" : "Spent past the income", valueEur: leftEur },
    ],
  };
}

function frequentPlaces(db: any, customerId: string, range: { startDate: string; endDate: string }): PlaceHabit[] {
  const { sql: rangeSql, params: rangeParams } = rangeClause(range);
  const buckets = query(
    db,
    `SELECT t.merchant_id AS merchantId, t.mcc_code AS mccCode, COALESCE(MAX(m.name), t.merchant_id) AS name,
       t.category AS category, COUNT(*) AS visits, -SUM(t.tx_amount_eur) AS totalEur, MAX(t.tx_date) AS lastDate,
       CAST(strftime('%w', t.tx_date) AS INTEGER) AS weekday, CAST(substr(t.tx_ts_iso, 12, 2) AS INTEGER) AS hour
     FROM transactions t LEFT JOIN merchants m ON m.merchant_id = t.merchant_id AND m.mcc_code = t.mcc_code
     WHERE t.customer_id = ? AND t.transaction_type = 'purchase'
       AND t.merchant_id IS NOT NULL AND t.merchant_id <> '' AND t.tx_ts_iso IS NOT NULL${rangeSql}
     GROUP BY t.merchant_id, t.mcc_code, weekday, hour`,
    [customerId, ...rangeParams],
  );

  const places = new Map<string, any>();
  for (const bucket of buckets) {
    const key = `${bucket.merchantId}|${bucket.mccCode}`;
    let place = places.get(key);
    if (!place) {
      place = {
        merchantId: bucket.merchantId,
        name: bucket.name,
        category: bucket.category,
        visits: 0,
        totalEur: 0,
        lastDate: bucket.lastDate,
        weekday: null,
        hour: null,
        weekdayCounts: new Map<number, number>(),
        hourCounts: new Map<number, number>(),
      };
      places.set(key, place);
    }
    place.visits += bucket.visits;
    place.totalEur += bucket.totalEur;
    if (bucket.lastDate > place.lastDate) place.lastDate = bucket.lastDate;
    place.weekdayCounts.set(bucket.weekday, (place.weekdayCounts.get(bucket.weekday) ?? 0) + bucket.visits);
    place.hourCounts.set(bucket.hour, (place.hourCounts.get(bucket.hour) ?? 0) + bucket.visits);
  }

  const topKey = (counts: Map<number, number>): number | null => {
    let bestKey: number | null = null;
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }
    return bestKey !== null && bestCount > 0 ? bestKey : null;
  };

  return [...places.values()]
    .map(({ weekdayCounts, hourCounts, ...place }) => {
      const weekday = topKey(weekdayCounts);
      const hour = topKey(hourCounts);
      return {
        ...place,
        weekday: weekday !== null && (weekdayCounts.get(weekday) ?? 0) / place.visits >= 0.3 ? weekday : null,
        hour: hour !== null && (hourCounts.get(hour) ?? 0) / place.visits >= 0.35 ? hour : null,
      };
    })
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 4);
}

function largestPurchases(db: any, customerId: string, range: { startDate: string; endDate: string }): LargePurchase[] {
  const { sql: rangeSql, params: rangeParams } = rangeClause(range);
  return query(
    db,
    `SELECT t.tx_date AS date, COALESCE(m.name, t.merchant_id, t.category) AS name, t.category AS category,
       -t.tx_amount_eur AS amountEur
     FROM transactions t LEFT JOIN merchants m ON m.merchant_id = t.merchant_id AND m.mcc_code = t.mcc_code
     WHERE t.customer_id = ? AND t.transaction_type = 'purchase' AND t.tx_amount_eur < 0${rangeSql} AND -t.tx_amount_eur >= ?
     ORDER BY t.tx_amount_eur ASC LIMIT ?`,
    [customerId, ...rangeParams, 40, 4],
  );
}

function monthlyFlow(db: any, customerId: string): MonthlyFlow[] {
  const rows = query(
    db,
    `SELECT substr(tx_date, 1, 7) AS month,
       SUM(CASE WHEN tx_amount_eur > 0 THEN tx_amount_eur ELSE 0 END) AS incomeEur,
       -SUM(CASE WHEN tx_amount_eur < 0 AND ${NOT_SPENDING} THEN tx_amount_eur ELSE 0 END) AS spendingEur
     FROM transactions WHERE customer_id = ? GROUP BY month ORDER BY month`,
    [customerId],
  );
  return rows.map((row) => ({ ...row, netEur: row.incomeEur - row.spendingEur }));
}

function spendingByCategory(db: any, customerId: string, range: { startDate: string; endDate: string }): CategorySpend[] {
  const { sql: rangeSql, params: rangeParams } = rangeClause(range);
  const rows = query(
    db,
    `SELECT category, -SUM(tx_amount_eur) AS totalEur, COUNT(*) AS count FROM transactions
     WHERE customer_id = ? AND tx_amount_eur < 0 AND ${NOT_SPENDING}${rangeSql}
     GROUP BY category ORDER BY totalEur DESC`,
    [customerId, ...rangeParams],
  );
  const total = rows.reduce((sum, row) => sum + row.totalEur, 0);
  return rows.map((row) => ({ ...row, share: total > 0 ? row.totalEur / total : 0 }));
}

function categoryMonthly(db: any, customerId: string, category: string): CategoryMonthSpend[] {
  return query(
    db,
    `SELECT substr(tx_date, 1, 7) AS month, -SUM(tx_amount_eur) AS totalEur, COUNT(*) AS count FROM transactions
     WHERE customer_id = ? AND category = ? AND tx_amount_eur < 0 AND transaction_type = 'purchase'
     GROUP BY month ORDER BY month`,
    [customerId, category],
  );
}

/* --------------------------------------------------------------- tasks */

interface Task {
  customerId: string;
  month: string;
  monthTitle: string;
  segment: string;
  brief: string;
}

function targetsFor(story: MonthStory): string[] {
  const categories = story.slices.find((slice) => slice.name === "Everyday")?.categories?.map((row) => row.name) ?? [];
  return [...new Set([OVERVIEW, "Income", "Fixed", "Left", ...categories])];
}

function tasksFor(db: any, customerId: string): Task[] {
  const tasks: Task[] = [];
  const categoryHistory = new Map<string, CategoryMonthSpend[]>();
  for (const month of listMonths(db, customerId)) {
    const story = monthStory(db, customerId, month);
    if (!story) continue;
    const range = monthRange(month);
    const places = frequentPlaces(db, customerId, range);
    const largest = largestPurchases(db, customerId, range);
    const flows = monthlyFlow(db, customerId);
    const categorySpends = spendingByCategory(db, customerId, trailingTwelveMonths(month));
    const title = monthTitle(month);
    for (const segment of targetsFor(story)) {
      const isCategory = segment !== OVERVIEW && segment !== "Income" && segment !== "Fixed" && segment !== "Left";
      let months: CategoryMonthSpend[] = [];
      if (isCategory) {
        if (!categoryHistory.has(segment)) categoryHistory.set(segment, categoryMonthly(db, customerId, segment));
        months = categoryHistory.get(segment)!;
      }
      const facts = factsFor(story, segment, places, largest, flows, categorySpends, months);
      tasks.push({ customerId, month, monthTitle: title, segment, brief: brief(title, story, segment, facts) });
    }
  }
  return tasks;
}

/* ------------------------------------------------------------- running */

function entryKey(customerId: string, month: string, segment: string): string {
  return `${customerId}|${month}|${segment}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------------------------------------------- deep answers */

async function generateDeep(db: any, args: Args, apiKey: string, anthropicKey: string | undefined): Promise<void> {
  const existing: Record<string, DeepResult> = {};
  if (fs.existsSync(args.deepOut) && !args.deepForce) {
    try {
      const parsed = JSON.parse(fs.readFileSync(args.deepOut, "utf8")) as { entries?: typeof existing };
      Object.assign(existing, parsed.entries ?? {});
    } catch {
      // Unreadable previous file: rebuild it from scratch.
    }
  }

  let tasks = args.customers
    .flatMap((customerId) => tasksFor(db, customerId))
    .filter((task) => args.deepSegments.includes(task.segment));
  if (args.deepLimit !== null) tasks = tasks.slice(0, args.deepLimit);
  const pending = tasks.filter(
    (task) => args.deepForce || !existing[entryKey(task.customerId, task.month, task.segment)],
  );

  console.log(
    `${tasks.length} deep answers across ${args.customers.length} customer(s); ${tasks.length - pending.length} already cached, ${pending.length} to generate.`,
  );
  if (args.dryRun) {
    for (const task of pending.slice(0, 20)) {
      console.log(`  ${task.customerId} ${task.month} · ${task.segment}`);
    }
    if (pending.length > 20) console.log(`  …and ${pending.length - 20} more`);
    return;
  }
  if (pending.length === 0) return;

  const news = await fetchMoneyNews();
  let done = 0;
  let failed = 0;
  // Written after every answer, so an interrupted run can be resumed with the same flags.
  const save = () => {
    const output = {
      version: 1,
      generatedAt: new Date().toISOString(),
      customers: args.customers,
      entries: existing,
    };
    fs.mkdirSync(path.dirname(args.deepOut), { recursive: true });
    fs.writeFileSync(args.deepOut, JSON.stringify(output, null, 2) + "\n");
  };
  const worker = async () => {
    for (;;) {
      const task = pending.shift();
      if (!task) return;
      const label = `${task.customerId} ${task.month} · ${task.segment}`;
      let result: DeepResult | null = null;
      for (let attempt = 1; attempt <= 2 && !result; attempt += 1) {
        try {
          result = await runDeepAnalysis({
            segment: task.segment,
            brief: task.brief,
            news,
            analyst: nemotronAgent(apiKey),
            reviewer: claudeAgent(anthropicKey),
            // Same rules as the normal overview, exactly as the dev server runs it.
            guidance: TRAINER_SYSTEM,
            emit: () => undefined,
          });
          if (!result) throw new Error("no agent answered");
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          if (attempt === 2) {
            failed += 1;
            console.error(`  ✗ ${label}: ${message}`);
          } else {
            await sleep(1000 * attempt);
          }
        }
      }
      if (result) {
        existing[entryKey(task.customerId, task.month, task.segment)] = result;
        done += 1;
        save();
        console.log(`  ✓ [${done + failed}/${done + failed + pending.length}] ${label} (${result.verdict})`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(args.deepConcurrency, pending.length) }, worker));

  save();
  const size = fs.statSync(args.deepOut).size;
  console.log(
    `Wrote ${path.relative(FRONTEND, args.deepOut)} (${(size / 1024).toFixed(1)} KB): ${Object.keys(existing).length} deep answers, ${done} generated, ${failed} failed.`,
  );
  if (failed > 0) process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEnv("development", FRONTEND, "");
  const apiKey = process.env.VERDA_INFERENCE_KEY || env.VERDA_INFERENCE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || undefined;
  if (!apiKey && !args.dryRun) {
    throw new Error("VERDA_INFERENCE_KEY is not set (add it to src/frontend/.env)");
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(args.db));

  if (args.deepOnly) {
    await generateDeep(db, args, apiKey!, anthropicKey);
    db.close();
    return;
  }

  const existing: Record<string, { summary: string; recommendation: string; source?: string }> = {};
  if (fs.existsSync(args.out) && !args.force) {
    try {
      const parsed = JSON.parse(fs.readFileSync(args.out, "utf8")) as { entries?: typeof existing };
      Object.assign(existing, parsed.entries ?? {});
    } catch {
      // Unreadable previous file: rebuild it from scratch.
    }
  }

  let tasks = args.customers.flatMap((customerId) => tasksFor(db, customerId));
  if (args.limit !== null) tasks = tasks.slice(0, args.limit);
  const pending = tasks.filter(
    (task) => args.force || !existing[entryKey(task.customerId, task.month, task.segment)],
  );

  console.log(
    `${tasks.length} answers across ${args.customers.length} customer(s); ${tasks.length - pending.length} already cached, ${pending.length} to generate.`,
  );
  if (args.dryRun) {
    for (const task of pending.slice(0, 20)) {
      console.log(`  ${task.customerId} ${task.month} · ${task.segment}`);
    }
    if (pending.length > 20) console.log(`  …and ${pending.length - 20} more`);
    return;
  }

  let done = 0;
  let failed = 0;
  // Written after every answer, so an interrupted run can be resumed with the same flag set.
  const save = () => {
    const output = {
      version: 1,
      generatedAt: new Date().toISOString(),
      customers: args.customers,
      entries: existing,
    };
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(output, null, 2) + "\n");
  };
  const worker = async () => {
    for (;;) {
      const task = pending.shift();
      if (!task) return;
      const label = `${task.customerId} ${task.month} · ${task.segment}`;
      let answer: { summary: string; recommendation: string } | null = null;
      for (let attempt = 1; attempt <= 3 && !answer; attempt += 1) {
        try {
          answer = await requestSegmentAdvice(apiKey!, task.brief);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          if (attempt === 3) {
            failed += 1;
            console.error(`  ✗ ${label}: ${message}`);
          } else {
            await sleep(1000 * attempt);
          }
        }
      }
      if (answer) {
        existing[entryKey(task.customerId, task.month, task.segment)] = { ...answer, source: "nemotron-3.5-super-vl" };
        done += 1;
        save();
        console.log(`  ✓ [${done + failed}/${done + failed + pending.length}] ${label}`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(args.concurrency, pending.length || 1) }, worker));

  db.close();
  save();
  const size = fs.statSync(args.out).size;
  console.log(
    `Wrote ${path.relative(FRONTEND, args.out)} (${(size / 1024).toFixed(1)} KB): ${Object.keys(existing).length} answers, ${done} generated, ${failed} failed.`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
