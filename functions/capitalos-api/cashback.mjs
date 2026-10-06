/** One cashback settlement per original card contribution, independent of profit. */
export function cashbackStatus(allocation) {
  return allocation.cashback?.status ?? (allocation.creditCardId && !allocation.combination ? 'review' : 'not_applicable');
}
export function validateCashback(input, allocation, today) {
  if (!allocation.creditCardId || allocation.combination) throw new Error('Cashback belongs to an original card contribution.');
  if (!['review', 'unpaid', 'paid', 'not_applicable'].includes(input.status)) throw new Error('Choose a valid cashback status.');
  const notes = String(input.notes || '').trim();
  if (notes.length > 2000) throw new Error('Cashback notes must be 2000 characters or fewer.');
  if (input.status !== 'paid') return { status: input.status, notes };
  const unknownAmount = input.amountRupees == null && allocation.receivedDate < today;
  if (!unknownAmount && (typeof input.amountRupees !== 'number' || !Number.isSafeInteger(input.amountRupees) || input.amountRupees <= 0)) throw new Error('Enter a positive whole-rupee cashback amount.');
  const date = input.paidDate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Enter a valid cashback payment date.');
  if (date < allocation.receivedDate || date > today) throw new Error('Cashback date must be between the contribution date and today.');
  return { status: 'paid', amountRupees: unknownAmount ? null : input.amountRupees, paidDate: date, notes };
}

export function cashbackTotals(allocations) {
  const payments = allocations.filter(a => a.cashback?.status === 'paid').map(a => a.cashback);
  return { totalCashbackPaid: payments.reduce((sum, p) => sum + (p.amountRupees ?? 0), 0),
    unknownCashbackCount: payments.filter(p => p.amountRupees == null).length };
}
