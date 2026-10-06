export interface ParsedCSV { headers: string[]; rows: { rowNumber: number; cells: string[]; error: string }[] }
export function parseCSV(input: string): ParsedCSV {
  const text = input.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const finishCell = () => { row.push(cell); cell = ''; closed = false; };
  const finishRow = () => { finishCell(); if (row.some(value => value.trim() !== '')) records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      if (ch === ',') finishCell();
      else { finishRow(); if (ch === '\r' && text[i + 1] === '\n') i++; }
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else if (closed) { if (!/\s/.test(ch)) throw new Error('Unexpected text after a quoted CSV value.'); }
    else if (ch === '"') throw new Error('Quotes inside a CSV value must be escaped.');
    else cell += ch;
  }
  if (quoted) throw new Error('A quoted CSV value is not closed.');
  if (cell || row.length || closed) finishRow();
  const headers = records.shift()?.map(value => value.trim()) || [];
  if (!headers.length || headers.some(value => !value)) throw new Error('CSV must have a non-empty header for each column.');
  if (new Set(headers.map(h => h.toLowerCase())).size !== headers.length) throw new Error('CSV column headers must be unique.');
  if (records.length > 500) throw new Error('Import up to 500 rows at a time.');
  return { headers, rows: records.map((cells, index) => ({ rowNumber: index + 2, cells, error: cells.length === headers.length ? '' : `Expected ${headers.length} columns; found ${cells.length}.` })) };
}
export const FIELD_LABELS: Record<string, string> = { name: 'Partner name', phone: 'Phone', email: 'Email', notes: 'Notes', partner: 'Partner name or ID', amountRupees: 'Amount (whole rupees)', profitPercent: 'Profit % per month', receivedDate: 'Received date (YYYY-MM-DD)', returnDate: 'Return date (optional)', creditCardId: 'Credit card ID (optional)' };
export function autoMapping(headers: string[], fields: string[]): Record<string, string> {
  const aliases: Record<string, string[]> = { name: ['name', 'partnername'], partner: ['partner', 'partnerid', 'partnername'], amountRupees: ['amountrupees', 'amount', 'capital'], profitPercent: ['profitpercent', 'profitrate', 'rate'], receivedDate: ['receiveddate', 'date'], returnDate: ['returndate', 'duedate'], creditCardId: ['creditcardid', 'cardid'] };
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.fromEntries(fields.map(field => [field, headers.find(header => (aliases[field] || [field]).some(alias => normalize(alias) === normalize(header))) || '']));
}
