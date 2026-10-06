import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
import { PREFIX } from '../functions/capitalos-api/combinations.mjs';
const require = createRequire(import.meta.url);
const { buildDailySummary, dailyWindow, deliverSummary } = require('../functions/capitalos-api/daily-summary.js');
const { renderDailySummary } = require('../functions/capitalos-api/daily-summary-pdf.js');
const now = new Date('2026-10-06T17:30:00Z');
const window = dailyWindow(now);
const dataset = s => ({ partners: s.COS_Partners, allocations: s.COS_Allocations, returns: s.COS_Returns, profits: s.COS_Profits, cards: s.COS_CreditCards });
function seed() { const s = baseData(); s.COS_Allocations[0].credit_card_id = 'c'; s.COS_Allocations[0].notes = 'WA_CONFIRMED'; return s; }

describe('daily summary balances and scheduling', () => {
  it('uses only WhatsApp-confirmed dates, including mixed and missing dates on one card', () => {
    const s = seed();
    s.COS_Allocations.push({ ...s.COS_Allocations[0], ROWID: 'unconfirmed', return_date: '2026-10-01', notes: '' });
    expect(buildDailySummary(dataset(s), window).rows[0].due).toEqual(['2026-12-01', null]);
    s.COS_Allocations[0].return_date = null;
    expect(buildDailySummary(dataset(s), window).rows[0].due).toEqual([null]);
  });
  it('keeps a paid card at zero and sums unpaid profit across contributions', () => {
    const s = seed();
    expect(buildDailySummary(dataset(s), window).rows[0].profit).toBe(0);
    s.COS_Allocations.push({ ...s.COS_Allocations[0], ROWID: 'unpaid' });
    expect(buildDailySummary(dataset(s), window).rows[0].profit).toBe(300);
  });
  it.each([['2026-10-06T17:29:59Z', false, '2026-10-06'], ['2026-10-06T17:30:00Z', true, '2026-10-06'], ['2026-10-06T18:29:59Z', true, '2026-10-06'], ['2026-10-06T18:30:00Z', false, '2026-10-07']])('uses 11 PM IST: %s', (time, due, date) => {
    expect(dailyWindow(new Date(time))).toMatchObject({ due, date });
  });
  it('groups outstanding capital by card, preserves profit and separates original cashback entries', () => {
    const s = seed();
    s.COS_Allocations.push({ ...s.COS_Allocations[0], ROWID: 'b', amount_rupees: 20000, received_date: '2026-10-06', return_date: '2026-11-01', cashback_data: JSON.stringify({ status: 'unpaid', updatedAt: '2026-10-06T00:00:00Z' }) });
    const report = buildDailySummary(dataset(s), window);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ amount: 29000, profit: 600, due: ['2026-11-01', '2026-12-01'], last: '2026-10-06' });
    expect(report.cb.map(r => [r.amount, r.status])).toEqual([[10000, 'review'], [20000, 'unpaid']]);
    expect(report.activity).toMatchObject({ additions: 20000, returns: 0, profits: 0, cashback: 0, count: 1 });
  });
  it('orders due dates first and undated cards by latest transaction including cashback', () => {
    const s = seed(); s.COS_Allocations[0].return_date = null;
    for (const [id, due] of [['d', '2026-10-10'], ['e', null]]) {
      s.COS_CreditCards.push({ ...s.COS_CreditCards[0], ROWID: id, card_name: id });
      s.COS_Allocations.push({ ...s.COS_Allocations[0], ROWID: id, credit_card_id: id, return_date: due, cashback_data: JSON.stringify({ status: 'paid', amountRupees: 10, paidDate: '2026-10-06' }) });
    }
    expect(buildDailySummary(dataset(s), window).rows.map(r => r.card)).toEqual(['d', 'e', 'Synthetic Card']);
  });
  it('handles full returns, partial profit, paid/not-applicable cashback and unknown amounts independently', () => {
    const s = seed(); s.COS_Returns[0].amount_rupees = 10000;
    s.COS_Profits[0].notes = 'Partial payment · Remaining: ₹150';
    s.COS_Allocations[0].cashback_data = JSON.stringify({ status: 'paid', amountRupees: null, paidDate: '2026-10-06' });
    const report = buildDailySummary(dataset(s), window);
    expect(report.rows[0]).toMatchObject({ amount: 0, profit: 150 });
    expect(report.cb).toEqual([]);
    expect(report.activity).toMatchObject({ cashback: 0, unknownCashbackCount: 1, count: 1 });
    s.COS_Allocations[0].cashback_data = JSON.stringify({ status: 'not_applicable' });
    expect(buildDailySummary(dataset(s), window).cb).toEqual([]);
    delete s.COS_Allocations[0].cashback_data;
    expect(buildDailySummary(dataset(s), window).cb).toHaveLength(1);
  });
  it('does not double-count combined capital and retains original cashback and pending profit', () => {
    const s = seed(); s.COS_Profits = [];
    s.COS_Allocations.push({ ...s.COS_Allocations[0], ROWID: 'combined', amount_rupees: 9000, received_date: '2026-10-06', notes: PREFIX + JSON.stringify({ notes: '', combination: { effectiveDate: '2026-10-06', sources: [{ id: 'a', capital: 9000, pending: 300, profitRecordIds: [] }] } }) });
    const report = buildDailySummary(dataset(s), window);
    expect(report.rows[0]).toMatchObject({ amount: 9000, profit: 570 });
    expect(report.cb).toHaveLength(1); expect(report.activity.additions).toBe(0);
  });
  it('excludes deleted, hidden and future contributions/payments, and includes cash in daily activity only', () => {
    const s = seed();
    s.COS_Allocations.push({ ...s.COS_Allocations[0], ROWID: 'cash', credit_card_id: null, received_date: '2026-10-06' }, { ...s.COS_Allocations[0], ROWID: 'future', received_date: '2026-10-07' }, { ...s.COS_Allocations[0], ROWID: 'deleted', notes: 'DELETED:2026-10-01\n' });
    s.COS_Returns.push({ ...s.COS_Returns[0], ROWID: 'future', returned_date: '2026-10-07' });
    expect(buildDailySummary(dataset(s), window)).toMatchObject({ activity: { additions: 10000, count: 1 }, rows: [{ amount: 9000 }] });
    s.COS_Partners[0].notes = 'DELETED:2026-10-01\n';
    expect(buildDailySummary(dataset(s), window)).toMatchObject({ rows: [], cb: [], activity: { count: 0 } });
  });
  it.each([{ amount_rupees: -1 }, { received_date: '2026-02-30' }, { profit_percent: 'oops' }, { credit_card_id: 'missing' }, { cashback_data: '{' }])('fails closed on malformed financial data %j', patch => {
    const s = seed(); Object.assign(s.COS_Allocations[0], patch);
    expect(() => buildDailySummary(dataset(s), window)).toThrow();
  });
});

