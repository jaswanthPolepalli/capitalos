import { describe, expect, it } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';

function setup(fail) {
  const data = baseData();
  data.COS_Profits = [];
  data.COS_Allocations.push(...['b', 'c', 'd', 'e'].map(ROWID => ({ ...data.COS_Allocations[0], ROWID })));
  return createApiHarness(data, fail);
}
function input(kind = 'profit') {
  return { groupId: '12345678-1234-1234-1234-123456789abc', kind, partnerId: 'p', date: '2026-09-20', reference: 'UTR-123', notes: 'September settlement',
    entries: ['a', 'b', 'c', 'd', 'e'].map(allocationId => ({ allocationId, amountRupees: kind === 'profit' ? 420 : 1000, expectedBalance: kind === 'profit' ? 300 : allocationId === 'a' ? 9000 : 10000, recur: false })) };
}

describe('grouped payment API', () => {
  it('records five linked profit rows and replays without duplicate writes', async () => {
    const h = setup(); const body = input();
    const result = await h.request('POST', 'payment-groups', body);
    expect(result.data.complete).toBe(true);
    expect(result.data.results).toHaveLength(5);
    expect(result.data.results.every(r => r.record.paymentGroupId === body.groupId)).toBe(true);
    expect(h.db.COS_Profits).toHaveLength(5);
    expect((await h.request('POST', 'payment-groups', body)).data).toEqual(result.data);
    expect(h.db.COS_Profits).toHaveLength(5);
    expect((await h.request('GET', 'profit-records')).data[0]).toMatchObject({ notes: 'September settlement · Ref: UTR-123', paymentGroupId: body.groupId });
  });
  it('stores automatic remaining profit and recurring settings per entry', async () => {
    const h = setup(); const body = input();
    body.entries[0].amountRupees = 140; body.entries[1].recur = true;
    const response = await h.request('POST', 'payment-groups', body);
    expect(response.data.results[0].record.notes).toContain('Partial payment · Remaining: ₹200');
    expect(response.data.results[1].record.notes).toContain('Capital reinvested');
    const next = input(); next.groupId = '22345678-1234-1234-1234-123456789abc'; next.entries = [{ ...body.entries[0], amountRupees: 280, expectedBalance: 200 }];
    expect((await h.request('POST', 'payment-groups', next)).data.complete).toBe(true);
  });
  it('records capital returns without settling pending profit', async () => {
    const h = setup();
    const response = await h.request('POST', 'payment-groups', input('capital'));
    expect(response.data.complete).toBe(true); expect(h.db.COS_Returns).toHaveLength(6);
    expect(h.db.COS_Profits).toHaveLength(0);
    expect((await h.request('POST', 'payment-groups', { ...input(), groupId: '22345678-1234-1234-1234-123456789abc' })).data.complete).toBe(true);
  });
  it.each(['mixed partner', 'excess return', 'fractional', 'duplicate', 'stale', 'invalid date', 'future date', 'system tags'])('rejects %s before saving any selected row', async reason => {
    const h = setup(); const body = input('capital');
    if (reason === 'mixed partner') h.db.COS_Allocations[1].partner_id = 'other';
    if (reason === 'excess return') body.entries[4].amountRupees = 10001;
    if (reason === 'fractional') body.entries[4].amountRupees = 0.1;
    if (reason === 'duplicate') body.entries[4].allocationId = 'a';
    if (reason === 'stale') body.entries[4].expectedBalance = 10001;
    if (reason === 'invalid date') body.date = '2026-02-30';
    if (reason === 'future date') body.date = '2099-01-01';
    if (reason === 'system tags') body.notes = 'Partial payment · Remaining: ₹999';
    expect((await h.request('POST', 'payment-groups', body)).status).toBe('error');
    expect(h.db.COS_Returns).toHaveLength(1);
    expect(h.db.COS_Activity).toHaveLength(0);
  });
  it('handles concurrent submissions of the same group at most once', async () => {
    const h = setup(); const body = input();
    await Promise.all([h.request('POST', 'payment-groups', body), h.request('POST', 'payment-groups', body)]);
    expect(h.db.COS_Profits).toHaveLength(5);
    expect((await h.request('POST', 'payment-groups', body)).data.complete).toBe(true);
  });
  it('stops on a failed row and never retries uncertain writes', async () => {
    const h = setup((table, action, row) => table === 'COS_Profits' && action === 'insert' && row.allocation_id === 'b');
    const body = input();
    const response = await h.request('POST', 'payment-groups', body);
    expect(response.data.complete).toBe(false);
    expect(response.data.results.map(r => r.status)).toEqual(['saved', 'unconfirmed', 'not_attempted', 'not_attempted', 'not_attempted']);
    await h.request('POST', 'payment-groups', body);
    expect(h.db.COS_Profits).toHaveLength(1);
    expect(h.calls.filter(c => c.table === 'COS_Profits' && c.operation === 'insert' && c.data.allocation_id === 'b')).toHaveLength(1);
  });
  it('does not repeat a write whose audit completion failed after persistence', async () => {
    const h = setup((table, action, row) => table === 'COS_Activity' && action === 'insert' && row.entity_type === 'COS_Profits' && row.status === 'committed');
    const body = input();
    const response = await h.request('POST', 'payment-groups', body);
    expect(response.data.results[0].status).toBe('unconfirmed');
    await h.request('POST', 'payment-groups', body);
    expect(h.db.COS_Profits).toHaveLength(1);
  });
  it('keeps payment group linkage after editing or restoring individual records', async () => {
    const h = setup(); const body = input();
    const result = await h.request('POST', 'payment-groups', body); const id = result.data.results[0].record.id;
    expect((await h.request('PATCH', `profit-records/${id}`, { notes: 'Corrected reference' })).data.paymentGroupId).toBe(body.groupId);
    await h.request('DELETE', `profit-records/${id}`);
    expect((await h.request('POST', `profit-records/${id}/restore`)).data.paymentGroupId).toBe(body.groupId);
    expect((await h.request('GET', 'profit-records')).data.find(r => r.id === id).notes).toBe('Corrected reference');
  });
  it('does not re-share a deleted or corrected amount as the original payment', async () => {
    const h = setup(); const body = input();
    const result = await h.request('POST', 'payment-groups', body); const id = result.data.results[0].record.id;
    await h.request('PATCH', `profit-records/${id}`, { amountRupees: 150 });
    expect((await h.request('POST', 'payment-groups', body)).data.results[0].status).toBe('unconfirmed');
  });
  it('refuses changed input for an already reserved group', async () => {
    const h = setup(); const body = input();
    await h.request('POST', 'payment-groups', body);
    body.entries[0].amountRupees = 200;
    expect((await h.request('POST', 'payment-groups', body)).status).toBe('error');
    expect(h.db.COS_Profits).toHaveLength(5);
  });
});

