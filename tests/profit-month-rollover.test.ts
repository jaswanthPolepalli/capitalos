import { afterEach, describe, expect, it, vi } from 'vitest';
import { pendingProfit, preparePaymentGroup } from '../functions/capitalos-api/payment-groups.mjs';
import { buildCombination } from '../functions/capitalos-api/combinations.mjs';
import type { CapitalAllocation, CapitalReturn, ProfitRecord } from '../client/src/store.js';

const allocation: CapitalAllocation = { id: 'a', partnerId: 'p', amountRupees: 300000, profitPercent: 3, receivedDate: '2026-09-02', returnDate: null, creditCardId: null, notes: '' };
const september: ProfitRecord = { id: '1', allocationId: 'a', partnerId: 'p', amountRupees: 9000, paidDate: '2026-09-30', notes: 'Capital reinvested' };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

async function setup(payment = september, returns: CapitalReturn[] = []) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
  const profits = [{ ...payment }];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    const table = url.split('/').pop()!;
    if (options?.method === 'PATCH') {
      Object.assign(profits.find(p => p.id === table)!, JSON.parse(String(options.body)));
      return new Response(JSON.stringify({ status: 'success', data: profits.find(p => p.id === table) }));
    }
    if (options?.method === 'POST') {
      const record = { ...JSON.parse(String(options.body)), id: String(profits.length + 1) };
      profits.push(record);
      return new Response(JSON.stringify({ status: 'success', data: record }));
    }
    const data: Record<string, unknown> = { allocations: [allocation], partners: [{ id: 'p', name: 'Santhosh' }], 'capital-returns': returns, 'profit-records': profits, 'credit-cards': [] };
    return new Response(JSON.stringify({ status: 'success', data: data[table] || [] }));
  }));
  const store = await import('../client/src/store.js');
  await vi.waitFor(() => expect(store.isLoaded()).toBe(true));
  return store;
}

describe('monthly recurring profit rollover', () => {
  it('editing September Recur creates October pending without skipping to November, including reload', async () => {
    const store = await setup({ ...september, notes: '' });
    expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: 0, nextMonthProfit: 0 });
    await store.updateProfitRecord('1', { notes: 'Capital reinvested' });
    expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: 9000, nextMonthProfit: 0 });
    await store.loadAll();
    expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: 9000, nextMonthProfit: 0 });
    expect(store.getPortfolioTotals().totalProfitPending).toBe(9000);
  });
  it.each([false, true])('only an October payment with Recur creates November upcoming (Recur: %s)', async recur => {
    const store = await setup();
    await store.addProfitRecord({ allocationId: 'a', partnerId: 'p', amountRupees: 9000, paidDate: '2026-10-01', notes: recur ? 'Capital reinvested' : '' });
    expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: 0, nextMonthProfit: recur ? 9000 : 0 });
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: recur ? 9000 : 0, nextMonthProfit: 0 });
  });
  it('partial October profit remains pending and does not create November early', async () => {
    const store = await setup();
    await store.addProfitRecord({ allocationId: 'a', partnerId: 'p', amountRupees: 3000, paidDate: '2026-10-01', notes: 'Partial payment · Remaining: ₹6,000 · Capital reinvested' });
    expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: 6000, nextMonthProfit: 0 });
  });
  it('preserves October debt when principal returns during October, using returns before the cycle to determine the amount', () => {
    const returned = (date: string): CapitalReturn => ({ id: 'r', allocationId: 'a', partnerId: 'p', amountRupees: 100000, returnedDate: date, notes: '' });
    expect(pendingProfit(allocation, [allocation], [september], '2026-10-10', [returned('2026-09-30')])).toBe(6000);
    expect(pendingProfit(allocation, [allocation], [september], '2026-10-10', [returned('2026-10-01')])).toBe(9000);
    expect(pendingProfit(allocation, [allocation], [september], '2026-11-01', [])).toBe(9000);
  });
  it('allows the October recurring balance to be paid through grouped payment validation', () => {
    const result = preparePaymentGroup({ groupId: '12345678-1234-1234-1234-123456789abc', kind: 'profit', partnerId: 'p', date: '2026-10-01', reference: '', notes: '', entries: [{ allocationId: 'a', amountRupees: 9000, expectedBalance: 9000, recur: true }] }, [allocation], [], [september], '2026-10-01');
    expect(result[0]).toMatchObject({ amountRupees: 9000, paidDate: '2026-10-01', notes: 'Capital reinvested' });
  });
  it('retains a recurring source’s October unpaid profit when capital is combined in October', () => {
    const other = { ...allocation, id: 'b' };
    const result = buildCombination({ allocationIds: ['a', 'b'], effectiveDate: '2026-10-01', profitPercent: 3, returnDate: null }, [allocation, other], [], [september]);
    expect(result.combination.sources.find(source => source.id === 'a')?.pending).toBe(9000);
  });
  it('handles December recurrence into January without creating an extra cycle', () => {
    expect(pendingProfit(allocation, [allocation], [{ ...september, paidDate: '2026-12-31' }], '2027-01-01')).toBe(9000);
  });
});
