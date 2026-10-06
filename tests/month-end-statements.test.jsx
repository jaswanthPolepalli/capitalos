import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
const { monthEndWindow, buildStatements, renderStatement, sendMonthlyStatements } = createRequire(import.meta.url)('../functions/capitalos-api/month-end-statements.js');
const now = new Date('2026-09-30T04:30:00Z');
const window = monthEndWindow(now);
function dataset(seed = baseData()) { return { partners: seed.COS_Partners, allocations: seed.COS_Allocations, returns: seed.COS_Returns, profits: seed.COS_Profits }; }
function setup(fail) {
  const seed = baseData();
  seed.COS_Partners[0].email = 'partner@example.test';
  seed.COS_Partners.push({ ROWID: 'p2', name: 'Second Partner', email: 'second@example.test', notes: '' });
  const h = createApiHarness(seed, fail);
  const send = vi.fn().mockResolvedValue(undefined);
  const deps = { now, loadData: async () => dataset(h.db), activity: h.table('COS_Activity'), events: async () => structuredClone(h.db.COS_Activity), send };
  return { h, send, deps };
}
afterEach(() => vi.restoreAllMocks());

describe('month-end scheduling and calculations', () => {
  it.each([
    ['2026-09-29T04:30:00Z', false], ['2026-09-30T04:29:59Z', false], ['2026-09-30T04:30:00Z', true],
    ['2026-02-28T04:30:00Z', true], ['2028-02-28T04:30:00Z', false], ['2028-02-29T04:30:00Z', true],
    ['2026-01-30T04:30:00Z', false], ['2026-01-31T04:30:00Z', true], ['2026-12-31T04:30:00Z', true],
    ['2026-09-30T18:29:59Z', true], ['2026-09-30T18:30:00Z', false],
  ])('recognizes the last day at/after 10 AM IST: %s', (iso, due) => expect(monthEndWindow(new Date(iso)).due).toBe(due));
  it('separates current-month cash movements from cumulative unpaid and capital balances', () => {
    const seed = baseData();
    seed.COS_Profits[0].notes = 'Partial payment · Remaining: ₹200';
    seed.COS_Allocations.push({ ...seed.COS_Allocations[0], ROWID: 'b', amount_rupees: 20000, received_date: '2026-09-05' });
    seed.COS_Returns.push({ ...seed.COS_Returns[0], ROWID: 'r2', amount_rupees: 500, returned_date: '2026-09-30' });
    seed.COS_Profits.push({ ...seed.COS_Profits[0], ROWID: 'f2', allocation_id: 'b', amount_rupees: 100, paid_date: '2026-09-15', notes: 'Partial payment · Remaining: ₹500' });
    expect(buildStatements(dataset(seed), window)[0]).toMatchObject({ contributed: 20000, returned: 500, profitPaid: 100, profitRemaining: 700, openingCapital: 9000, closingCapital: 28500 });
  });
  it('excludes hidden/deleted and future-dated records, but includes zero-activity active partners', () => {
    const seed = baseData();
    seed.COS_Partners.push({ ROWID: 'deleted', notes: 'DELETED:2026-09-01T00:00:00Z\n' }, { ROWID: 'zero', name: 'Zero', notes: '' });
    seed.COS_Allocations.push({ ...seed.COS_Allocations[0], ROWID: 'hidden', partner_id: 'deleted' }, { ...seed.COS_Allocations[0], ROWID: 'future', received_date: '2026-10-01' });
    seed.COS_Returns.push({ ...seed.COS_Returns[0], ROWID: 'future-return', returned_date: '2026-10-01' });
    seed.COS_Profits.push({ ...seed.COS_Profits[0], ROWID: 'deleted-profit', paid_date: '2026-09-10', notes: 'DELETED:2026-09-11T00:00:00Z\n' });
    const results = buildStatements(dataset(seed), window);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ contributed: 0, returned: 0, profitPaid: 0, closingCapital: 9000 });
    expect(results[1]).toMatchObject({ contributed: 0, returned: 0, profitPaid: 0, profitRemaining: 0, closingCapital: 0 });
  });
  it('does not double count combined capital and retains profit on its source entries', async () => {
    const seed = baseData(); seed.COS_Profits = [];
    seed.COS_Allocations.push({ ...seed.COS_Allocations[0], ROWID: 'b', received_date: '2026-09-05' });
    const h = createApiHarness(seed);
    const combined = await h.request('POST', 'allocations/combine', { allocationIds: ['a', 'b'], effectiveDate: '2026-09-20', profitPercent: 3, returnDate: null });
    expect(combined.status).toBe('success');
    h.db.COS_Returns.push({ ROWID: 'combined-return', partner_id: 'p', allocation_id: combined.data.id, amount_rupees: 2000, returned_date: '2026-09-25', notes: '' });
    expect(buildStatements(dataset(h.db), window)[0]).toMatchObject({ contributed: 10000, returned: 2000, openingCapital: 9000, closingCapital: 17000, profitRemaining: 1170 });
  });
  it('includes the recurring October cycle after a September settlement without projecting November', () => {
    const seed = baseData();
    seed.COS_Returns = [];
    seed.COS_Allocations[0].amount_rupees = 300000;
    seed.COS_Profits = [{ ROWID: 'sept', allocation_id: 'a', partner_id: 'p', amount_rupees: 9000, paid_date: '2026-09-30', notes: 'Capital reinvested' }];
    expect(buildStatements(dataset(seed), monthEndWindow(new Date('2026-10-31T04:30:00Z')))[0]).toMatchObject({ profitRemaining: 9000, profitPaid: 0 });
    seed.COS_Profits.push({ ROWID: 'oct', allocation_id: 'a', partner_id: 'p', amount_rupees: 9000, paid_date: '2026-10-31', notes: '' });
    expect(buildStatements(dataset(seed), monthEndWindow(new Date('2026-11-30T04:30:00Z')))[0]).toMatchObject({ profitRemaining: 0 });
  });
  it('does not erase unpaid profit when capital is fully returned', () => {
    const seed = baseData(); seed.COS_Profits = []; seed.COS_Returns[0].amount_rupees = 10000;
    expect(buildStatements(dataset(seed), window)[0]).toMatchObject({ closingCapital: 0, profitRemaining: 300 });
  });
  it('refuses malformed data instead of emailing misleading totals', () => {
    const seed = baseData(); seed.COS_Allocations[0].amount_rupees = 'invalid';
    expect(() => buildStatements(dataset(seed), window)).toThrow('Invalid money');
  });
  it('renders the period, actual cutoff, scoped balances, portal and escaped names', () => {
    const statement = { ...buildStatements(dataset(), window)[0], partnerName: '<Test & Partner>' };
    const mail = renderStatement(statement, 'https://example.test/app');
    for (const phrase of ['September 2026', 'Capital contributed this month', 'Capital returned this month', 'Profits paid this month', 'Profit remaining at cutoff (including earlier unpaid dues)', '10:00 am IST', '&lt;Test &amp; Partner&gt;', '/#/p/partner-p']) expect(mail.html).toContain(phrase);
    expect(mail.text).toContain('Later entries and corrections');
    expect(mail.subject).toBe('Monthly Statement — September 2026 — CapitalOS');
  });
});

