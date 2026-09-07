import { formatINR, formatINRCompact } from "../lib/format";

interface MoneyDisplayProps {
  paise: bigint;
  compact?: boolean;
  /** If true, wraps the value in a <strong> tag */
  prominent?: boolean;
  /** Optional tone: "positive" | "negative" | "pending" | "neutral" */
  tone?: "positive" | "negative" | "pending" | "neutral" | undefined;
  className?: string | undefined;
}

/**
 * Renders an INR monetary value with correct Indian number formatting.
 * Keeps principal and profit visually distinct via tone.
 */
export function MoneyDisplay({
  paise,
  compact = false,
  prominent = false,
  tone,
  className,
}: MoneyDisplayProps) {
  const text = compact ? formatINRCompact(paise) : formatINR(paise);
  const toneClass = tone ? ` money-display--${tone}` : "";
  const cls = `money-display${toneClass}${className ? ` ${className}` : ""}`;

  return prominent ? (
    <strong className={cls}>{text}</strong>
  ) : (
    <span className={cls}>{text}</span>
  );
}
