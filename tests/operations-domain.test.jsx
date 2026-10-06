import { describe, expect, it } from 'vitest';
import { buildStatement } from '../client/src/lib/statements';
import { parseCSV } from '../client/src/lib/importCsv';
import { escapeCell } from '../client/src/lib/csv';
import { businessToday, financialYearRange, financialYearStart, monthlyAnniversary } from '../client/src/lib/businessDates';
import { buildObligations, planningSummary } from '../client/src/lib/planning';
import { previewImport } from '../functions/capitalos-api/imports.mjs';

const entry = (id, date, eventType, amountRupees, partnerId = 'p') => ({ id, date, eventType, amountRupees, partnerId, createdAt: `${date}T00:00:00Z`, notes: '', refId: id, allocationId: 'a' });
const allocation = (id, overrides = {}) => ({ id, partnerId: 'p', partner: { name: 'Partner' }, amountRupees: 10000, capitalOutstanding: 10000, profitPercent: 3, receivedDate: '2026-08-01', returnDate: '2026-09-25', creditCardId: null, totalCapitalReturned: 0, profitPending: 300, firstProfitDueDate: null, ...overrides });

describe('period statements', () => {
  it('reconciles opening/closing balances and does not subtract profit from principal', () => {
    const ledger = [entry('1', '2026-03-30', 'CAPITAL_RECEIVED', 10000), entry('2', '2026-03-31', 'CAPITAL_RETURNED', 1000), entry('3', '2026-04-01', 'CAPITAL_RECEIVED', 5000), entry('4', '2026-04-10', 'PROFIT_PAID', 100.49), entry('5', '2027-03-31', 'CAPITAL_RETURNED', 2000), entry('6', '2027-04-01', 'CAPITAL_RETURNED', 3000), entry('7', '2026-05-01', 'CAPITAL_RECEIVED', 999999, 'other')];
    const statement = buildStatement(ledger, 'p', '2026-04-01', '2027-03-31');
    expect(statement).toMatchObject({ openingPrincipal: 9000, received: 5000, returned: 2000, profitPaid: 100.49, closingPrincipal: 12000 });
    expect(statement.rows.map(e => e.runningBalance)).toEqual([14000, 14000, 12000]);
  });
  it('preserves opening balances in an empty period and rejects invalid dates', () => {
    expect(buildStatement([entry('1', '2026-01-01', 'CAPITAL_RECEIVED', 100)], 'p', '2026-02-01', '2026-02-28')).toMatchObject({ rows: [], openingPrincipal: 100, closingPrincipal: 100 });
    expect(() => buildStatement([], 'p', '2026-02-31', '2026-03-01')).toThrow();
    expect(() => buildStatement([], 'p', '2026-03-01', '2026-02-01')).toThrow();
  });
});
it('uses India business dates, Apr–Mar years and clamped month anniversaries', () => {
  expect(businessToday(new Date('2026-09-17T18:45:00Z'))).toBe('2026-09-18');
  expect(financialYearStart('2026-03-31')).toBe(2025);
  expect(financialYearRange(2025)).toEqual({ from: '2025-04-01', to: '2026-03-31' });
  expect(monthlyAnniversary('2024-01-31', 1)).toBe('2024-02-29');
  expect(monthlyAnniversary('2024-01-31', 2)).toBe('2024-03-31');
});
describe('CSV parsing and preview', () => {
  it('handles BOM, CRLF, quoted commas, escaped quotes and multiline notes', () => {
    const csv = parseCSV('\uFEFFname,notes\r\n"Partner, A","Said ""hello""\nand goodbye"\r\n');
    expect(csv.headers).toEqual(['name', 'notes']); expect(csv.rows[0].cells).toEqual(['Partner, A', 'Said "hello"\nand goodbye']);
  });
  it('rejects ambiguous headers and malformed quotes and identifies width errors', () => {
    expect(() => parseCSV('name,Name\nA,B')).toThrow('unique');
    expect(() => parseCSV('name\n"open')).toThrow('not closed');
    expect(parseCSV('name,notes\nA,B,C').rows[0].error).toContain('3');
  });
  it('rejects malformed mapped rows without aborting the batch', () => {
    expect(previewImport('partners', [null, { values: [] }], { partners: [] }).map(row => row.status)).toEqual(['rejected', 'rejected']);
  });
  it('validates mappings with duplicates, ambiguous partners, fractional values and bad dates', () => {
    const context = { partners: [{ id: 'p', name: 'A', phone: '123' }, { id: 'q', name: 'A' }], allocations: [], creditCards: [] };
    expect(previewImport('partners', [{ rowNumber: 2, values: { name: 'B', phone: '123' } }], context)[0].status).toBe('duplicate');
    const bad = previewImport('allocations', [{ rowNumber: 2, values: { partner: 'A', amountRupees: '100.50', profitPercent: '3', receivedDate: '2026-02-31' } }], context)[0];
    expect(bad.status).toBe('rejected'); expect(bad.messages.join(' ')).toMatch(/ambiguous/); expect(bad.messages.join(' ')).toMatch(/not rounded/);
    const row = { rowNumber: 2, values: { partner: 'p', amountRupees: '1,00,000', profitPercent: '0', receivedDate: '2026-02-28' } };
    const preview = previewImport('allocations', [row, { ...row, rowNumber: 3 }], context);
    expect(preview.map(r => r.status)).toEqual(['ready', 'duplicate']); expect(preview[0].data.amountRupees).toBe(100000);
  });
});
it('exports untrusted formula-like text literally while preserving numeric money cells', () => {
  for (const text of ['=1+1', '+919999999999', '-1+1', '@SUM(A1)', '\t=1+1', '  =1+1']) expect(escapeCell(text)).toContain("'");
  expect(escapeCell(-123.45)).toBe('-123.45');
  expect(escapeCell('a,"b"')).toBe('"a,""b"""');
});
describe('liability planning', () => {
  it('separates overdue, undated and cumulative future principal', () => {
    const plan = planningSummary([allocation('a', { returnDate: '2026-09-24' }), allocation('b', { returnDate: '2026-10-10', partnerId: 'q', partner: { name: 'Other' }, creditCardId: 'c', creditCard: { cardName: 'Card' } }), allocation('c', { returnDate: null }), allocation('d', { returnDate: '2026-09-01' })], '2026-09-18');
    expect(plan.overdue).toBe(10000); expect(plan.undated).toBe(10000);
    expect(plan.horizons.map(h => h.principal)).toEqual([10000, 20000, 20000]);
    expect(plan.partners.reduce((sum, p) => sum + p.share, 0)).toBe(100);
    expect(plan.cards.find(c => c.id === 'c').share).toBe(25);
  });
  it('does not project profit after maturity or double count transferred source capital', () => {
    const source = allocation('source', { capitalOutstanding: 0 });
    const combined = allocation('combined', { combination: { sources: [{ id: 'source' }] }, receivedDate: '2026-09-01', returnDate: '2026-10-15', firstProfitDueDate: '2026-09-01' });
    const obligations = buildObligations([source, combined], '2026-09-18');
    expect(obligations.filter(o => o.kind === 'principal').map(o => o.allocationId)).toEqual(['combined']);
    expect(obligations.filter(o => o.kind === 'profit-estimate').map(o => o.date)).toEqual(['2026-10-01']);
  });
  it('switches a future combination at its effective date without projecting both sources', () => {
    const source = allocation('source', { returnDate: '2026-12-01' });
    const combined = allocation('combined', { capitalOutstanding: 0, combination: { sources: [{ id: 'source' }] }, receivedDate: '2026-10-01', returnDate: '2026-12-01', firstProfitDueDate: '2026-10-01' });
    const obligations = buildObligations([source, combined], '2026-09-18');
    expect(obligations.filter(o => o.kind === 'principal').map(o => o.allocationId)).toEqual(['combined']);
    expect(obligations.filter(o => o.allocationId === 'source')).toEqual([]);
  });
});
