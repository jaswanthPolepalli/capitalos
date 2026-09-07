/**
 * Formatting utilities for CapitalOS.
 *
 * - All INR values are stored as integer paise (bigint).
 * - Indian number formatting: ₹10,00,000 (lakh system).
 * - Dates are presented in DD MMM YYYY for readability.
 */

const INR_LOCALE = "en-IN";

/**
 * Format a bigint paise value as an Indian Rupee string.
 *
 * @example
 * formatINR(100000000n) // "₹10,00,000"
 * formatINR(50000n)     // "₹500"
 */
export function formatINR(paise: bigint): string {
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat(INR_LOCALE, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rupees);
}

/**
 * Format a bigint paise value with paise (2 decimal places) when non-zero.
 */
export function formatINRFull(paise: bigint): string {
  const rupees = Number(paise) / 100;
  const hasPaise = Number(paise) % 100 !== 0;
  return new Intl.NumberFormat(INR_LOCALE, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: hasPaise ? 2 : 0,
    minimumFractionDigits: hasPaise ? 2 : 0,
  }).format(rupees);
}

/**
 * Format an ISO date string as "DD MMM YYYY" (e.g. "15 Mar 2024").
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format an ISO datetime string as "DD MMM YYYY, h:mm am/pm".
 */
export function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Return a relative time string ("2 days ago", "in 3 months") using the
 * Intl.RelativeTimeFormat API.
 */
export function formatRelativeTime(isoDateTime: string): string {
  const now = Date.now();
  const then = new Date(isoDateTime).getTime();
  const diffMs = then - now;
  const diffDays = Math.round(diffMs / 86_400_000);
  const diffMonths = Math.round(diffMs / (86_400_000 * 30.4));

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, "day");
  }
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, "month");
  }
  return rtf.format(Math.round(diffMonths / 12), "year");
}

/**
 * Convert a paise bigint to a compact display string (₹10L, ₹1.5Cr).
 */
export function formatINRCompact(paise: bigint): string {
  const rupees = Number(paise) / 100;
  if (rupees >= 10_000_000) {
    const cr = rupees / 10_000_000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (rupees >= 100_000) {
    const lakh = rupees / 100_000;
    return `₹${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)}L`;
  }
  return formatINR(paise);
}
