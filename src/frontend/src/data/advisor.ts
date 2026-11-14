/**
 * Aino is the advisor voice for spending advice and the monthly savings check.
 * She talks about this customer's own payments and gives one next step.
 */
export const ADVISOR_NAME = "Aino";

export const ADVISOR_VOICE = [
  `You are ${ADVISOR_NAME}, a personal financial advisor in a Finnish mobile bank.`,
  "You speak to this one customer, in plain English, about their own figures only.",
  "Do not invent payments or amounts.",
].join(" ");

/** MCC code to a plain place. Merchant ids in this dataset are codes, not shop names. */
const MCC_PLACE: Record<string, string> = {
  "5411": "a grocery shop",
  "5422": "a meat shop",
  "5451": "a dairy shop",
  "5499": "a food shop",
  "5812": "a restaurant",
  "5813": "a bar",
  "5814": "a fast-food place",
  "4111": "commuter transport",
  "4121": "a taxi",
  "5541": "fuel",
  "5542": "fuel",
  "7523": "parking",
  "7832": "a cinema",
  "7922": "a ticket",
  "7991": "a tourist attraction",
  "7996": "an amusement park",
  "7999": "entertainment",
  "5912": "a pharmacy",
  "8011": "a doctor",
  "8021": "a dentist",
  "8099": "health care",
  "5200": "a hardware shop",
  "5251": "a hardware shop",
  "5712": "a furniture shop",
  "5732": "an electronics shop",
  "5734": "software",
  "5651": "a clothes shop",
  "5691": "a clothes shop",
  "5941": "a sports shop",
  "5942": "a bookshop",
  "5945": "a toy shop",
  "5999": "a shop",
  "4511": "a flight",
  "4722": "a travel agency",
  "7011": "a hotel",
  "7512": "a car rental",
};

export function placeFromMcc(mcc: string | null, category: string): string {
  if (mcc && MCC_PLACE[mcc]) return MCC_PLACE[mcc];
  return category.toLowerCase();
}

export interface PaymentFact {
  date: string;
  place: string;
  amountEur: number;
}

/** Factual summary of the payments. No next step. */
export function adviceFromPayments(segment: string, payments: PaymentFact[]): string {
  if (payments.length === 0) return `No ${segment} payments in this month.`;
  const sorted = [...payments].sort((a, b) => b.amountEur - a.amountEur);
  const largest = sorted[0];
  const money = formatEuro(largest.amountEur);
  if (payments.length === 1) {
    return `One ${segment} payment: ${money} on ${largest.date}, ${largest.place}.`;
  }
  const rest = sorted.slice(1).map((row) => row.amountEur);
  const typical = rest.reduce((sum, value) => sum + value, 0) / rest.length;
  const outlier = typical > 0 && largest.amountEur >= typical * 1.8;
  if (outlier) {
    return `${payments.length} ${segment} payments. Most are about ${formatEuro(typical)}. The largest was ${money} on ${largest.date}, ${largest.place}.`;
  }
  const smallest = formatEuro(sorted[sorted.length - 1].amountEur);
  return `${payments.length} ${segment} payments, from ${smallest} to ${money}. The largest was on ${largest.date}, ${largest.place}.`;
}

function formatEuro(value: number): string {
  return `${new Intl.NumberFormat("fi-FI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} €`;
}
