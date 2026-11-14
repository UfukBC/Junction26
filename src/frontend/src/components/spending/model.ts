import type { MonthStory } from "../../data/database";

/** One ring segment / legend row. */
export interface Part {
  name: string;
  detail: string;
  valueEur: number;
  color: string;
}

// Greens of the app palette, from dark to light. The ring segments and legend dots use the same colours.
export const SLICE_COLORS: Record<string, string> = {
  Fixed: "#017842",
  Everyday: "#00ac49",
  Left: "#8dceb0",
};

// Categories inside "Everyday": 8 distinct steps of the same green family (dark to light).
export const CATEGORY_COLORS = ["#014f2c", "#017842", "#0a8a45", "#00ac49", "#3aaa68", "#6cc08d", "#8dceb0", "#b9e2cd"];

export const CATEGORY_DETAIL: Record<string, string> = {
  Groceries: "Food shops",
  Restaurants: "Eating out",
  Transportation: "Fuel, taxis and transit",
  Entertainment: "Going out",
  Health: "Pharmacy and care",
  "Home & Tech": "Home and electronics",
  Lifestyle: "Clothes and personal spending",
  Travel: "Trips and tickets",
};

const plural = (count: number) => (count === 1 ? "1 purchase" : `${count} purchases`);

/** Ring parts for the month overview: Fixed, Everyday, Left (only those with money in them). */
export function monthParts(story: MonthStory): Part[] {
  return story.slices
    .filter((slice) => slice.valueEur > 0.5)
    .map((slice) => ({
      name: slice.name,
      detail: slice.name === "Everyday" ? "Everyday purchases" : slice.detail,
      valueEur: slice.valueEur,
      color: SLICE_COLORS[slice.name],
    }));
}

/** Ring parts for the categories inside Everyday. */
export function categoryParts(story: MonthStory): Part[] {
  const categories = story.slices.find((slice) => slice.name === "Everyday")?.categories ?? [];
  return categories
    .filter((category) => category.valueEur > 0.5)
    .map((category, index) => ({
      name: category.name,
      detail: CATEGORY_DETAIL[category.name] ?? plural(category.count),
      valueEur: category.valueEur,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));
}

/** Money spent in the month: fixed bills + everyday purchases. */
export function spentEur(story: MonthStory): number {
  return story.slices
    .filter((slice) => slice.name === "Fixed" || slice.name === "Everyday")
    .reduce((sum, slice) => sum + slice.valueEur, 0);
}

export const pct = (value: number, total: number) => (total > 0 ? `${Math.round((value / total) * 100)} %` : "–");
