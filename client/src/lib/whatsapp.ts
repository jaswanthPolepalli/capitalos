/**
 * WhatsApp share utility for CapitalOS.
 *
 * Generates wa.me deep-link URLs with pre-composed payment confirmation
 * messages. The CFO clicks the button after recording a payment — the link
 * opens WhatsApp (desktop or mobile) with a pre-filled message that the CFO
 * just sends to the partner.
 *
 * No backend required. Zero dependencies.
 */

function fmtINR(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

function fmtDate(isoDate: string): string {
  const parts = isoDate.split("-").map(Number);
  const d = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export interface WhatsAppProfitPaymentOptions {
  kind?: "profit" | "cashback";
  partnerName: string;
  partnerPhone?: string | null;
  amountRupees: number;
  paidDate: string;          // ISO date
  referenceNumber?: string | null;
  notes?: string | null;
  capitalOutstanding?: number | null;
  profitPercent?: number | null;
  /** ISO date the capital was originally given to the partner */
  amountGivenDate?: string | null;
  /** "cash" or "card" — how the underlying capital allocation was funded */
  fundingSource?: "cash" | "card" | null;
  /** Card nickname, shown when fundingSource is "card" */
  cardName?: string | null;
}

export interface WhatsAppCapitalReturnOptions {
  partnerName: string;
  partnerPhone?: string | null;
  amountRupees: number;
  returnedDate: string;      // ISO date
  referenceNumber?: string | null;
  notes?: string | null;
  capitalOutstanding?: number | null;
}

/**
 * Build a WhatsApp deep-link for a profit payment confirmation.
 */
export function buildProfitPaymentWhatsAppLink(opts: WhatsAppProfitPaymentOptions): string {
  const lines: string[] = [
    opts.kind === "cashback" ? `*Cashback Sharing*` : `*Profit Payment Confirmation*`,
    ``,
    `Hi ${opts.partnerName},`,
    ``,
    `Your ${opts.kind === "cashback" ? "cashback sharing" : "profit payment"} has been processed:`,
    `  • Amount: *${fmtINR(opts.amountRupees)}*`,
    `  • Date: ${fmtDate(opts.paidDate)}`,
  ];

  if (opts.referenceNumber) {
    lines.push(`  • Reference: ${opts.referenceNumber}`);
  }

  if (opts.fundingSource) {
    const label = opts.fundingSource === "card"
      ? `Credit Card${opts.cardName ? ` (${opts.cardName})` : ""}`
      : "Cash";
    lines.push(`  • Funding source: ${label}`);
  }

  if (opts.amountGivenDate) {
    lines.push(`  • Amount given date: ${fmtDate(opts.amountGivenDate)}`);
  }

  if (opts.capitalOutstanding != null) {
    lines.push(`  • Capital outstanding: ${fmtINR(opts.capitalOutstanding)}`);
  }

  // Exact rate derived from the actual amount paid against capital outstanding,
  // falling back to the allocation's nominal rate when that isn't computable.
  const exactPercent = opts.capitalOutstanding && opts.capitalOutstanding > 0
    ? Math.round((opts.amountRupees / opts.capitalOutstanding) * 10000) / 100
    : null;
  const displayPercent = exactPercent ?? opts.profitPercent ?? null;

  if (displayPercent != null) {
    lines.push(`  • Rate: ${displayPercent}%`);
  }

  if (opts.notes && !opts.notes.includes("WA_CONFIRMED")) {
    lines.push(`  • Notes: ${opts.notes}`);
  }

  lines.push(``);
  lines.push(`Thank you.`);
  lines.push(`— CapitalOS`);

  return buildWhatsAppLink(opts.partnerPhone, lines.join("\n"));
}

/**
 * Build a WhatsApp deep-link for a capital return confirmation.
 */
export function buildCapitalReturnWhatsAppLink(opts: WhatsAppCapitalReturnOptions): string {
  const lines: string[] = [
    `*Capital Return Confirmation*`,
    ``,
    `Hi ${opts.partnerName},`,
    ``,
    `Your capital return has been recorded:`,
    `  • Amount returned: *${fmtINR(opts.amountRupees)}*`,
    `  • Date: ${fmtDate(opts.returnedDate)}`,
  ];

  if (opts.referenceNumber) {
    lines.push(`  • Reference: ${opts.referenceNumber}`);
  }

  if (opts.capitalOutstanding != null && opts.capitalOutstanding > 0) {
    lines.push(`  • Remaining capital outstanding: ${fmtINR(opts.capitalOutstanding)}`);
  } else if (opts.capitalOutstanding === 0) {
    lines.push(`  • Capital fully returned ✓`);
  }

  if (opts.notes) {
    lines.push(`  • Notes: ${opts.notes}`);
  }

  lines.push(``);
  lines.push(`Thank you.`);
  lines.push(`— CapitalOS`);

  return buildWhatsAppLink(opts.partnerPhone, lines.join("\n"));
}

/**
 * Build the wa.me URL.
 * If phone is provided (E.164 or Indian format), it pre-fills the recipient.
 * Otherwise, opens "select contact" flow (works on WhatsApp Web and mobile).
 */
function buildWhatsAppLink(phone: string | null | undefined, text: string): string {
  const encodedText = encodeURIComponent(text);
  const cleanPhone = phone ? phone.replace(/\D/g, "") : null;

  if (cleanPhone && cleanPhone.length >= 10) {
    // Ensure it has country code (assume India +91 if 10 digits)
    const e164 = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    return `https://wa.me/${e164}?text=${encodedText}`;
  }

  // No phone — open wa.me without a recipient (user selects contact)
  return `https://wa.me/?text=${encodedText}`;
}

export function buildGroupedPaymentWhatsAppLink(opts: {
  partnerName: string; partnerPhone?: string | null; kind: 'profit' | 'capital';
  date: string; reference: string; entries: { label: string; contributionAmountRupees: number; amountRupees: number; remaining: number }[];
}): string {
  const total = opts.entries.reduce((sum, entry) => sum + entry.amountRupees, 0);
  const lines = [opts.kind === 'profit' ? '*Profit Payment Confirmation*' : '*Capital Return Confirmation*', '',
    `Hi ${opts.partnerName},`, '', `Total ${opts.kind === 'profit' ? 'profit paid' : 'capital returned'}: *${fmtINR(total)}*`,
    `Date: ${fmtDate(opts.date)}`, `Entries: ${opts.entries.length}`];
  if (opts.reference.trim()) lines.push(`Reference: ${opts.reference.trim()}`);
  lines.push('', 'Breakdown:');
  opts.entries.forEach((entry, index) => {
    // The displayed contribution is the denominator, including when its capital
    // has since been partly/fully returned. This describes the actual payment,
    // not the nominal monthly rate or the partner's aggregate return.
    const rate = opts.kind === 'profit' && entry.contributionAmountRupees > 0
      ? Math.round(entry.amountRupees / entry.contributionAmountRupees * 10000) / 100 : null;
    lines.push(`${index + 1}. ${entry.label}`,
      `   ${opts.kind === 'profit' ? 'Profit paid' : 'Capital returned'}: *${fmtINR(entry.amountRupees)}*${rate !== null ? ` (${rate}% of this contribution)` : ''}`,
      `   ${opts.kind === 'profit' ? 'Profit' : 'Capital'} remaining on this entry: ${fmtINR(entry.remaining)}`, '');
  });
  lines.push('Remaining amounts apply only to the listed entries, as of this payment.');
  lines.push('', 'Thank you.', '— CapitalOS');
  return buildWhatsAppLink(opts.partnerPhone, lines.join('\n'));
}
