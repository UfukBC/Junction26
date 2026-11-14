/* Endpoint definitions: validate the body, build the prompt, and provide deterministic mock
 * narration for the same input (used by AI_PROVIDER=mock so the demo runs offline).
 */

import { MONTH, list, number, object, oneOf, string } from "./validate.mjs";
import { LANGUAGES, promptFor } from "./prompts.mjs";

const eur = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 });

function money(value) {
  return `${eur.format(Math.round(value))} €`;
}

function pct(value) {
  return `${new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 1 }).format(value)} %`;
}

function monthName(month, language) {
  const [year, index] = month.split("-");
  const names =
    language === "fi"
      ? ["tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu", "kesäkuu", "heinäkuu", "elokuu", "syyskuu", "lokakuu", "marraskuu", "joulukuu"]
      : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[Number(index) - 1]} ${year}`;
}

function language(value) {
  return oneOf(value, "language", LANGUAGES, "en");
}

function goalBody(value) {
  if (value === undefined || value === null) return null;
  const goal = object(value, "goal");
  return {
    label: string(goal.label, "goal.label", { max: 120 }),
    targetAmountEur: number(goal.targetAmountEur, "goal.targetAmountEur", { min: 0, optional: true }),
    targetDate: string(goal.targetDate, "goal.targetDate", { max: 20, optional: true }),
  };
}

function topCategoryList(value) {
  return list(value, "topCategories", { max: 8 }).map((raw, index) => {
    const item = object(raw, `topCategories[${index}]`);
    return {
      name: string(item.name, `topCategories[${index}].name`, { max: 60 }),
      amountEur: number(item.amountEur, `topCategories[${index}].amountEur`, { min: 0 }),
      sharePct: number(item.sharePct, `topCategories[${index}].sharePct`, { min: 0, max: 100 }),
    };
  });
}

function categoryList(value, name, max) {
  if (value === undefined || value === null) return null;
  return list(value, name, { max }).map((raw, index) => {
    const item = object(raw, `${name}[${index}]`);
    return {
      name: string(item.name, `${name}[${index}].name`, { max: 60 }),
      amountEur: number(item.amountEur, `${name}[${index}].amountEur`, { min: 0 }),
      sharePct: number(item.sharePct, `${name}[${index}].sharePct`, { min: 0, max: 100, optional: true }),
    };
  });
}

function insightList(value) {
  if (value === undefined || value === null) return null;
  return list(value, "insights", { max: 8 }).map((raw, index) => {
    const item = object(raw, `insights[${index}]`);
    return {
      title: string(item.title, `insights[${index}].title`, { max: 120 }),
      detail: string(item.detail, `insights[${index}].detail`, { max: 300, optional: true }),
      amountEur: number(item.amountEur, `insights[${index}].amountEur`, { optional: true }),
    };
  });
}

function questionnaireBody(value) {
  if (value === undefined || value === null) return null;
  const answers = object(value, "questionnaire");
  return {
    goal: string(answers.goal, "questionnaire.goal", { max: 60, optional: true }),
    targetAmountEur: number(answers.targetAmountEur, "questionnaire.targetAmountEur", { min: 0, optional: true }),
    targetDate: string(answers.targetDate, "questionnaire.targetDate", { max: 20, optional: true }),
    incomePredictability: string(answers.incomePredictability, "questionnaire.incomePredictability", {
      max: 40,
      optional: true,
    }),
    controlCategories: list(answers.controlCategories, "questionnaire.controlCategories", {
      max: 8,
      optional: true,
    }).map((category, index) => string(category, `questionnaire.controlCategories[${index}]`, { max: 60 })),
  };
}

/** Mock narration: deterministic text built from the validated input, in the request language. */
const mock = {
  overview({ year, totals, months, goal }, languageCode) {
    const withData = months.filter((month) => month.spendingEur !== null);
    const heaviest = withData.reduce((max, month) => (month.spendingEur > (max?.spendingEur ?? -Infinity) ? month : max), null);
    const lightest = withData.reduce((min, month) => (month.spendingEur < (min?.spendingEur ?? Infinity) ? month : min), null);
    const left = totals.incomeEur - totals.spendingEur;
    const lines =
      languageCode === "fi"
        ? [
            `Vuonna ${year} käytit ${money(totals.spendingEur)} ${totals.monthsWithData} kuukaudessa, keskimäärin ${money(totals.averageMonthlySpendingEur ?? totals.spendingEur / Math.max(1, totals.monthsWithData))} kuukaudessa.`,
            `Tuloja oli ${money(totals.incomeEur)}, joten ${left >= 0 ? `${money(left)} jäi käyttämättä` : `kulut ylittivät tulot ${money(-left)}`}.`,
            heaviest && lightest
              ? `Suurin kuukausi oli ${monthName(heaviest.month, languageCode)} (${money(heaviest.spendingEur)}) ja pienin ${monthName(lightest.month, languageCode)} (${money(lightest.spendingEur)}).`
              : "",
            goal
              ? `Tavoitteesi (${goal.label}) etenee parhaiten säännöllisellä kuukausisummalla.`
              : "Kun asetat tavoitteen, seuraava askel muuttuu konkreettiseksi.",
          ]
        : [
            `In ${year} you spent ${money(totals.spendingEur)} across ${totals.monthsWithData} months, an average of ${money(totals.averageMonthlySpendingEur ?? totals.spendingEur / Math.max(1, totals.monthsWithData))} a month.`,
            `Income was ${money(totals.incomeEur)}, so ${left >= 0 ? `${money(left)} stayed unspent` : `spending went ${money(-left)} past income`}.`,
            heaviest && lightest
              ? `The heaviest month was ${monthName(heaviest.month, languageCode)} (${money(heaviest.spendingEur)}) and the lightest ${monthName(lightest.month, languageCode)} (${money(lightest.spendingEur)}).`
              : "",
            goal
              ? `Your goal (${goal.label}) moves forward best with a steady monthly amount.`
              : "Setting a goal would make the next step concrete.",
          ];
    return lines.filter(Boolean).join(" ");
  },

  "month-summary"({ month, spendingEur, incomeEur, topCategories, yearAverageMonthlySpendingEur }, languageCode) {
    const top = topCategories
      .slice(0, 3)
      .map((category) => `${category.name} ${money(category.amountEur)}`)
      .join(", ");
    const vsAverage =
      yearAverageMonthlySpendingEur && yearAverageMonthlySpendingEur > 0
        ? ((spendingEur - yearAverageMonthlySpendingEur) / yearAverageMonthlySpendingEur) * 100
        : null;
    if (languageCode === "fi") {
      return [
        `${monthName(month, "fi")}: käytit ${money(spendingEur)}${incomeEur != null ? `, kun tuloja oli ${money(incomeEur)}` : ""}.`,
        top ? `Suurimmat erät olivat ${top}.` : "",
        vsAverage !== null
          ? `Se on ${pct(Math.abs(vsAverage))} ${vsAverage >= 0 ? "yli" : "alle"} kuukausikeskiarvon ${money(yearAverageMonthlySpendingEur)}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    return [
      `In ${monthName(month, "en")} you spent ${money(spendingEur)}${incomeEur != null ? `, with ${money(incomeEur)} coming in` : ""}.`,
      top ? `The largest items were ${top}.` : "",
      vsAverage !== null
        ? `That is ${pct(Math.abs(vsAverage))} ${vsAverage >= 0 ? "above" : "below"} your monthly average of ${money(yearAverageMonthlySpendingEur)}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  },

  category({ category, amountEur, sharePct, benchmarkSharePct }, languageCode) {
    if (languageCode === "fi") {
      return `Käytit ${money(amountEur)} kohteeseen ${category}, eli ${pct(sharePct)} menoistasi${benchmarkSharePct != null ? `, kun kotitalouksilla keskimäärin osuus on ${pct(benchmarkSharePct)}` : ""}.`;
    }
    return `You spent ${money(amountEur)} on ${category}, which is ${pct(sharePct)} of your spending${benchmarkSharePct != null ? `, against ${pct(benchmarkSharePct)} for households on average` : ""}.`;
  },

  insight({ insights, questionnaire }, languageCode) {
    const titles = (insights ?? []).map((insight) => insight.title).filter(Boolean);
    const goal = questionnaire?.goal ?? null;
    const head = titles.length > 0 ? titles.join("; ") : languageCode === "fi" ? "Kuukauden tärkein havainto on menoerien jakautuminen" : "The main insight is how the month's spending splits up";
    if (languageCode === "fi") {
      return [`${head}.`, goal ? `Se liittyy tavoitteeseesi: ${goal}.` : "Valitse tavoite, niin neuvo tarkentuu."].join(" ");
    }
    return [`${head}.`, goal ? `That connects to your goal: ${goal}.` : "Choose a goal and the advice becomes more specific."].join(" ");
  },

  "what-if"({ scenario, baseline, result, savingEur }, languageCode) {
    if (languageCode === "fi") {
      return `Jos ${scenario}, kuukauden menot muuttuvat summasta ${money(baseline.spendingEur)} summaan ${money(result.spendingEur)}, eli säästöä kertyy ${money(savingEur)}. Samalla tahdilla säästö on ${money(savingEur)} joka kuukausi.`;
    }
    return `If ${scenario}, your monthly spending goes from ${money(baseline.spendingEur)} to ${money(result.spendingEur)}, a saving of ${money(savingEur)}. At the same pace that is ${money(savingEur)} saved every month.`;
  },

  "segment-advice"({ month, segment }, languageCode) {
    if (languageCode === "fi") {
      return `Summary: ${segment} on valittu osa kuukauden ${month} menoista.\nRecommendation: Vertaa summaa kuukauden tuloihin ennen kuin muutat mitään.`;
    }
    return `Summary: In ${month}, ${segment} is the slice you picked.\nRecommendation: Compare its amount with the month's income before you change anything.`;
  },
};

