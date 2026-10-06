// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => vi.unstubAllGlobals());
it('reinserts a restored contribution and linked payments into the cache and ledger', async () => {
  vi.resetModules();
  let deleted = true;
  const data = { partners: [{ id: 'p', name: 'Partner', notes: '' }], allocations: [{ id: 'a', partnerId: 'p', amountRupees: 1000, profitPercent: 3, receivedDate: '2026-01-01', returnDate: null, creditCardId: null, notes: '' }], 'capital-returns': [{ id: 'r', partnerId: 'p', allocationId: 'a', amountRupees: 100, returnedDate: '2026-02-01', notes: '' }], 'profit-records': [], 'credit-cards': [] };
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    const path = url.replace('/server/capitalos-api/', '');
    if (options?.method === 'POST') { deleted = false; return new Response(JSON.stringify({ status: 'success', data: data.allocations[0] })); }
    return new Response(JSON.stringify({ status: 'success', data: deleted && ['allocations', 'capital-returns'].includes(path) ? [] : data[path] || [] }));
  }));
  const store = await import('../client/src/store'); await store.loadAll();
  expect(store.getAllocations()).toEqual([]);
  await store.restoreAllocation('a');
  expect(store.getAllocations()).toHaveLength(1); expect(store.getLedger()).toHaveLength(2);
  expect(store.getAllocationSummaries()[0].capitalOutstanding).toBe(900);
});
