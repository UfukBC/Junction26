const eur = new Intl.NumberFormat("fi-FI", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("fi-FI", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 0 });

/** "1 925,46 €" (Finnish style: space thousands separator, comma decimals). */
export const formatEur = (value: number) => `${eur.format(value)} €`;
/** "200 €" */
export const formatEurWhole = (value: number) => `${whole.format(value)} €`;
/** "1,5 %" */
export const formatPercent = (value: number) => `${pct.format(value)} %`;
/** Only the number part: "1,45" */
export const formatAmount = (value: number) => eur.format(value);
