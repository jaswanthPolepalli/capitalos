import { splitProfit } from './profit-sharing.mjs';
/** Cashback status is recorded per transaction and is never derived from its peers.
 * One cashback per card and contribution month remains the normal case, but the rule is
 * advisory: a second cashback is accepted after an explicit confirmation, and the earlier
 * transaction keeps the status it was saved with. Financial history is never rewritten.
 */
/** Older builds defaulted card transactions to unpaid without an update timestamp. */
const legacyAutoUnpaid = cashback => cashback?.status === 'unpaid' && !cashback.updatedAt && !cashback.selectionUpdatedAt;
/** True when a person recorded a cashback decision: an unpaid choice or a payment. */
export function cashbackRecorded(cashback) {
  return ['unpaid', 'paid'].includes(cashback?.status) && !legacyAutoUnpaid(cashback);
}
function savedStatus(allocation) {
  if (!allocation.creditCardId || allocation.combination) return 'not_applicable';
  if (legacyAutoUnpaid(allocation.cashback)) return 'review';
  return ['review', 'unpaid', 'paid', 'not_applicable'].includes(allocation.cashback?.status) ? allocation.cashback.status : 'review';
}
const monthKey = a => JSON.stringify([a.creditCardId, a.receivedDate.slice(0, 7)]);
export function monthlyCashback(allocations) {
  const recorded = new Map();
  for (const a of allocations) {
    if (!a.creditCardId || a.combination || !cashbackRecorded(a.cashback)) continue;
    recorded.set(monthKey(a), [...(recorded.get(monthKey(a)) || []), String(a.id)]);
  }
  return allocations.map(a => {
    const applicable = a.creditCardId && !a.combination;
    const others = (applicable ? recorded.get(monthKey(a)) || [] : []).filter(id => id !== String(a.id)).sort();
    return { ...a, cashbackEligibility: savedStatus(a), cashbackOtherAllocationIds: others };
  });
}
export function cashbackStatus(allocation) {
  if (['review', 'unpaid', 'paid', 'not_applicable'].includes(allocation.cashbackEligibility)) return allocation.cashbackEligibility;
  return savedStatus(allocation);
}
/** Metadata is generated server-side; clients cannot forge timestamps. */
export function prepareCashback(input, allocation, today, now = new Date().toISOString()) {
  const cashback = validateCashback(input, allocation, today);
  cashback.updatedAt = now;
  if (cashback.status === 'paid') cashback.createdAt = allocation.cashback?.createdAt || now;
  return cashback;
}
export function validateCashback(input, allocation, today) {
  if (!allocation.creditCardId || allocation.combination) throw new Error('Cashback belongs to an original card contribution.');
  if (!['review', 'unpaid', 'paid', 'not_applicable'].includes(input.status)) throw new Error('Choose a valid cashback status.');
  const notes = String(input.notes || '').trim();
  if (notes.length > 2000) throw new Error('Cashback notes must be 2000 characters or fewer.');
  // The monthly rule only warns: a new cashback decision needs the current peer list confirmed.
  const others = allocation.cashbackOtherAllocationIds || [];
  const confirmed = input.confirmedCashbackAllocationIds;
  if (['unpaid', 'paid'].includes(input.status) && !cashbackRecorded(allocation.cashback) && others.length
    && (!Array.isArray(confirmed) || JSON.stringify([...confirmed].map(String).sort()) !== JSON.stringify([...others].sort()))) {
    throw new Error('Cashback is already recorded on another transaction for this card and month. Review the existing cashback transactions and confirm this additional cashback. If the list has changed, refresh and review it again.');
  }
  if (input.status !== 'paid') return { status: input.status, notes };
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
