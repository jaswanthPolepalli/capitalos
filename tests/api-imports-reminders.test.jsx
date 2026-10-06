import { describe, expect, it } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
const partner = { rowNumber: 2, values: { name: 'Imported Partner', phone: '9000000000', email: '', notes: '' } };
const contribution = { rowNumber: 2, values: { partner: 'p', amountRupees: '25000', profitPercent: '3', receivedDate: '2026-09-01', returnDate: '2026-12-01' } };

describe('actual API imports', () => {
  it('imports partners, skips duplicates and rejects malformed contributions on the server', async () => {
    const h = createApiHarness(baseData());
    const result = await h.request('POST', 'imports', { kind: 'partners', rows: [partner, { ...partner, rowNumber: 3 }] });
    expect(result.data.results.map(r => r.status)).toEqual(['imported', 'duplicate']);
    expect((await h.request('POST', 'imports', { kind: 'partners', rows: [partner] })).data.results[0].status).toBe('duplicate');
    expect((await h.request('POST', 'imports', { kind: 'allocations', rows: [{ rowNumber: 2, values: { ...contribution.values, amountRupees: '-1', receivedDate: '2026-02-31' } }] })).data.results[0].status).toBe('rejected');
    expect(h.db.COS_Allocations).toHaveLength(1);
  });
  it('imports a contribution with an auditable snapshot and does not email', async () => {
    const h = createApiHarness(baseData());
    const result = await h.request('POST', 'imports', { kind: 'allocations', rows: [contribution] });
    expect(result.data.results[0].status).toBe('imported');
    expect(h.db.COS_Allocations[1]).toMatchObject({ amount_rupees: 25000, profit_percent: '3' });
    expect(h.db.COS_Activity.find(e => e.status === 'committed').entity_type).toBe('COS_Allocations');
    expect(h.db.COS_Imports[0].status).toBe('completed');
  });
  it('uses a unique server claim to prevent concurrent copies of an import', async () => {
    const h = createApiHarness(baseData());
    await Promise.all([h.request('POST', 'imports', { kind: 'allocations', rows: [contribution] }), h.request('POST', 'imports', { kind: 'allocations', rows: [contribution] })]);
    expect(h.db.COS_Allocations.filter(a => a.amount_rupees === 25000)).toHaveLength(1);
    expect(h.db.COS_Imports).toHaveLength(1);
  });
  it('retains an uncertain import claim rather than silently retrying a financial write', async () => {
    const h = createApiHarness(baseData(), (name, action) => name === 'COS_Imports' && action === 'update');
    const first = await h.request('POST', 'imports', { kind: 'allocations', rows: [contribution] });
    expect(first.data.results[0].status).toBe('unconfirmed');
    await h.request('POST', 'imports', { kind: 'allocations', rows: [contribution] });
    expect(h.db.COS_Allocations.filter(a => a.amount_rupees === 25000)).toHaveLength(1);
  });
});
it('persists manual reminder history with dates and rejects invalid records', async () => {
  const h = createApiHarness(baseData());
  const body = { obligationId: 'principal:a:2026-12-01', partnerId: 'p', allocationId: 'a', kind: 'principal', action: 'snoozed', channel: 'phone', amountRupees: 9000, dueDate: '2026-12-01', followUpDate: '2026-11-25', notes: 'Call before due date' };
  expect((await h.request('POST', 'reminder-events', body)).status).toBe('success');
  expect((await h.request('GET', 'reminder-events')).data[0]).toMatchObject({ action: 'snoozed', followUpDate: '2026-11-25', notes: 'Call before due date' });
  expect((await h.request('POST', 'reminder-events', { ...body, dueDate: '2026-02-31' })).status).toBe('error');
  expect((await h.request('POST', 'reminder-events', { ...body, partnerId: 'other' })).status).toBe('error');
  const estimate = await h.request('POST', 'reminder-events', { ...body, kind: 'profit-estimate', amountRupees: 123.45 });
  expect(estimate.data.amountRupees).toBe(123.45);
  expect(h.db.COS_Reminders.at(-1).amount_paise).toBe(12345);
  await h.request('DELETE', 'partners/p');
  expect((await h.request('POST', 'reminder-events', body)).status).toBe('error');
});
