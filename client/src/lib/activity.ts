import { decode } from '../../../functions/capitalos-api/combinations.mjs';
import { originalNotes } from '../../../functions/capitalos-api/records.mjs';
import type { ActivityEvent } from './operationsApi.js';

const aliases: Record<string, string> = {
  cashback_data: 'cashback', ROWID: 'id', partner_id: 'partnerId', allocation_id: 'allocationId', amount_rupees: 'amountRupees',
  profit_percent: 'profitPercent', received_date: 'receivedDate', return_date: 'returnDate',
  returned_date: 'returnedDate', paid_date: 'paidDate', credit_card_id: 'creditCardId',
  card_name: 'cardName', bank_name: 'bankName', billing_day: 'billingDay', due_day: 'dueDay',
};
export const fieldLabels: Record<string, string> = {
  cashbackStatus: 'Cashback status', cashbackAmount: 'Cashback paid', cashbackDate: 'Cashback payment date', cashbackNotes: 'Cashback notes',
  amountRupees: 'Amount', profitPercent: 'Profit rate', receivedDate: 'Received / effective date',
  returnDate: 'Planned return date', returnedDate: 'Capital returned date', paidDate: 'Profit paid date',
  partnerId: 'Partner', allocationId: 'Capital entry', creditCardId: 'Funding source', notes: 'Notes',
  name: 'Name', phone: 'Phone', email: 'Email', cardName: 'Card name', bankName: 'Bank name',
};
export function activityState(state: Record<string, unknown> | null): Record<string, unknown> {
  if (!state) return {};
  const result = Object.fromEntries(Object.entries(state).map(([key, value]) => [aliases[key] || key, value]));
  const notes = originalNotes(String(result.notes || ''));
  try {
    const metadata = decode(notes);
    if (metadata) { result.combination = metadata.combination; result.notes = metadata.notes; }
    else if ('notes' in result) result.notes = notes;
  } catch { /* Preserve malformed historical notes for inspection. */ }
  if ('cashback' in result) {
    let cashback = result.cashback;
    if (typeof cashback === 'string') { try { cashback = JSON.parse(cashback); } catch { cashback = null; } }
    if (cashback && typeof cashback === 'object') {
      const cb = cashback as Record<string, unknown>;
      result.cashbackStatus = cb.status;
      result.cashbackAmount = cb.status === 'paid' ? cb.amountRupees ?? 'Amount not recorded' : null;
      result.cashbackDate = cb.paidDate;
      result.cashbackNotes = cb.notes;
    }
    delete result.cashback;
  }
  return result;
}
export function activityDetails(event: ActivityEvent) {
  const before = activityState(event.before);
  const after = activityState(event.after);
  const combination = (after.combination || before.combination) as import('../../../functions/capitalos-api/combinations.mjs').Combination | undefined;
  const kind = combination && event.action === 'create' ? 'combine'
    : combination && event.action === 'delete' ? 'revert-combination' : event.action;
  const labels: Record<string, string> = { create: 'Created', update: 'Edited', delete: 'Deleted', restore: 'Restored', combine: 'Capital combined', 'revert-combination': 'Combination reverted' };
  const entities: Record<string, string> = { COS_Allocations: 'Capital entry', allocations: 'Capital entry', COS_Profits: 'Profit payment', 'profit-records': 'Profit payment', COS_Returns: 'Capital return', 'capital-returns': 'Capital return', COS_Partners: 'Partner', partners: 'Partner', COS_CreditCards: 'Credit card', 'credit-cards': 'Credit card' };
  const hidden = new Set(['id', 'createdAt', 'CREATEDTIME', 'MODIFIEDTIME', 'CREATORID', 'combination', 'updatedAt', 'source_created_time']);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => !hidden.has(key) && (event.action === 'delete' || event.action === 'restore' || JSON.stringify(before[key]) !== JSON.stringify(after[key])));
  let originals: Record<string, unknown>[] = [];
  try { originals = JSON.parse(combination?.revertSnapshot || '{}').allocations || []; } catch { /* Older combinations may have no baseline. */ }
  return { before, after, combination, originals, kind, label: labels[kind] || kind, entity: keys.length > 0 && keys.every(k => k.startsWith('cashback')) ? 'Cashback' : entities[event.entityType] || event.entityType, keys };
}
