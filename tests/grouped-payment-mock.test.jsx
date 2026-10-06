// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('handles grouped payments entirely inside mock fetch, with email disabled even for a partner with an address', async () => {
  const realFetch = vi.fn(() => { throw new Error('Mock requests must never reach a live service'); });
  vi.stubGlobal('fetch', realFetch);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const { installMockFetch } = await import('../client/src/mocks/mockFetch');
  await installMockFetch();
  const post = async (path, body) => (await (await window.fetch(`/server/capitalos-api/${path}`, { method: 'POST', body: JSON.stringify(body) })).json()).data;
  const partner = await post('partners', { name: 'Synthetic Email Test', email: 'partner@example.test', phone: '', notes: '' });
  const allocation = await post('allocations', { partnerId: partner.id, amountRupees: 10000, profitPercent: 3, receivedDate: '2026-01-01', returnDate: null, creditCardId: null, notes: '' });
  const body = { groupId: 'mock-email-12345678-1234-123456789abc', kind: 'profit', partnerId: partner.id, date: '2026-09-25', reference: '', notes: '',
    entries: [{ allocationId: allocation.id, amountRupees: 300, expectedBalance: 300, recur: false }] };
  const first = await post('payment-groups', body);
  expect(first).toMatchObject({ complete: true, email: { status: 'mock' } });
  expect(await post('payment-groups', body)).toEqual(first);
  expect(realFetch).not.toHaveBeenCalled();
});
