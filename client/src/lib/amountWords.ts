/**
 * amountToWords — converts a number (rupees) to Indian English words.
 * Supports up to crores. Used to show readable amount below input fields.
 */

const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];

const tens = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty",
  "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ones[n] ?? "";
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return (tens[ten] ?? "") + (one > 0 ? " " + (ones[one] ?? "") : "");
}

function threeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let result = "";
  if (hundred > 0) result += (ones[hundred] ?? "") + " Hundred";
  if (rest > 0) result += (result ? " " : "") + twoDigits(rest);
  return result;
}

export function amountToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "";
  const n = Math.floor(amount);
  if (n === 0) return "Zero Rupees";

  // Indian system: Crore, Lakh, Thousand, Hundred
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1_000);
  const rest = n % 1_000;

  const parts: string[] = [];

  if (crore > 0) parts.push(threeDigits(crore) + (crore === 1 ? " Crore" : " Crores"));
  if (lakh > 0) parts.push(twoDigits(lakh) + (lakh === 1 ? " Lakh" : " Lakhs"));
  if (thousand > 0) parts.push(twoDigits(thousand) + (thousand === 1 ? " Thousand" : " Thousand"));
  if (rest > 0) parts.push(threeDigits(rest));

  return parts.join(" ") + " Rupees";
}
