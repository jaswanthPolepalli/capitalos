import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCombination, decode, PREFIX, revertReason, firstCombinedProfitDate } from '../functions/capitalos-api/combinations.mjs';
import type { CombineInput } from '../functions/capitalos-api/combinations.mjs';
import type { CapitalAllocation, ProfitRecord } from '../client/src/store.js';

const originals: CapitalAllocation[] = [
  { id: '1', partnerId: 'p', amountRupees: 50000, profitPercent: 3, receivedDate: '2026-08-05', returnDate: null, creditCardId: null, notes: 'First capital' },
  { id: '2', partnerId: 'p', amountRupees: 100000, profitPercent: 4, receivedDate: '2026-08-20', returnDate: null, creditCardId: null, notes: 'Second capital' },
];
const profits: ProfitRecord[] = [
  { id: 'p1', partnerId: 'p', allocationId: '1', amountRupees: 1200, paidDate: '2026-08-31', notes: 'August settled' },
  { id: 'p2', partnerId: 'p', allocationId: '2', amountRupees: 1000, paidDate: '2026-08-31', notes: 'Partial payment · Remaining: ₹500' },
];
const input = { allocationIds: ['1', '2'], effectiveDate: '2026-09-01', profitPercent: 3, returnDate: '2026-10-01' };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('capital combination', () => {
  it('sets first profit on the effective date, including month-end dates', () => {
    for (const date of ['2026-10-01', '2026-09-15', '2026-01-31', '2028-02-29', '2026-12-31']) {
      expect(firstCombinedProfitDate(date)).toBe(date);
    }
  });
  it('combines only remaining capital, preserving original records and separate profit debts', () => {
    const before = JSON.stringify(originals);
    const result = buildCombination(input, originals, [{ allocationId: '1', amountRupees: 10000, returnedDate: '2026-08-30' }], profits);
    expect(result.amountRupees).toBe(140000);
    expect(result.combination.sources.map(s => s.pending)).toEqual([0, 500]);
    expect(JSON.stringify(originals)).toBe(before);
    expect(decode(PREFIX + JSON.stringify({ combination: result.combination, notes: 'kept' }))?.combination).toEqual(result.combination);
  });

  it('rejects duplicate, cross-partner, cross-card, and already combined selections', () => {
    expect(() => buildCombination({ ...input, allocationIds: ['1', '1'] }, originals, [], profits)).toThrow();
    expect(() => buildCombination(input, [originals[0]!, { ...originals[1]!, partnerId: 'other' }], [], profits)).toThrow(/same partner/);
    expect(() => buildCombination(input, [originals[0]!, { ...originals[1]!, creditCardId: 'card' }], [], profits)).toThrow(/same credit card/);
    const parent = { ...buildCombination(input, originals, [], profits), id: '3' };
    expect(() => buildCombination(input, [...originals, parent], [], profits)).toThrow(/already combined/);
  });

  it('rejects invalid dates, rates, and dates before existing history', () => {
    expect(() => buildCombination({ ...input, effectiveDate: '2026-02-30' }, originals, [], profits)).toThrow();
    expect(() => buildCombination({ ...input, effectiveDate: '2026-08-15' }, originals, [], profits)).toThrow();
    expect(() => buildCombination({ ...input, profitPercent: NaN }, originals, [], profits)).toThrow();
    expect(() => buildCombination({ ...input, returnDate: '2026-08-31' }, originals, [], profits)).toThrow();
  });

  it('allows reverting unchanged capital and blocks modifications, transactions, missing sources and dependent combinations', () => {
    const parent = { ...buildCombination(input, originals, [], profits), id: '3' };
    const all = [...originals, parent];
    expect(revertReason(parent, all, [], profits)).toBeNull();
    expect(revertReason({ ...parent, combination: { ...parent.combination, revertBlocked: true } }, all, [], profits)).toMatch(/modified/);
    const payment = { ...profits[0]!, id: 'new', allocationId: '3' };
    expect(revertReason(parent, all, [], [...profits, payment])).toMatch(/New payments/);
    expect(revertReason(parent, all, [], [...profits, { ...payment, notes: 'DELETED:2026-09-02\n' }])).toMatch(/New payments/);
    expect(revertReason(parent, all, [], [...profits, { ...payment, allocationId: '2' }])).toMatch(/history have changed/);
    expect(revertReason(parent, [originals[0]!, parent], [], profits)).toMatch(/history have changed/);
    expect(revertReason(parent, [{ ...originals[0]!, notes: 'Changed' }, originals[1]!, parent], [], profits)).toMatch(/history have changed/);
    const later = { ...parent, id: '4', combination: { ...parent.combination, sources: [{ id: '3', capital: 150000, pending: 0, profitRecordIds: [] }] } };
    expect(revertReason(parent, [...all, later], [], profits)).toMatch(/another combination/);
    expect(revertReason({ ...parent, combination: { effectiveDate: input.effectiveDate, sources: parent.combination.sources } }, all, [], profits)).toMatch(/no saved baseline/);
  });

  async function setup(date: string, terms: CombineInput = input) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(date));
    const parent = { ...buildCombination(terms, originals, [], profits), id: '3' };
    const data: Record<string, unknown[]> = {
      partners: [{ id: 'p', name: 'Partner', phone: '', email: '', notes: '', createdAt: '' }],
      allocations: [...originals, parent], 'profit-records': [...profits], 'capital-returns': [], 'credit-cards': [],
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/revert-combination')) {
        data.allocations = data.allocations!.filter(a => (a as CapitalAllocation).id !== '3');
        return new Response(JSON.stringify({ status: 'success', data: { id: '3' } }));
      }
      const table = url.split('/').pop()!;
      if (options?.method === 'POST') {
        const row = { ...JSON.parse(String(options.body)), id: 'new-payment' };
        data[table]!.push(row);
        return new Response(JSON.stringify({ status: 'success', data: row }));
      }
      return new Response(JSON.stringify({ status: 'success', data: data[table] || [] }));
    }));
    const store = await import('../client/src/store.js');
    await vi.waitFor(() => expect(store.isLoaded()).toBe(true));
    return store;
  }

  it('counts capital once and carries old unpaid profits separately after combination and reload', async () => {
    const store = await setup('2026-09-15T12:00:00Z');
    expect(store.getPortfolioTotals()).toMatchObject({ totalCapital: 150000, capitalOutstanding: 150000, totalProfitPaid: 2200, totalProfitPending: 5000 });
    expect(store.getAllocationSummaries().find(a => a.id === '1')).toMatchObject({ combinedInto: '3', capitalOutstanding: 0 });
    expect(store.getLedger().filter(e => e.eventType === 'CAPITAL_RECEIVED')).toHaveLength(2);
    await store.addProfitRecord({ allocationId: '2', partnerId: 'p', amountRupees: 200, paidDate: '2026-09-15', notes: '' });
    expect(store.getAllocationSummaries().find(a => a.id === '2')?.profitPending).toBe(300);
    await store.loadAll();
    expect(store.getPortfolioTotals()).toMatchObject({ totalCapital: 150000, capitalOutstanding: 150000, totalProfitPending: 4800 });
    await expect(store.updateAllocation('1', { amountRupees: 1 })).rejects.toThrow(/preserved/);
    await expect(store.addCapitalReturn({ allocationId: '1', partnerId: 'p', amountRupees: 1, returnedDate: '2026-09-15', notes: '' })).rejects.toThrow(/combined entry/);
    await expect(store.addProfitRecord({ allocationId: '2', partnerId: 'p', amountRupees: 301, paidDate: '2026-09-15', notes: '' })).rejects.toThrow(/remaining original profit/);
  });

  it('activates on the chosen effective date, with no overlapping outstanding capital', async () => {
    const store = await setup('2026-08-31T12:00:00Z');
    expect(store.getAllocationSummaries().find(a => a.id === '3')?.capitalOutstanding).toBe(0);
    expect(store.getPortfolioTotals().capitalOutstanding).toBe(150000);
    vi.setSystemTime(new Date('2026-09-01T12:00:00Z'));
    expect(store.getAllocationSummaries().find(a => a.id === '3')?.capitalOutstanding).toBe(150000);
    expect(store.getPortfolioTotals().capitalOutstanding).toBe(150000);
  });

  it('shows October 1 combined capital in October and adds November only when Recur is chosen', async () => {
    const store = await setup('2026-09-30T12:00:00Z', { ...input, effectiveDate: '2026-10-01', returnDate: null });
    const combined = () => store.getAllocationSummaries().find(a => a.id === '3');
    expect(combined()).toMatchObject({ profitPending: 0, nextMonthProfit: 0, firstProfitDueDate: '2026-10-01' });
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    expect(combined()).toMatchObject({ profitPending: 4500, nextMonthProfit: 0 });
    expect(store.getAllocationSummaries().find(a => a.id === '2')?.profitPending).toBe(500);
    await store.loadAll();
    expect(combined()).toMatchObject({ profitPending: 4500, nextMonthProfit: 0 });
    await store.addProfitRecord({ allocationId: '3', partnerId: 'p', amountRupees: 4500, paidDate: '2026-10-01', notes: '' });
    expect(combined()).toMatchObject({ profitPending: 0, nextMonthProfit: 0, isRecurring: false });
  });

  it('carries combined capital to the next month after a completed recurring payment and reload', async () => {
    const store = await setup('2026-10-01T12:00:00Z', { ...input, effectiveDate: '2026-10-01', returnDate: null });
    await store.addProfitRecord({ allocationId: '3', partnerId: 'p', amountRupees: 4500, paidDate: '2026-10-01', notes: 'Capital reinvested' });
    expect(store.getAllocationSummaries().find(a => a.id === '3')).toMatchObject({ profitPending: 0, nextMonthProfit: 4500, isRecurring: true });
    await store.loadAll();
    expect(store.getAllocationSummaries().find(a => a.id === '3')).toMatchObject({ profitPending: 0, nextMonthProfit: 4500 });
  });

  it('reverts without changing source balances or history, and stays reverted after reload', async () => {
    const store = await setup('2026-09-15T12:00:00Z');
    expect(store.combinationRevertReason('3')).toBeNull();
    await store.revertCombination('3');
    expect(store.getAllocations()).toEqual(originals);
    expect(store.getProfitRecords()).toEqual(profits);
    expect(store.getPortfolioTotals()).toMatchObject({ totalCapital: 150000, capitalOutstanding: 150000, totalProfitPaid: 2200, totalProfitPending: 500 });
    expect(store.getAllocationSummaries().every(a => !a.combinationReserved && !a.combinedInto)).toBe(true);
    await store.loadAll();
    expect(store.getAllocations()).toEqual(originals);
  });
});