describe('monthly delivery reservations', () => {
  it('sends once per active partner/month, preserving the original snapshot on retry', async () => {
    const { h, send, deps } = setup();
    const first = await sendMonthlyStatements(deps);
    expect(first.results.every(r => r.status === 'sent')).toBe(true); expect(send).toHaveBeenCalledTimes(2);
    h.db.COS_Allocations[0].amount_rupees = 50000;
    expect(await sendMonthlyStatements(deps)).toEqual(first); expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(h.db.COS_Activity.find(e => e.status === 'prepared' && e.entity_id === 'p').after_state).closingCapital).toBe(9000);
    await sendMonthlyStatements({ ...deps, now: new Date('2026-10-31T04:30:00Z') }); expect(send).toHaveBeenCalledTimes(4);
  });
  it('does not load or send outside the schedule', async () => {
    const { send, deps } = setup(); const loadData = vi.fn();
    expect(await sendMonthlyStatements({ ...deps, now: new Date('2026-09-25T04:30:00Z'), loadData })).toMatchObject({ skipped: 'outside_schedule' });
    expect(loadData).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
  it('aborts before emailing if required data loading fails', async () => {
    const { send, deps } = setup();
    await expect(sendMonthlyStatements({ ...deps, loadData: async () => { throw new Error('Missing page'); } })).rejects.toThrow('Missing page');
    expect(send).not.toHaveBeenCalled();
  });
  it('records skipped missing addresses and does not send them mail', async () => {
    const { h, send, deps } = setup(); h.db.COS_Partners[0].email = '';
    const result = await sendMonthlyStatements(deps);
    expect(result.results.map(r => r.status)).toEqual(['no_email', 'sent']); expect(send).toHaveBeenCalledOnce();
  });
  it('does not resend after an uncertain SMTP response and continues other partners', async () => {
    const { send, deps } = setup(); send.mockRejectedValueOnce(new Error('SMTP response lost'));
    expect((await sendMonthlyStatements(deps)).results.map(r => r.status)).toEqual(['unconfirmed', 'sent']);
    await sendMonthlyStatements(deps); expect(send).toHaveBeenCalledTimes(2);
  });
  it('prevents duplicate email under concurrent executions', async () => {
    const { send, deps } = setup(); await Promise.all([sendMonthlyStatements(deps), sendMonthlyStatements(deps)]);
    expect(send).toHaveBeenCalledTimes(2);
    expect((await sendMonthlyStatements(deps)).results.every(r => r.status === 'sent')).toBe(true);
  });
  it('saves all snapshots and resumes unsent partners after a time-budget stop', async () => {
    const { h, send, deps } = setup();
    expect((await sendMonthlyStatements({ ...deps, remainingTime: () => 1000 })).results.every(r => r.status === 'not_attempted')).toBe(true);
    expect(send).not.toHaveBeenCalled();
    h.db.COS_Allocations[0].amount_rupees = 50000;
    await sendMonthlyStatements(deps);
    expect(send.mock.calls[0][0].closingCapital).toBe(9000); expect(send).toHaveBeenCalledTimes(2);
  });
  it('does not send any email if snapshot reservations cannot be completed', async () => {
    const { send, deps } = setup((table, action, row) => table === 'COS_Activity' && action === 'insert' && row.entity_id === 'p2');
    await expect(sendMonthlyStatements(deps)).rejects.toThrow('reserve every monthly statement'); expect(send).not.toHaveBeenCalled();
  });
  it('does not resend accepted mail when its outcome audit fails', async () => {
    const { send, deps } = setup((table, action, row) => table === 'COS_Activity' && action === 'insert' && row.event_id.endsWith('-done'));
    expect((await sendMonthlyStatements(deps)).results.every(r => r.status === 'unconfirmed')).toBe(true);
    await sendMonthlyStatements(deps); expect(send).toHaveBeenCalledTimes(2);
  });
});

it('adds cashback to total profits received but never deducts it from pending regular profit', () => {
  const seed = baseData();
  seed.COS_Profits[0].notes = 'Partial payment · Remaining: ₹200';
  const baseline = buildStatements(dataset(seed), window)[0];
  seed.COS_Allocations[0].cashback_data = JSON.stringify({ status: 'paid', amountRupees: 500, paidDate: '2026-09-15' });
  const result = buildStatements(dataset(seed), window)[0];
  expect(result).toMatchObject({ cashbackPaid: 500, totalProfitsReceived: baseline.profitPaid + 500, profitRemaining: baseline.profitRemaining });
  seed.COS_Allocations[0].cashback_data = JSON.stringify({ status: 'paid', amountRupees: null, paidDate: '2026-09-15' });
  const unknown = buildStatements(dataset(seed), window)[0];
  expect(unknown).toMatchObject({ cashbackPaid: 0, unknownCashbackCount: 1, profitRemaining: baseline.profitRemaining });
  expect(renderStatement(unknown, 'https://example.test').text).toContain('1 cashback amount(s) not recorded');
});