function setup(s = seed(), fail) {
  const h = createApiHarness(s, fail);
  const send = vi.fn().mockResolvedValue({ accepted: ['jackgun9@gmail.com'] });
  const render = vi.fn().mockResolvedValue(Buffer.from('%PDF-synthetic'));
  return { h, send, render, deps: { now, mode: 'scheduled', table: h.table, send, render } };
}
describe('daily email delivery', () => {
  it('skips inactive days and early invocations, while manual sends work without transactions', async () => {
    const { send, deps } = setup();
    expect(await deliverSummary(deps)).toMatchObject({ status: 'no_activity' });
    expect(await deliverSummary({ ...deps, now: new Date('2026-10-06T17:29:00Z') })).toMatchObject({ status: 'outside_schedule' });
    expect(send).not.toHaveBeenCalled();
    expect(await deliverSummary({ ...deps, mode: 'manual', requestId: 'manual-1234567890123456' })).toMatchObject({ status: 'sent' });
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'jackgun9@gmail.com', attachments: [{ contentType: 'application/pdf', filename: 'CapitalOS-Daily-Summary-2026-10-06.pdf' }] });
  });
  it.each(['capital', 'return', 'profit', 'cashback', 'late', 'backdated'])('triggers on %s activity and reserves only one scheduled send across retries/concurrency', async kind => {
    const s = seed();
    if (kind === 'capital') s.COS_Allocations[0].received_date = window.date;
    if (kind === 'return') s.COS_Returns[0].returned_date = window.date;
    if (kind === 'profit') s.COS_Profits[0].paid_date = window.date;
    if (kind === 'cashback') s.COS_Allocations[0].cashback_data = JSON.stringify({ status: 'paid', amountRupees: 50, paidDate: window.date });
    if (kind === 'late') s.COS_Profits[0].CREATEDTIME = '2026-10-05T18:00:00Z';
    if (kind === 'backdated') s.COS_Activity = [{ entity_type: 'COS_Profits', status: 'committed', occurred_at: '2026-10-06T10:00:00Z' }];
    const { send, deps, h } = setup(s);
    await Promise.all([deliverSummary(deps), deliverSummary(deps)]);
    await deliverSummary(deps);
    expect(send).toHaveBeenCalledOnce();
    expect(h.calls.filter(c => c.operation === 'insert').every(c => c.table === 'COS_Activity')).toBe(true);
    expect(h.db.COS_Activity.at(-1).entity_type).toBe('daily-summary-email');
    await deliverSummary({ ...deps, mode: 'manual', requestId: 'manual-1234567890123456' });
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('does not retry uncertain SMTP acceptance or an outcome-audit failure', async () => {
    const { h, send, deps } = setup();
    send.mockRejectedValue(new Error('SMTP timeout'));
    const manual = { ...deps, mode: 'manual', requestId: 'manual-1234567890123456' };
    expect(await deliverSummary(manual)).toMatchObject({ status: 'unconfirmed' });
    expect(await deliverSummary(manual)).toMatchObject({ status: 'unconfirmed' });
    expect(send).toHaveBeenCalledOnce();
    expect(h.db.COS_Returns).toHaveLength(1);
    const failed = setup(seed(), (table, op, data) => table === 'COS_Activity' && op === 'insert' && data.event_id.endsWith('-result'));
    await deliverSummary({ ...failed.deps, mode: 'manual', requestId: manual.requestId });
    await deliverSummary({ ...failed.deps, mode: 'manual', requestId: manual.requestId });
    expect(failed.send).toHaveBeenCalledOnce();
  });
  it('fails before sending on an incomplete later data page or renderer failure', async () => {
    const s = seed(); s.COS_Allocations.push(...Array.from({ length: 201 }, (_, n) => ({ ...s.COS_Allocations[0], ROWID: `extra-${n}` })));
    const { deps, send } = setup(s, (table, action, options) => table === 'COS_Allocations' && action === 'page' && options.nextToken === '200');
    await expect(deliverSummary({ ...deps, mode: 'manual', requestId: 'manual-1234567890123456' })).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    const normal = setup(); normal.render.mockRejectedValue(new Error('PDF failed'));
    await expect(deliverSummary({ ...normal.deps, mode: 'manual', requestId: 'manual-1234567890123456' })).rejects.toThrow('PDF failed');
    expect(normal.h.db.COS_Activity).toEqual([]); expect(normal.send).not.toHaveBeenCalled();
  });
  it('renders a real PDF including empty sections and many rows', async () => {
    const report = buildDailySummary(dataset(seed()), window);
    const pdf = await renderDailySummary(report); expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    report.rows = Array.from({ length: 100 }, (_, n) => ({ ...report.rows[0], card: `Card ${n}` }));
    const large = await renderDailySummary(report); expect(large.length).toBeGreaterThan(pdf.length);
    report.rows = []; report.cb = []; expect((await renderDailySummary(report)).length).toBeGreaterThan(1000);
  });
});

it('omits repeat card transactions from cashback follow-up without dropping capital', () => {
  const s = seed();
  s.COS_Allocations.push({ ...s.COS_Allocations[0], ROWID: 'repeat', received_date: '2026-01-02', cashback_data: JSON.stringify({ status: 'unpaid', updatedAt: '2026-10-06T00:00:00Z' }) });
  const report = buildDailySummary(dataset(s), window);
  expect(report.cb).toHaveLength(1);
  expect(report.cb[0].date).toBe('2026-01-02');
  expect(report.rows[0].amount).toBe(19000);
});

it('keeps all unselected same-day transactions in review regardless of creation order', () => {
  const s = seed();
  Object.assign(s.COS_Allocations[0], { CREATEDTIME: '2026-09-01T00:00:00Z', source_created_time: '2026-01-01T02:00:00Z' });
  s.COS_Allocations.push({ ...s.COS_Allocations[0], ROWID: 'earlier', amount_rupees: 12000, CREATEDTIME: '2026-09-02T00:00:00Z', source_created_time: '2026-01-01T01:00:00Z' });
  const report = buildDailySummary(dataset(s), window);
  expect(report.cb).toHaveLength(2);
  expect(report.cb.every(row => row.status === 'review')).toBe(true);
});
