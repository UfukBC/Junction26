import { formatEur } from "../../format";

/**
 * One tappable legend row: colour dot, name, amount. Variants:
 * - default: name + detail, amount + share (the roomy list)
 * - `compact`: one line, name and amount only (the Home card)
 * - `chip`: a small two-line tile, name over "amount · share" (the extended view's grid)
 */
export function LegendRow({
  name,
  detail,
  valueEur,
  color,
  ring,
  share,
  active,
  dim,
  variant = "default",
  onClick,
}: {
  name: string;
  detail: string;
  valueEur: number;
  color?: string;
  /** Hollow dot (used for Income, which is not part of the ring). */
  ring?: boolean;
  share?: string;
  active?: boolean;
  dim?: boolean;
  variant?: "default" | "compact" | "chip";
  onClick: () => void;
}) {
  const negative = valueEur < 0;
  const dot = <span className={`row__dot${ring ? " row__dot--ring" : ""}`} style={ring ? undefined : { background: color }} />;
  const amount = <span className={`row__amount${negative ? " row__amount--neg" : ""}`}>{formatEur(valueEur)}</span>;
  return (
    <li>
      <button
        className={`row row--${variant}${active ? " row--on" : ""}${dim ? " row--dim" : ""}`}
        type="button"
        aria-pressed={active ?? undefined}
        onClick={onClick}
      >
        {dot}
        {variant === "chip" ? (
          <span className="row__text">
            <span className="row__name">{name}</span>
            <span className="row__detail">
              <span className={negative ? "row__amount--neg" : undefined}>{formatEur(valueEur)}</span>
              {share ? ` · ${share}` : ""}
            </span>
          </span>
        ) : (
          <>
            <span className="row__text">
              <span className="row__name">{name}</span>
              {variant === "default" && <span className="row__detail">{detail}</span>}
            </span>
            <span className="row__figures">
              {amount}
              {variant === "default" && share && <span className="row__share">{share}</span>}
            </span>
          </>
        )}
      </button>
    </li>
  );
}
