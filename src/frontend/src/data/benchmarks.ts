import raw from "./benchmarks.json";

export type QuintileId = "all" | "q1" | "q2" | "q3" | "q4" | "q5";

export interface QuintileBenchmark {
  id: QuintileId;
  fi: string;
  en: string;
  meanHouseholdSize: number;
  meanConsumptionUnits: number;
  meanDisposableIncomeEur: number;
}

export interface CategoryValues {
  eurYearHousehold: number | null;
  eurYearPerConsumptionUnit: number | null;
  shareOfSpendingPct: number | null;
  eurMonthPerConsumptionUnit: number | null;
}

export interface BenchmarkCategory {
  code: string;
  level: number;
  parent: string | null;
  label: { fi: string; en: string };
  values: Record<QuintileId, CategoryValues>;
}

export interface Benchmarks {
  meta: {
    title: string;
    source: string;
    tables: string[];
    referenceYear: number;
    retrieved: string;
    license: string;
    url: string;
    notes: string[];
  };
  quintiles: QuintileBenchmark[];
  categories: BenchmarkCategory[];
}

export const BENCHMARKS = raw as Benchmarks;

export const QUINTILES = BENCHMARKS.quintiles;

export function getCategoryBenchmark(code: string): BenchmarkCategory | undefined {
  return BENCHMARKS.categories.find((c) => c.code === code);
}

export function getMainCategoryBenchmarks(): BenchmarkCategory[] {
  return BENCHMARKS.categories.filter((c) => c.level === 1);
}

export function getSubCategoryBenchmarks(parent: string): BenchmarkCategory[] {
  return BENCHMARKS.categories.filter((c) => c.parent === parent);
}
