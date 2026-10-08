import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
import { prepareProfitClosure } from '../functions/capitalos-api/profit-closure.mjs';
import { pendingProfit } from '../functions/capitalos-api/payment-groups.mjs';
const a = { id: 'a', partnerId: 'p', amountRupees: 150000, profitPercent: 4, receivedDate: '2026-09-01', notes: '' };
const input = { allocationId: 'a', partnerId: 'p', expectedPending: 6000, confirmed: true, recur: false };
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-08T10:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });
it.each([false, true])('closes a full balance with zero paid and respects recurrence (%s)', recur => {
  const closed = { ...prepareProfitClosure({ ...input, recur }, [a], [], [], '2026-10-08'), id: 'close' };
  expect(closed.amountRupees).toBe(0);
  expect(pendingProfit(a, [a], [closed], '2026-10-08')).toBe(0);
  expect(pendingProfit(a, [a], [closed], '2026-11-01')).toBe(recur ? 6000 : 0);
});
it('waives only the remaining partial balance without changing prior payments', () => {
  const paid = { id: 'paid', allocationId: 'a', amountRupees: 2000, paidDate: '2026-10-01', notes: 'Partial payment · Remaining: ₹4,000' };
  const closed = { ...prepareProfitClosure({ ...input, expectedPending: 4000 }, [a], [paid], [], '2026-10-08'), id: 'close' };
  expect(pendingProfit(a, [a], [paid, closed], '2026-10-08')).toBe(0);
  expect(paid.amountRupees + closed.amountRupees).toBe(2000);
  expect(pendingProfit(a, [a], [paid], '2026-10-08')).toBe(4000); // deleting closure reopens balance
});
it('closes returned principal and combined-source profit without permitting recurrence', () => {
  const returns = [{ allocationId: 'a', amountRupees: 150000, returnedDate: '2026-10-01' }];
  expect(prepareProfitClosure(input, [a], [], returns, '2026-10-08').amountRupees).toBe(0);
  expect(() => prepareProfitClosure({ ...input, recur: true }, [a], [], returns, '2026-10-08')).toThrow(/cannot recur/);
  const parent = { ...a, id: 'combined', combination: { sources: [{ id: 'a', pending: 6000, profitRecordIds: [] }] } };
  const closed = { ...prepareProfitClosure(input, [a, parent], [], [], '2026-10-08'), id: 'close' };
  expect(pendingProfit(a, [a, parent], [closed], '2026-10-08')).toBe(0);
});
it.each([{ confirmed: false }, { expectedPending: 1 }, { amountRupees: 100 }, { partnerId: 'wrong' }])('rejects unconfirmed, stale or invalid closure %j', patch => {
  expect(() => prepareProfitClosure({ ...input, ...patch }, [a], [], [], '2026-10-08')).toThrow();
});
it('persists an auditable zero closure, reloads it, sends no mail and rejects duplicates and payment edits', async () => {
  const seed = baseData(); seed.COS_Profits = []; const send = vi.fn(); const h = createApiHarness(seed, undefined, send);
  const body = { ...input, expectedPending: 300 };
  const result = await h.request('POST', 'profit-records/close', body);
  expect(result).toMatchObject({ status: 'success', data: { amountRupees: 0, paidDate: '2026-10-08', notes: expect.stringContaining('Profit closed without payment') } });
  expect((await h.request('GET', 'profit-records')).data).toContainEqual(expect.objectContaining({ id: result.data.id, amountRupees: 0 }));
  expect(h.db.COS_Activity.some(e => e.status === 'committed')).toBe(true);
  expect(send).not.toHaveBeenCalled();
  expect(await h.request('POST', 'profit-records/close', body)).toMatchObject({ status: 'error' });
  expect(await h.request('PATCH', `profit-records/${result.data.id}`, { amountRupees: 100 })).toMatchObject({ status: 'error' });
  expect(h.db.COS_Profits).toHaveLength(1);
});
it('updates the store after closure and reload, including the next recurring month', async () => {
  const seed = baseData(); seed.COS_Profits = []; const h = createApiHarness(seed);
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    const result = await h.request(options?.method || 'GET', String(url).replace('/server/capitalos-api/', ''), options?.body ? JSON.parse(options.body) : undefined);
    return new Response(JSON.stringify(result), { status: result.status === 'success' ? 200 : 400 });
  }));
  const store = await import('../client/src/store');
  await vi.waitFor(() => expect(store.isLoaded()).toBe(true));
  await store.closeProfit({ ...input, expectedPending: 300, recur: true });
  expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: 0, totalProfitPaid: 0, nextMonthProfit: 270 });
  await store.loadAll();
  expect(store.getAllocationSummaries()[0].profitPending).toBe(0);
  vi.setSystemTime(new Date('2026-11-01T10:00:00Z'));
  expect(store.getAllocationSummaries()[0].profitPending).toBe(270);
});
