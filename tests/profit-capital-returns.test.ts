import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as store from '../client/src/store.js';
import { buildCombination, pending } from '../functions/capitalos-api/combinations.mjs';
import type { CapitalAllocation, CapitalReturn, ProfitRecord } from '../client/src/store.js';

let allocation: CapitalAllocation;
let returns: CapitalReturn[];
let profits: ProfitRecord[];
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));
  allocation = { id: 'a', partnerId: 'p', amountRupees: 178500, profitPercent: 3, receivedDate: '2026-09-02', returnDate: null, creditCardId: null, notes: 'AXIS CC' };
  returns = [{ id: 'r', partnerId: 'p', allocationId: 'a', amountRupees: 162500, returnedDate: '2026-09-22', notes: '' }];
  profits = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const data: Record<string, unknown> = { partners: [{ id: 'p', name: 'Partner' }], allocations: [allocation], 'capital-returns': returns, 'profit-records': profits, 'credit-cards': [] };
    return new Response(JSON.stringify({ status: 'success', data: data[url.split('/').at(-1)!] ?? [] }));
  }));
  await store.loadAll();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('retains original unpaid profit after partial and full principal returns, including reload', async () => {
  expect(store.getAllocationSummaries()[0]).toMatchObject({ capitalOutstanding: 16000, profitPending: 5355, currentCycleProfit: 5355, expectedMonthlyProfit: 480, profitAccrued: 5355 });
  expect(store.getPartnerSummaries()[0]?.totalProfitPending).toBe(5355);
  expect(store.getPortfolioTotals().totalProfitPending).toBe(5355);
  returns[0]!.amountRupees = 178500;
  await store.loadAll();
  expect(store.getAllocationSummaries()[0]).toMatchObject({ capitalOutstanding: 0, profitPending: 5355, expectedMonthlyProfit: 0, nextMonthProfit: 0 });
});

it.each([
  ['Partial payment', 4355],
  ['Partial payment · Remaining: ₹2,000', 2000],
  ['Partial payment · Remaining %: 1.5%', 2678],
  ['Full profit paid', 0],
])('keeps frontend and combination profit calculations consistent for %s', async (notes, expected) => {
  profits.push({ id: '1', partnerId: 'p', allocationId: 'a', amountRupees: 1000, paidDate: '2026-09-23', notes });
  await store.loadAll();
  expect(store.getAllocationSummaries()[0]?.profitPending).toBe(expected);
  expect(pending(allocation, profits)).toBe(expected);
});

it('calculates future recurring profit only on remaining deployed capital', async () => {
  profits.push({ id: '1', partnerId: 'p', allocationId: 'a', amountRupees: 5355, paidDate: '2026-09-23', notes: 'Capital reinvested' });
  await store.loadAll();
  expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: 0, nextMonthProfit: 480, profitAccrued: 5355 });
});

it('combines remaining capital while preserving the original unpaid profit', () => {
  const other = { ...allocation, id: 'b', amountRupees: 10000 };
  const result = buildCombination({ allocationIds: ['a', 'b'], effectiveDate: '2026-09-23', profitPercent: 3, returnDate: null }, [allocation, other], returns, []);
  expect(result.amountRupees).toBe(26000);
  expect(result.combination.sources).toContainEqual({ id: 'a', capital: 16000, pending: 5355, profitRecordIds: [] });
});

it('does not make future contributions payable early', async () => {
  allocation.receivedDate = '2026-10-01';
  returns.length = 0;
  await store.loadAll();
  expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: 0, capitalOutstanding: 0 });
});
