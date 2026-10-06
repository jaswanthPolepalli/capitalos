import { describe, expect, it } from 'vitest';
import { activityDetails } from '../client/src/lib/activity.js';
import type { ActivityEvent } from '../client/src/lib/operationsApi.js';
import { buildCombination, PREFIX } from '../functions/capitalos-api/combinations.mjs';

const event: ActivityEvent = { id: 'event', operationId: 'operation', entityId: '3', entityType: 'COS_Allocations', action: 'update', status: 'committed', actor: 'Unverified caller', occurredAt: '2026-10-01T09:00:00Z', before: null, after: null, reason: '' };
const sources = ['1', '2'].map(id => ({ id, partnerId: 'p', amountRupees: 10000, profitPercent: 3, receivedDate: '2026-09-01', returnDate: null, creditCardId: null, notes: 'Original capital' }));
const combined = buildCombination({ allocationIds: ['1', '2'], effectiveDate: '2026-10-01', profitPercent: 4, returnDate: null }, sources, [], []);
const encoded = PREFIX + JSON.stringify({ combination: combined.combination, notes: 'Combined notes' });

describe('readable audit history', () => {
  it('decodes hosted combination metadata and preserves each original entry and its unpaid profit', () => {
    const result = activityDetails({ ...event, action: 'create', after: { ROWID: '3', partner_id: 'p', amount_rupees: 20000, profit_percent: '4', notes: encoded } });
    expect(result).toMatchObject({ kind: 'combine', label: 'Capital combined', entity: 'Capital entry', after: { partnerId: 'p', notes: 'Combined notes' } });
    expect(result.combination?.sources.map(source => source.pending)).toEqual([300, 300]);
    expect(result.originals).toEqual(sources.map(source => ({ ...source, combination: null })));
    expect(result.keys).not.toContain('combination');
    expect(result.keys).not.toContain('id');
  });
  it('shows edited business values without exposing a modified combination baseline as notes', () => {
    const result = activityDetails({ ...event, before: { notes: encoded, profit_percent: '4' }, after: { notes: PREFIX + JSON.stringify({ combination: { ...combined.combination, revertBlocked: true }, notes: 'Updated notes' }), profit_percent: '5' } });
    expect(result.kind).toBe('update');
    expect(result.keys.sort()).toEqual(['notes', 'profitPercent']);
    expect(result.before.notes).toBe('Combined notes');
    expect(result.after.notes).toBe('Updated notes');
  });
  it('identifies reverted combinations from archived metadata and keeps original values inspectable', () => {
    const result = activityDetails({ ...event, action: 'delete', before: { notes: encoded, amount_rupees: 20000 }, after: { notes: `DELETED:2026-10-01T10:00:00Z\n${encoded}`, amount_rupees: 20000 } });
    expect(result.kind).toBe('revert-combination');
    expect(result.keys).toContain('amountRupees');
    expect(result.combination?.effectiveDate).toBe('2026-10-01');
  });
  it('classifies local combination history the same as hosted history', () => {
    const result = activityDetails({ ...event, entityType: 'allocations', action: 'create', after: { ...combined, id: '3' } });
    expect(result.kind).toBe('combine');
    expect(result.entity).toBe('Capital entry');
    expect(result.originals).toHaveLength(2);
  });
});

it('flattens hosted and local cashback changes into business fields without metadata noise', () => {
  const before = { status: 'unpaid', notes: '', updatedAt: '2026-10-01' };
  const after = { status: 'paid', amountRupees: null, paidDate: '2026-09-30', notes: '', updatedAt: '2026-10-06' };
  for (const hosted of [false, true]) {
    const result = activityDetails({ ...event, before: hosted ? { cashback_data: JSON.stringify(before) } : { cashback: before }, after: hosted ? { cashback_data: JSON.stringify(after) } : { cashback: after } });
    expect(result.entity).toBe('Cashback');
    expect(result.keys.sort()).toEqual(['cashbackAmount', 'cashbackDate', 'cashbackStatus']);
    expect(result.after.cashbackAmount).toBe('Amount not recorded');
  }
});
