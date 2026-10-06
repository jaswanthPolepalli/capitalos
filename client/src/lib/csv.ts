/**
 * CSV export utility for CapitalOS.
 *
 * Provides a generic `downloadCSV` function that takes a filename, headers,
 * and rows, then triggers a browser download.
 */

/**
 * Escape a cell value for safe CSV output.
 * Wraps in quotes and escapes internal quotes.
 */
export function escapeCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  // Keep genuine numeric cells numeric. Untrusted text, including phone numbers,
  // must never become a spreadsheet formula (quotes alone do not prevent that).
  if (typeof value === 'string' && (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s))) s = "'" + s;
  // If the value contains a comma, newline, or double-quote, wrap in quotes
  if (s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Download an array of rows as a CSV file.
 *
 * @param filename  The suggested file name (e.g. "partners-2026-09.csv")
 * @param headers   Column header labels
 * @param rows      Array of row arrays — each value maps to a header
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const lines: string[] = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];
  const csv = lines.join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a date-stamped filename.
 * e.g. csvFilename("partners") → "capitalos-partners-2026-09-07.csv"
 */
export function csvFilename(label: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `capitalos-${label}-${today}.csv`;
}
