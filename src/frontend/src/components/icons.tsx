// Simple stand-in glyphs for the bank's own product marks (not the real logos).

export function AccountGlyph({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 34" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="24" height="29" rx="2.5" stroke="var(--green-bright)" strokeWidth="2" />
      <path d="M3 27.5h24" stroke="var(--green-bright)" strokeWidth="2" />
      <text x="15" y="21" textAnchor="middle" fontSize="15" fontStyle="italic" fontWeight="700" fill="var(--green-bright)">
        S
      </text>
    </svg>
  );
}

export function CardGlyph({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 30 34" aria-hidden="true">
      <rect x="2" y="1" width="26" height="32" rx="2.5" fill="var(--green-bright)" />
      <text x="15" y="19" textAnchor="middle" fontSize="15" fontStyle="italic" fontWeight="700" fill="#fff">
        S
      </text>
      <text x="15" y="29" textAnchor="middle" fontSize="6" fontWeight="800" fill="#fff">
        VISA
      </text>
    </svg>
  );
}

export function HomeGlyph({ size = 28, color, filled }: { size?: number; color: string; filled: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <path
        d="M14 3.2 3 12.4V25h8.2v-7.2h5.6V25H25V12.4z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={filled ? 0 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SGlyph({ size = 26, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <text x="13" y="21" textAnchor="middle" fontSize="24" fontStyle="italic" fontWeight="600" fill="none" stroke={color} strokeWidth="1.3">
        S
      </text>
    </svg>
  );
}
