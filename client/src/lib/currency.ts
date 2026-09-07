/**
 * Centralized INR currency formatting utilities.
 *
 * All pages should use these instead of local `fmt()` functions.
 * Rupee amounts stored as plain numbers (from the store) are formatted here.
 */

const INR_LOCALE = "en-IN";

/**
 * Format a plain rupee number (integer) as an Indian Rupee string.
 * e.g. formatRupees(1000000) → "₹10,00,000"
 */
export function formatRupees(rupees: number): string {
  return new Intl.NumberFormat(INR_LOCALE, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rupees);
}

/**
 * Compact display: ₹10L, ₹1.5Cr, ₹500
 */
export function formatRupeesCompact(rupees: number): string {
  if (rupees >= 10_000_000) {
    const cr = rupees / 10_000_000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (rupees >= 100_000) {
    const lakh = rupees / 100_000;
    return `₹${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)}L`;
  }
  return formatRupees(rupees);
}

/**
 * Generate a deterministic avatar background color class from a string (e.g. partner ID/name).
 * Returns one of 8 color tokens.
 */
const AVATAR_COLORS = [
  "avatar--teal",
  "avatar--blue",
  "avatar--purple",
  "avatar--amber",
  "avatar--rose",
  "avatar--indigo",
  "avatar--emerald",
  "avatar--orange",
] as const;

export function getAvatarColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffff;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}
