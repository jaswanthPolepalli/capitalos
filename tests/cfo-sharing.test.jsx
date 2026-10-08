import { describe, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
import { splitProfit } from '../functions/capitalos-api/profit-sharing.mjs';

describe('CFO profit allocations', () => {
  it('splits new entries, reloads them, and leaves historical payments unchanged', async () => {
    const h = createApiHarness(baseData());
    const before = structuredClone(h.db.COS_Profits[0]);
    const saved = await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 7000, paidDate: '2026-10-08', notes: 'October' });
    expect(saved.data).toMatchObject({ amountRupees: 5000, cfoShareRupees: 2000, combinedAmountRupees: 7000, notes: 'October' });
    const records = (await h.request('GET', 'profit-records')).data;
    expect(records.find(r => r.id === saved.data.id)).toEqual(saved.data);
    expect(records.find(r => r.id === 'f')).not.toHaveProperty('cfoShareRupees');
    expect(h.db.COS_Profits[0]).toEqual(before);
  });
  it('recalculates corrections, preserves notes-only edits and deletion/restoration, and keeps legacy edits unsplit', async () => {
    const h = createApiHarness(baseData());
    const saved = await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 7000, paidDate: '2026-10-08', notes: '' });
    const path = `profit-records/${saved.data.id}`;
    expect((await h.request('PATCH', path, { amountRupees: 14000 })).data).toMatchObject({ amountRupees: 10000, cfoShareRupees: 4000, combinedAmountRupees: 14000 });
    expect((await h.request('PATCH', path, { notes: 'Corrected' })).data).toMatchObject({ cfoShareRupees: 4000, notes: 'Corrected' });
    await h.request('DELETE', path);
    expect((await h.request('GET', 'profit-records')).data).toHaveLength(1);
    expect((await h.request('POST', `${path}/restore`)).data).toMatchObject({ amountRupees: 10000, cfoShareRupees: 4000, notes: 'Corrected' });
    const legacy = (await h.request('PATCH', 'profit-records/f', { amountRupees: 400, notes: 'Legacy correction' })).data;
    expect(legacy.amountRupees).toBe(400);
    expect(legacy).not.toHaveProperty('cfoShareRupees');
  });
  it('sends only the partner amount in the confirmation', async () => {
    const seed = baseData(); seed.COS_Partners[0].email = 'partner@example.test';
    const sendMail = vi.fn().mockResolvedValue({});
    const h = createApiHarness(seed, undefined, sendMail);
    await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 7000, paidDate: '2026-10-08', notes: '' });
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledOnce());
    const html = sendMail.mock.calls[0][0].html;
    expect(html).toContain('₹5,000');
    for (const hidden of ['₹7,000', '₹2,000', 'CFO', 'PROFIT_SPLIT']) expect(html).not.toContain(hidden);
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid combined amount %s before writing', async amountRupees => {
    const h = createApiHarness(baseData());
    expect((await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees, paidDate: '2026-10-08' })).status).toBe('error');
    expect(h.db.COS_Profits).toHaveLength(1);
  });
  it('rounds once and preserves the entered total', () => {
    expect(splitProfit(100)).toEqual({ amountRupees: 71, cfoShareRupees: 29, combinedAmountRupees: 100 });
    for (let n = 1; n < 1000; n++) { const r = splitProfit(n); expect(r.amountRupees + r.cfoShareRupees).toBe(n); }
  });
});

describe('adjusted partner profit rate', () => {
  const payment = { partnerId: 'p', allocationId: 'a', amountRupees: 700, partnerProfitPercent: 4, paidDate: '2026-10-08', notes: 'Adjusted payment' };
  it('calculates from server-owned invested capital and preserves the confirmed adjustment through reload, edits and restore', async () => {
    const h = createApiHarness(baseData());
    const saved = (await h.request('POST', 'profit-records', { ...payment, profitCapitalRupees: 999999 })).data;
    expect(saved).toMatchObject({ amountRupees: 400, cfoShareRupees: 300, combinedAmountRupees: 700, partnerProfitPercent: 4, profitCapitalRupees: 10000, notes: payment.notes });
    const path = `profit-records/${saved.id}`;
    expect((await h.request('GET', 'profit-records')).data.find(r => r.id === saved.id)).toEqual(saved);
    expect((await h.request('PATCH', path, { notes: 'Corrected reference' })).data).toMatchObject({ amountRupees: 400, partnerProfitPercent: 4 });
    // Keep the confirmed basis even if contribution details later change.
    h.db.COS_Allocations[0].amount_rupees = 20000;
    expect((await h.request('PATCH', path, { amountRupees: 800 })).data).toMatchObject({ amountRupees: 400, cfoShareRupees: 400, profitCapitalRupees: 10000 });
    await h.request('DELETE', path);
    expect((await h.request('POST', `${path}/restore`)).data).toMatchObject({ amountRupees: 400, cfoShareRupees: 400, partnerProfitPercent: 4 });
    const reset = (await h.request('PATCH', path, { amountRupees: 700, partnerProfitPercent: null })).data;
    expect(reset).toMatchObject({ amountRupees: 500, cfoShareRupees: 200 });
    expect(reset).not.toHaveProperty('partnerProfitPercent');
  });
  it.each([0, -1, 101, 8, '4'])('rejects invalid or excessive partner rate %s without writing', async partnerProfitPercent => {
    const h = createApiHarness(baseData());
    expect((await h.request('POST', 'profit-records', { ...payment, partnerProfitPercent })).status).toBe('error');
    expect(h.db.COS_Profits).toHaveLength(1);
  });
  it('supports adjusted grouped payments and preserves their pending partner balance on replay', async () => {
    const seed = baseData(); seed.COS_Profits = [];
    const h = createApiHarness(seed);
    const input = { groupId: '12345678-1234-1234-1234-123456789abc', kind: 'profit', partnerId: 'p', date: '2026-10-08', reference: '', notes: '', entries: [{ allocationId: 'a', amountRupees: 420, partnerProfitPercent: 2, expectedBalance: 300, recur: false }] };
    const saved = (await h.request('POST', 'payment-groups', input)).data;
    expect(saved.results[0].record).toMatchObject({ amountRupees: 200, cfoShareRupees: 220, partnerProfitPercent: 2, notes: 'Partial payment · Remaining: ₹100' });
    expect((await h.request('POST', 'payment-groups', input)).data).toEqual(saved);
    const path = `profit-records/${saved.results[0].record.id}`;
    expect((await h.request('PATCH', path, { notes: 'Updated' })).data).toMatchObject({ partnerProfitPercent: 2, paymentGroupId: input.groupId });
    expect((await h.request('GET', 'profit-records')).data[0]).toMatchObject({ amountRupees: 200, cfoShareRupees: 220 });
  });
});

