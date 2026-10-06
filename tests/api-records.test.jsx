import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
const { allRows } = createRequire(import.meta.url)('../functions/capitalos-api/persistence.js');

describe('actual Catalyst handler: complete records and recovery', () => {
  it('retrieves all 451 rows before filtering, including deleted records on later pages', async () => {
    const seed = baseData();
    seed.COS_Partners = Array.from({ length: 451 }, (_, i) => ({ ROWID: String(i), name: `Synthetic ${i}`, notes: i === 400 ? 'DELETED:2026-09-01T00:00:00Z\nArchived' : '' }));
    const h = createApiHarness(seed);
    const active = await h.request('GET', 'partners');
    expect(active.data).toHaveLength(450); expect(active.data.at(-1).id).toBe('450');
    const deleted = await h.request('GET', 'partners?deleted=true');
    expect(deleted.data).toHaveLength(1); expect(deleted.data[0]).toMatchObject({ id: '400', notes: 'Archived', deleted: true });
    expect(h.calls.some(c => c.options?.nextToken === '400')).toBe(true);
  });
  it('rejects incomplete/repeated cursors instead of accepting a partial dataset', async () => {
    await expect(allRows({ getPagedRows: async () => ({ data: [], more_records: true }) })).rejects.toThrow('continuation');
    await expect(allRows({ getPagedRows: async () => ({ data: [], next_token: 'same' }) })).rejects.toThrow('repeated');
  });
  it('hides and restores linked payments/returns with one contribution change', async () => {
    const h = createApiHarness(baseData());
    expect((await h.request('DELETE', 'allocations/a')).status).toBe('success');
    expect((await h.request('GET', 'profit-records')).data).toEqual([]);
    expect((await h.request('GET', 'capital-returns')).data).toEqual([]);
    const recovery = await h.request('GET', 'capital-returns?deleted=true');
    expect(recovery.data[0].restoreBlocked).toContain('contribution');
    expect((await h.request('POST', 'capital-returns/r/restore')).status).toBe('error');
    await h.request('POST', 'allocations/a/restore');
    expect((await h.request('GET', 'capital-returns')).data).toHaveLength(1);
    expect((await h.request('GET', 'profit-records')).data).toHaveLength(1);
    const changes = (await h.request('GET', 'activity')).data.filter(e => e.status === 'committed');
    expect(changes.map(e => e.action).sort()).toEqual(['delete', 'restore']);
    expect(changes.find(e => e.action === 'delete').before.notes).toBe('');
  });
  it('partner recovery includes cards but preserves independently deleted children', async () => {
    const h = createApiHarness(baseData());
    await h.request('DELETE', 'profit-records/f');
    await h.request('DELETE', 'partners/p');
    for (const resource of ['partners', 'allocations', 'capital-returns', 'profit-records', 'credit-cards']) expect((await h.request('GET', resource)).data).toEqual([]);
    await h.request('POST', 'partners/p/restore');
    expect((await h.request('GET', 'credit-cards')).data).toHaveLength(1);
    expect((await h.request('GET', 'allocations')).data).toHaveLength(1);
    expect((await h.request('GET', 'profit-records')).data).toEqual([]);
    await h.request('POST', 'profit-records/f/restore');
    expect((await h.request('GET', 'profit-records')).data).toHaveLength(1);
  });
  it('blocks editing a hidden child and restoring a return beyond principal', async () => {
    const h = createApiHarness(baseData());
    await h.request('DELETE', 'partners/p');
    expect((await h.request('PATCH', 'allocations/a', { amountRupees: 1 })).status).toBe('error');
    await h.request('POST', 'partners/p/restore');
    await h.request('DELETE', 'capital-returns/r');
    h.db.COS_Returns.push({ ROWID: 'r2', partner_id: 'p', allocation_id: 'a', amount_rupees: 9500, notes: '' });
    expect((await h.request('POST', 'capital-returns/r/restore')).message).toContain('exceed');
  });
  it('does not combine contributions hidden by a deleted partner', async () => {
    const seed = baseData();
    seed.COS_Allocations.push({ ...seed.COS_Allocations[0], ROWID: 'b' });
    const h = createApiHarness(seed);
    await h.request('DELETE', 'partners/p');
    const response = await h.request('POST', 'allocations/combine', { allocationIds: ['a', 'b'], effectiveDate: '2026-09-18', profitPercent: 3, returnDate: '2026-12-01' });
    expect(response.status).toBe('error');
    expect(response.message).toContain('no longer exists');
    expect(h.db.COS_Allocations).toHaveLength(2);
  });
  it('preserves the actual previous values after edits and deletion', async () => {
    const h = createApiHarness(baseData());
    await h.request('PATCH', 'partners/p', { name: 'New Name' });
    await h.request('DELETE', 'partners/p');
    const change = (await h.request('GET', 'activity')).data.find(e => e.action === 'update' && e.status === 'committed');
    expect(change.before.name).toBe('Synthetic Partner'); expect(change.after.name).toBe('New Name');
    expect((await h.request('DELETE', `activity/${change.id}`)).status).toBe('error');
  });
  it('does not mutate data when the audit intent cannot be saved', async () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const h = createApiHarness(baseData(), (name, action) => name === 'COS_Activity' && action === 'insert');
      expect((await h.request('PATCH', 'partners/p', { name: 'Never saved' })).status).toBe('error');
      expect(h.db.COS_Partners[0].name).toBe('Synthetic Partner');
    } finally { silence.mockRestore(); }
  });
  it('keeps an inspectable intent if completion logging fails after a save', async () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const h = createApiHarness(baseData(), (name, action, data) => name === 'COS_Activity' && action === 'insert' && data.status === 'committed');
      expect((await h.request('PATCH', 'partners/p', { name: 'Saved' })).message).toContain('Record saved');
      expect(h.db.COS_Partners[0].name).toBe('Saved'); expect(h.db.COS_Activity[0].status).toBe('pending');
    } finally { silence.mockRestore(); }
  });
});
