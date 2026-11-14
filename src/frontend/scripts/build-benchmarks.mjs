// Builds src/data/benchmarks.json from Statistics Finland's public PxWeb API.
// Source: Household Budget Survey 2022 (ktutk), tables 14pg (consumption by
// income quintile) and 14qa (background by income quintile). CC BY 4.0.
//
//   node scripts/build-benchmarks.mjs
//
// Requires network access. The output is committed, so the app builds offline.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const API = "https://pxdata.stat.fi/PXWeb/api/v1";
const TABLE = "StatFin/ktutk";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/data/benchmarks.json");

const QUINTILES = [
  { id: "all", fi: "Kaikki kotitaloudet", en: "All households" },
  { id: "q1", fi: "I (pienituloisimmat 20 %)", en: "Q1 (lowest 20%)" },
  { id: "q2", fi: "II", en: "Q2" },
  { id: "q3", fi: "III", en: "Q3" },
  { id: "q4", fi: "IV", en: "Q4" },
  { id: "q5", fi: "V (suurituloisimmat 20 %)", en: "Q5 (highest 20%)" },
];
const QUINTILE_CODES = ["SS", "1", "2", "3", "4", "5"];

async function pxwebPost(path, body) {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function metadata(lang, table) {
  const res = await fetch(`${API}/${lang}/${TABLE}/${table}`);
  if (!res.ok) throw new Error(`metadata ${lang}/${table}: ${res.status}`);
  return res.json();
}

function stripPrefix(text) {
  return text.replace(/^\S+\s+/, "");
}

function valuesFor(dataset, dims) {
  // json-stat2 values are row-major, dimensions in declared order.
  const dim = (code) => dataset.dimension[code].category.index;
  const sizes = dataset.id.map((code) => dataset.size[dataset.id.indexOf(code)]);
  return { dim, sizes };
}

async function main() {
  const [fiMeta, enMeta] = await Promise.all([
    metadata("fi", "14pg.px"),
    metadata("en", "14pg.px"),
  ]);
  const coicopFi = fiMeta.variables.find((v) => v.code.startsWith("coicop"));
  const coicopEn = enMeta.variables.find((v) => v.code.startsWith("coicop"));
  const enLabel = new Map(coicopEn.values.map((v, i) => [v, coicopEn.valueTexts[i]]));
  const fiLabel = new Map(coicopFi.values.map((v, i) => [v, coicopFi.valueTexts[i]]));

  // Main COICOP groups (2 chars) and second-level groups (3 chars).
  const codes = coicopFi.values.filter(
    (v) => (v.length === 2 || v.length === 3) && v !== "77" && v !== "99"
  );

  const body = {
    query: [
      { code: "timeperiod_y", selection: { filter: "item", values: ["2022"] } },
      { code: coicopFi.code, selection: { filter: "item", values: codes } },
      { code: "tuloviidennes_2_20140501", selection: { filter: "item", values: QUINTILE_CODES } },
      {
        code: "contentscode",
        selection: {
          filter: "item",
          values: [
            "kulu_kt_hk_1_1", // EUR / household / year
            "kulu_kt_hk_2_1", // EUR / consumption unit / year
            "kulu_pro_kt_hk_1_1", // share of household spending, %
            "kulukk_kt_hk_2_1", // EUR / consumption unit / month
          ],
        },
      },
    ],
    response: { format: "json-stat2" },
  };
  const data = await pxwebPost(`fi/${TABLE}/14pg.px`, body);

  const { sizes } = valuesFor(data);
  const coicopIdx = data.dimension[coicopFi.code].category.index;
  const quintileIdx = data.dimension.tuloviidennes_2_20140501.category.index;
  const contentIdx = data.dimension.contentscode.category.index;
  const nQuintiles = sizes[2];
  const nContents = sizes[3];
  const value = data.value;

  // PxWeb returns contents in metadata order, not request order.
  const at = (code, q, contentCode) => {
    const i = ((coicopIdx[code] * nQuintiles + quintileIdx[q]) * nContents) + contentIdx[contentCode];
    return value[i] ?? null;
  };

  const categories = codes.map((code) => {
    const values = {};
    for (const [q, qCode] of QUINTILE_CODES.entries()) {
      values[QUINTILES[q].id] = {
        eurYearHousehold: at(code, qCode, "kulu_kt_hk_1_1"),
        eurYearPerConsumptionUnit: at(code, qCode, "kulu_kt_hk_2_1"),
        shareOfSpendingPct: at(code, qCode, "kulu_pro_kt_hk_1_1"),
        eurMonthPerConsumptionUnit: at(code, qCode, "kulukk_kt_hk_2_1"),
      };
    }
    return {
      code,
      level: code.length === 2 ? 1 : 2,
      parent: code.length === 3 ? code.slice(0, 2) : null,
      label: { fi: stripPrefix(fiLabel.get(code)), en: stripPrefix(enLabel.get(code)) },
      values,
    };
  });

  // Background: household size, consumption units and mean disposable income.
  const bg = await pxwebPost(`fi/${TABLE}/14qa.px`, {
    query: [
      { code: "timeperiod_y", selection: { filter: "item", values: ["2022"] } },
      { code: "tuloviidennes_2_20140501", selection: { filter: "item", values: QUINTILE_CODES } },
      {
        code: "contentscode",
        selection: {
          filter: "item",
          values: ["jlkm_mean", "oecdmod_mean", "Kaytetmk_2_mean"],
        },
      },
    ],
    response: { format: "json-stat2" },
  });
  const bgValue = bg.value;
  const bgContents = bg.dimension.contentscode.category.index;
  const bgQuintiles = bg.dimension.tuloviidennes_2_20140501.category.index;
  const bgAt = (q, contentCode) =>
    bgValue[bgQuintiles[q] * Object.keys(bgContents).length + bgContents[contentCode]] ?? null;
  const quintileMeta = QUINTILES.map((q, i) => ({
    ...q,
    meanHouseholdSize: bgAt(QUINTILE_CODES[i], "jlkm_mean"),
    meanConsumptionUnits: bgAt(QUINTILE_CODES[i], "oecdmod_mean"),
    meanDisposableIncomeEur: bgAt(QUINTILE_CODES[i], "Kaytetmk_2_mean"),
  }));

  const out = {
    meta: {
      title: "Household consumption expenditure by income quintile, Finland 2022",
      source: "Statistics Finland, Household Budget Survey (ktutk)",
      tables: ["StatFin ktutk 14pg.px", "StatFin ktutk 14qa.px"],
      referenceYear: 2022,
      retrieved: "2026-11-14",
      license: "CC BY 4.0",
      url: "https://pxdata.stat.fi/PXWeb/pxweb/fi/StatFin/StatFin__ktutk/",
      notes: [
        "Quintiles are formed on household disposable income per consumption unit (OECD scale), not gross salary.",
        "Mean disposable income is a group mean, not a cut-off boundary.",
        "Shares are of household consumption expenditure and may not sum to 100 because of rounding and unclassified items.",
      ],
    },
    quintiles: quintileMeta,
    categories,
  };

  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT} (${categories.length} categories, ${quintileMeta.length} quintiles)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