it('preserves combined-source history while allowing its remaining profit to be settled', async () => {
  const h = setup();
  const combination = await h.request('POST', 'allocations/combine', { allocationIds: ['a', 'b'], effectiveDate: '2026-09-20', profitPercent: 3, returnDate: '2026-12-01' });
  expect(combination.status).toBe('success');
  const profit = input(); profit.entries = profit.entries.slice(0, 2);
  expect((await h.request('POST', 'payment-groups', profit)).data.complete).toBe(true);
  const capital = input('capital'); capital.groupId = '22345678-1234-1234-1234-123456789abc'; capital.entries = capital.entries.slice(0, 2);
  expect((await h.request('POST', 'payment-groups', capital)).status).toBe('error');
  expect(h.db.COS_Returns).toHaveLength(1);
});

it('does not write financial records when the group reservation cannot be saved', async () => {
  const h = setup((table, action, row) => table === 'COS_Activity' && action === 'insert' && row.entity_type === 'payment-group');
  const response = await h.request('POST', 'payment-groups', input());
  expect(response.status).toBe('error'); expect(h.db.COS_Profits).toHaveLength(0);
});

it('accepts combined-capital profit on its October 1 effective date with Recur', async () => {
  const h = setup();
  const combination = await h.request('POST', 'allocations/combine', { allocationIds: ['a', 'b'], effectiveDate: '2026-10-01', profitPercent: 3, returnDate: null });
  expect(combination.status).toBe('success');
  const profit = { ...input(), date: '2026-10-01', notes: 'October settlement', entries: [{ allocationId: combination.data.id, amountRupees: 798, expectedBalance: 570, recur: true }] };
  const result = await h.request('POST', 'payment-groups', profit);
  expect(result.data.complete).toBe(true);
  expect(result.data.results[0].record).toMatchObject({ allocationId: combination.data.id, paidDate: '2026-10-01', amountRupees: 570 });
  expect(result.data.results[0].record.notes).toContain('Capital reinvested');
});
