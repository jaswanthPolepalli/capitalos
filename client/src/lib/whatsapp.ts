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
  partnerName: string;
  partnerPhone?: string | null;
  amountRupees: number;
  paidDate: string;          // ISO date
  referenceNumber?: string | null;
  notes?: string | null;
  capitalOutstanding?: number | null;
  profitPercent?: number | null;
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
    `*Profit Payment Confirmation*`,
    ``,
    `Hi ${opts.partnerName},`,
    ``,
    `Your profit payment has been processed:`,
    `  • Amount: *${fmtINR(opts.amountRupees)}*`,
    `  • Date: ${fmtDate(opts.paidDate)}`,
  ];

  if (opts.referenceNumber) {
    lines.push(`  • Reference: ${opts.referenceNumber}`);
  }

  if (opts.capitalOutstanding != null) {
    lines.push(`  • Capital outstanding: ${fmtINR(opts.capitalOutstanding)}`);
  }

  if (opts.profitPercent != null) {
    lines.push(`  • Rate: ${opts.profitPercent}% per month`);
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
