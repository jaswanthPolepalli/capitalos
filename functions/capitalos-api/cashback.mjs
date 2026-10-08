import { splitProfit } from './profit-sharing.mjs';
/** Manual cashback selection per card/calendar month. Financial history is never rewritten.
 * A selection decision lives on one allocation, so selecting/clearing needs one audited write.
 * The latest decision supersedes prior unpaid choices, including after clearing a selection.
 */
export function monthlyCashback(allocations) {
  const groups = new Map();
  const key = a => JSON.stringify([a.creditCardId, a.receivedDate.slice(0, 7)]);
  const decisionTime = a => Date.parse(a.cashback?.selectionUpdatedAt || a.cashback?.updatedAt || '') || 0;
  const newest = (a, b) => decisionTime(b) - decisionTime(a)
    || String(b.id).localeCompare(String(a.id), 'en', { numeric: true });
  for (const a of allocations) {
    if (!a.creditCardId || a.combination) continue;
    const group = groups.get(key(a)) || [];
    group.push(a); groups.set(key(a), group);
  }
  const choices = new Map();
  for (const [k, group] of groups) {
    const paid = group.filter(a => a.cashback?.status === 'paid').sort(newest);
    const selectable = group.filter(a => !a.cashback?.individualStatus);
    const decisions = selectable.filter(a => a.cashback?.selectionUpdatedAt).sort(newest);
    // Legacy automatic unpaid defaults have no updatedAt and are not manual selections.
    const legacy = selectable.filter(a => a.cashback?.status === 'unpaid' && a.cashback.updatedAt).sort(newest);
    const decision = decisions[0];
    const selected = paid.find(a => !a.cashback.individualStatus) || (decision ? ['unpaid', 'paid'].includes(decision.cashback.status) ? decision : null : legacy[0]);
    choices.set(k, { selected, version: decision?.cashback.selectionUpdatedAt, paidIds: paid.map(a => a.id).sort() });
  }
  return allocations.map(a => {
    const { selected, version, paidIds = [] } = choices.get(key(a)) || {};
    const applicable = a.creditCardId && !a.combination;
    const status = !applicable ? 'not_applicable' : a.cashback?.status === 'paid' ? 'paid' : a.cashback?.individualStatus ? a.cashback.status : selected ? selected.id === a.id ? selected.cashback.status : 'not_applicable'
      : a.cashback?.status === 'not_applicable' ? 'not_applicable' : 'review';
    return { ...a, cashbackEligibility: status, cashbackSelectedAllocationId: selected?.id || null,
      cashbackSelectionStatus: selected?.cashback.status || null, cashbackSelectionUpdatedAt: version || null, cashbackOtherPaidAllocationIds: paidIds.filter(id => id !== a.id) };
  });
}
export function cashbackStatus(allocation) {
  if (['review', 'unpaid', 'paid', 'not_applicable'].includes(allocation.cashbackEligibility)) return allocation.cashbackEligibility;
  return allocation.cashback?.status ?? (allocation.creditCardId && !allocation.combination ? 'review' : 'not_applicable');
}
/** Metadata is generated server-side; clients cannot choose ordering or forge selection. */
export function prepareCashback(input, allocation, today, now = new Date().toISOString()) {
  const cashback = validateCashback(input, allocation, today);
  cashback.updatedAt = now;
  if (cashback.status === 'paid') cashback.createdAt = allocation.cashback?.createdAt || now;
  // Additional payments are independent: they must not move the monthly choice.
  if (allocation.cashback?.individualStatus || (cashback.status === 'paid' && allocation.cashbackSelectedAllocationId !== allocation.id && (allocation.cashbackSelectedAllocationId || allocation.cashbackOtherPaidAllocationIds?.length))) {
    cashback.individualStatus = true;
    return cashback;
  }
  // Review explicitly clears an unpaid choice even when saved from an excluded peer.
  if (['review', 'unpaid', 'paid'].includes(cashback.status) || !allocation.cashbackSelectedAllocationId || allocation.cashbackSelectedAllocationId === allocation.id) {
    cashback.selectionUpdatedAt = new Date(Math.max(Date.parse(now), Date.parse(allocation.cashbackSelectionUpdatedAt || '') + 1 || 0)).toISOString();
  }
  return cashback;
}
export function validateCashback(input, allocation, today) {
  if (!allocation.creditCardId || allocation.combination) throw new Error('Cashback belongs to an original card contribution.');
  if (!allocation.cashback?.individualStatus && input.status === 'review' && allocation.cashbackSelectedAllocationId && allocation.cashbackSelectedAllocationId !== allocation.id && allocation.cashbackSelectionStatus === 'paid') throw new Error('Cashback is already paid on another transaction for this card and month. Correct the selected cashback payment before returning these transactions to Needs review.');
  if (!allocation.cashback?.individualStatus && input.status === 'unpaid' && allocation.cashbackSelectedAllocationId && allocation.cashbackSelectedAllocationId !== allocation.id && allocation.cashbackSelectionStatus === 'paid' && allocation.cashback?.status !== 'paid') throw new Error('Cashback is already paid on another transaction for this card and month. Correct that payment before selecting a different transaction.');
  if (!['review', 'unpaid', 'paid', 'not_applicable'].includes(input.status)) throw new Error('Choose a valid cashback status.');
  const notes = String(input.notes || '').trim();
  if (notes.length > 2000) throw new Error('Cashback notes must be 2000 characters or fewer.');
  if (input.status !== 'paid') return { status: input.status, notes };
  const otherPaid = allocation.cashbackOtherPaidAllocationIds || [];
  const confirmed = input.confirmedCashbackAllocationIds;
  if (allocation.cashback?.status !== 'paid' && otherPaid.length && (!Array.isArray(confirmed) || JSON.stringify([...confirmed].sort()) !== JSON.stringify([...otherPaid].sort()))) throw new Error('Cashback is already paid on another transaction for this card and month. Review the existing payments and confirm this additional cashback. If the list has changed, refresh and review it again.');
  const split = input.combinedAmountRupees != null
    ? splitProfit(input.combinedAmountRupees, input.partnerProfitPercent, allocation.amountRupees, input.noCfoSplit ?? false, input.partnerAmountRupees)
    : null;
  const paymentMethod = String(input.paymentMethod || '').trim();
  if (paymentMethod.length > 200) throw new Error('Payment account/method must be 200 characters or fewer.');
  const unknownAmount = input.amountRupees == null && allocation.receivedDate < today;
  if (!unknownAmount && (typeof input.amountRupees !== 'number' || !Number.isSafeInteger(input.amountRupees) || input.amountRupees <= 0)) throw new Error('Enter a positive whole-rupee cashback amount.');
  const date = input.paidDate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Enter a valid cashback payment date.');
  if (date < allocation.receivedDate || date > today) throw new Error('Cashback date must be between the contribution date and today.');
  return { status: 'paid', amountRupees: unknownAmount ? null : input.amountRupees, ...split, paidDate: date, notes, ...(paymentMethod ? { paymentMethod } : {}) };
}

export function cashbackTotals(allocations) {
  const payments = allocations.filter(a => a.cashback?.status === 'paid').map(a => a.cashback);
  return { totalCashbackPaid: payments.reduce((sum, p) => sum + (p.amountRupees ?? 0), 0),
    unknownCashbackCount: payments.filter(p => p.amountRupees == null).length };
}
