import { pendingProfit } from './payment-groups.mjs';

export function prepareProfitClosure(input, allocations, profits, returns, today) {
  const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (input?.confirmed !== true) fail('Confirm the warning before closing profit without payment.');
  if (input.amountRupees !== undefined && input.amountRupees !== 0) fail('Closing profit cannot record a payment amount.');
  if (input.recur !== undefined && typeof input.recur !== 'boolean') fail('Invalid recurrence choice.');
  const a = allocations.find(a => a.id === input.allocationId && a.partnerId === input.partnerId);
  if (!a) fail('Active contribution not found for partner.');
  const records = profits.filter(p => p.allocationId === a.id);
  if (records.some(p => p.paidDate > today)) fail('Resolve future-dated profit records before closing this balance.');
  const pending = pendingProfit(a, allocations, profits, today, returns);
  if (pending <= 0) fail('This contribution has no pending profit to close. Refresh the page.');
  if (input.expectedPending !== pending) fail('The pending balance changed. Refresh and review the warning again.');
  const reserved = allocations.some(parent => parent.combination?.sources.some(s => s.id === a.id));
  const outstanding = a.amountRupees - returns.filter(r => r.allocationId === a.id).reduce((sum, r) => sum + r.amountRupees, 0);
  if (input.recur && (reserved || outstanding <= 0)) fail('Returned or combined-source capital cannot recur.');
  return { allocationId: a.id, partnerId: a.partnerId, amountRupees: 0, paidDate: today,
    notes: `Profit closed without payment · Waived pending: ₹${pending.toLocaleString('en-IN')}${input.recur ? ' · Capital reinvested' : ''}` };
}