describe('no CFO split', () => {
  it('gives the entire amount to the partner and preserves the choice through reload, correction and restore', async () => {
    const h = createApiHarness(baseData());
    const saved = (await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 7000, noCfoSplit: true, paidDate: '2026-10-08', notes: '' })).data;
    expect(saved).toMatchObject({ amountRupees: 7000, combinedAmountRupees: 7000, cfoShareRupees: 0, noCfoSplit: true });
    const path = `profit-records/${saved.id}`;
    expect((await h.request('GET', 'profit-records')).data.find(r => r.id === saved.id)).toEqual(saved);
    expect((await h.request('PATCH', path, { amountRupees: 8000, notes: 'Corrected' })).data).toMatchObject({ amountRupees: 8000, cfoShareRupees: 0, noCfoSplit: true });
    await h.request('DELETE', path);
    expect((await h.request('POST', `${path}/restore`)).data).toMatchObject({ amountRupees: 8000, cfoShareRupees: 0, noCfoSplit: true });
    const reset = (await h.request('PATCH', path, { amountRupees: 7000, noCfoSplit: false })).data;
    expect(reset).toMatchObject({ amountRupees: 5000, cfoShareRupees: 2000 });
    expect(reset.noCfoSplit).toBeUndefined();
  });
  it('supports grouped payments without a CFO share and replays them without duplicates', async () => {
    const seed = baseData(); seed.COS_Profits = [];
    const h = createApiHarness(seed);
    const input = { groupId: '12345678-1234-1234-1234-123456789abc', kind: 'profit', partnerId: 'p', date: '2026-10-08', reference: '', notes: '', entries: [{ allocationId: 'a', amountRupees: 300, noCfoSplit: true, expectedBalance: 300, recur: false }] };
    const saved = (await h.request('POST', 'payment-groups', input)).data;
    expect(saved.results[0].record).toMatchObject({ amountRupees: 300, cfoShareRupees: 0, noCfoSplit: true });
    expect((await h.request('POST', 'payment-groups', input)).data).toEqual(saved);
    expect(h.db.COS_Profits).toHaveLength(1);
    expect(splitProfit(999, null, undefined, true)).toMatchObject({ amountRupees: 999, cfoShareRupees: 0 });
  });
});

describe('direct partner amount', () => {
  it('persists exact amounts through reload, edit and restore, and can return to percentage mode', async () => {
    const h = createApiHarness(baseData());
    const saved = (await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 7000, partnerAmountRupees: 4321, paidDate: '2026-10-08', notes: '' })).data;
    expect(saved).toMatchObject({ amountRupees: 4321, partnerAmountRupees: 4321, cfoShareRupees: 2679, profitCapitalRupees: 10000 });
    const path = `profit-records/${saved.id}`;
    expect((await h.request('GET', 'profit-records')).data.find(r => r.id === saved.id)).toEqual(saved);
    expect((await h.request('PATCH', path, { amountRupees: 8000, notes: 'Updated' })).data).toMatchObject({ amountRupees: 4321, cfoShareRupees: 3679 });
    await h.request('DELETE', path);
    expect((await h.request('POST', `${path}/restore`)).data).toMatchObject({ partnerAmountRupees: 4321 });
    const percentage = (await h.request('PATCH', path, { partnerAmountRupees: null, partnerProfitPercent: 40 })).data;
    expect(percentage).toMatchObject({ amountRupees: 4000, cfoShareRupees: 4000 });
    expect(percentage.partnerAmountRupees).toBeUndefined();
  });
  it.each([0, -1, 7001, 1.5])('rejects invalid partner amount %s', partnerAmount => {
    expect(() => splitProfit(7000, null, 10000, false, partnerAmount)).toThrow(/partner amount/);
  });
  it('persists and replays direct amounts in grouped payments', async () => {
    const seed = baseData(); seed.COS_Profits = [];
    const h = createApiHarness(seed);
    const input = { groupId: '12345678-1234-1234-1234-123456789abc', kind: 'profit', partnerId: 'p', date: '2026-10-08', reference: '', notes: '', entries: [{ allocationId: 'a', amountRupees: 420, partnerAmountRupees: 250, expectedBalance: 300, recur: false }] };
    const result = (await h.request('POST', 'payment-groups', input)).data;
    expect(result.results[0].record).toMatchObject({ amountRupees: 250, cfoShareRupees: 170, notes: 'Partial payment · Remaining: ₹50' });
    expect((await h.request('POST', 'payment-groups', input)).data).toEqual(result);
  });
});
