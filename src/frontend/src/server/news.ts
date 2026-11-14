/**
 * Current Finnish money news for the deep-analysis agents. Dev-server only.
 * Source: Yle News English RSS. Only headlines about prices, taxes, work, housing and the economy are kept.
 * A failed fetch returns no news; the analysis runs without it.
 */
export const NEWS_SOURCE = "Yle News";
const FEED_URL = "https://yle.fi/rss/news";
const CACHE_MS = 30 * 60 * 1000;
const MAX_ITEMS = 4;

export interface NewsItem {
  title: string;
  description: string;
  link: string;
  published: string;
}

const MONEY_CATEGORY =
  /econom|business|taxation|tax|unemployment|working life|level of income|poverty|housing|energy|prices|inflation|interest|banking|finance|consumer|pension|kela|benefit/i;
const MONEY_WORDS =
  /inflation|interest rate|euribor|\bECB\b|price|tax|electricity|mortgage|loan|rent\b|unemploy|wage|salary|pay rise|benefit|Kela|pension|economy|economic|budget|grocer|food cost|cost of living|bank/i;

let cache: { at: number; items: NewsItem[] } | null = null;

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(item: string, name: string): string {
  return decode(item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? "");
}

/** Parses the RSS text and keeps the money-related items, newest first as the feed lists them. */
export function moneyNewsFromRss(xml: string): NewsItem[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((item) => {
      const categories = [...item.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((m) => decode(m[1]));
      return {
        title: tag(item, "title"),
        description: tag(item, "description").slice(0, 240),
        link: tag(item, "link").replace(/\?origin=rss$/, ""),
        published: tag(item, "pubDate"),
        categories,
      };
    })
    .filter((item) => item.title)
    .filter(
      (item) =>
        item.categories.some((category) => MONEY_CATEGORY.test(category)) ||
        MONEY_WORDS.test(`${item.title} ${item.description}`),
    )
    .slice(0, MAX_ITEMS)
    .map(({ title, description, link, published }) => ({ title, description, link, published }));
}

export async function fetchMoneyNews(): Promise<NewsItem[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
  try {
    const response = await fetch(FEED_URL, {
      headers: { "User-Agent": "Junction26-demo", Accept: "application/rss+xml, application/xml" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("feed failed");
    const items = moneyNewsFromRss(await response.text());
    cache = { at: Date.now(), items };
    return items;
  } catch {
    // Keep the last good headlines if there are any.
    return cache?.items ?? [];
  }
}