function payload(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined));
}

export const endpoints = {
  "ai/overview": {
    validate(body) {
      const totals = object(body.totals, "totals");
      return {
        language: language(body.language),
        year: Math.round(number(body.year, "year", { min: 1900, max: 2100 })),
        totals: {
          spendingEur: number(totals.spendingEur, "totals.spendingEur", { min: 0 }),
          incomeEur: number(totals.incomeEur, "totals.incomeEur", { min: 0 }),
          monthsWithData: Math.round(number(totals.monthsWithData, "totals.monthsWithData", { min: 0, max: 12 })),
          averageMonthlySpendingEur: number(totals.averageMonthlySpendingEur, "totals.averageMonthlySpendingEur", {
            min: 0,
            optional: true,
          }),
        },
        months: list(body.months, "months", { max: 24 }).map((raw, index) => {
          const month = object(raw, `months[${index}]`);
          return {
            month: string(month.month, `months[${index}].month`, { pattern: MONTH }),
            spendingEur: number(month.spendingEur, `months[${index}].spendingEur`, { min: 0, optional: true }),
            incomeEur: number(month.incomeEur, `months[${index}].incomeEur`, { min: 0, optional: true }),
          };
        }),
        goal: goalBody(body.goal),
      };
    },
    prompt(input) {
      const { language: lang, ...data } = input;
      return promptFor("overview", payload(data));
    },
    mock(input) {
      return mock.overview(input, input.language);
    },
  },

  "ai/month-summary": {
    validate(body) {
      return {
        language: language(body.language),
        month: string(body.month, "month", { pattern: MONTH }),
        spendingEur: number(body.spendingEur, "spendingEur", { min: 0 }),
        incomeEur: number(body.incomeEur, "incomeEur", { min: 0, optional: true }),
        topCategories: topCategoryList(body.topCategories),
        yearAverageMonthlySpendingEur: number(
          body.yearAverageMonthlySpendingEur,
          "yearAverageMonthlySpendingEur",
          { min: 0, optional: true },
        ),
      };
    },
    prompt(input) {
      const { language: lang, ...data } = input;
      return promptFor("month-summary", payload(data));
    },
    mock(input) {
      return mock["month-summary"](input, input.language);
    },
  },

  "ai/category": {
    validate(body) {
      return {
        language: language(body.language),
        category: string(body.category, "category", { max: 60 }),
        amountEur: number(body.amountEur, "amountEur", { min: 0 }),
        sharePct: number(body.sharePct, "sharePct", { min: 0, max: 100 }),
        benchmarkSharePct: number(body.benchmarkSharePct, "benchmarkSharePct", { min: 0, max: 100, optional: true }),
      };
    },
    prompt(input) {
      const { language: lang, ...data } = input;
      return promptFor("category", payload(data));
    },
    mock(input) {
      return mock.category(input, input.language);
    },
  },

  "ai/insight": {
    validate(body) {
      const aggregates = body.aggregates == null ? null : object(body.aggregates, "aggregates");
      const month = aggregates?.month == null ? null : string(aggregates.month, "aggregates.month", { pattern: MONTH });
      return {
        language: language(body.language),
        insights: insightList(body.insights),
        aggregates:
          aggregates == null
            ? null
            : {
                month,
                spendingEur: number(aggregates.spendingEur, "aggregates.spendingEur", { min: 0, optional: true }),
                incomeEur: number(aggregates.incomeEur, "aggregates.incomeEur", { min: 0, optional: true }),
                categories: categoryList(aggregates.categories, "aggregates.categories", 10),
              },
        questionnaire: questionnaireBody(body.questionnaire),
      };
    },
    prompt(input) {
      const { language: lang, ...data } = input;
      return promptFor("insight", payload(data));
    },
    mock(input) {
      return mock.insight(input, input.language);
    },
  },

  "ai/what-if": {
    validate(body) {
      const baseline = object(body.baseline, "baseline");
      const result = object(body.result, "result");
      const baselineEur = number(baseline.spendingEur, "baseline.spendingEur", { min: 0 });
      const resultEur = number(result.spendingEur, "result.spendingEur", { min: 0 });
      return {
        language: language(body.language),
        scenario: string(body.scenario, "scenario", { max: 200 }),
        baseline: { spendingEur: baselineEur },
        result: { spendingEur: resultEur },
        savingEur: number(body.savingEur, "savingEur", { optional: true }) ?? baselineEur - resultEur,
      };
    },
    prompt(input) {
      const { language: lang, ...data } = input;
      return promptFor("what-if", payload(data));
    },
    mock(input) {
      return mock["what-if"](input, input.language);
    },
  },

  segmentAdvice: {
    validate(body) {
      return {
        language: oneOf(body.language, "language", LANGUAGES, "en"),
        month: string(body.month, "month", { max: 48 }),
        segment: string(body.segment, "segment", { max: 48 }),
        brief: string(body.brief, "brief", { max: 2500 }),
      };
    },
    prompt(input) {
      return `Month: ${input.month}\nSelected slice: ${input.segment}\n${input.brief}`;
    },
    mock(input) {
      return mock["segment-advice"](input, input.language);
    },
  },
};
