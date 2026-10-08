import type { AllocationSummary, ProfitRecord } from '../store.js';

export const currentProfitMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export function monthlyPayout(allocation: Pick<AllocationSummary, 'id' | 'profitPending'>, payments: ProfitRecord[], month = currentProfitMonth()) {
  const paid = payments.filter(p => p.allocationId === allocation.id && p.paidDate.startsWith(month));
  return paid.reduce((sum, p) => sum + p.amountRupees, 0) + allocation.profitPending;
}

export function actualPaidRate(payment: Pick<ProfitRecord, 'amountRupees' | 'profitCapitalRupees'> & { notes?: string }, allocation?: { amountRupees: number }) {
  const capital = payment.profitCapitalRupees ?? allocation?.amountRupees;
  return capital && capital > 0 ? payment.amountRupees / capital * 100 : null;
}

export function paidRateLabel(payment: Pick<ProfitRecord, 'amountRupees' | 'profitCapitalRupees'> & { notes?: string }, allocation?: { amountRupees: number }) {
  if (payment.amountRupees === 0 && payment.notes?.startsWith('Profit closed without payment')) return 'Closed without payment';
  const rate = actualPaidRate(payment, allocation);
  return rate === null ? 'Paid rate unavailable' : `${rate.toFixed(2)}% paid`;
}

export function monthlyRateLabel(allocation: Pick<AllocationSummary, 'id' | 'amountRupees' | 'profitPercent'>, payments: ProfitRecord[], month: string) {
  const paid = payments.filter(p => p.allocationId === allocation.id && p.paidDate.startsWith(month));
  if (!paid.length) return `${allocation.profitPercent}% p.m.`;
  if (paid.every(p => p.amountRupees === 0) && paid.some(p => p.notes?.startsWith('Profit closed without payment'))) return 'Closed without payment';
  const rates = paid.map(p => actualPaidRate(p, allocation));
  return rates.some(rate => rate === null) ? 'Paid rate unavailable' : `${rates.reduce<number>((sum, rate) => sum + (rate ?? 0), 0).toFixed(2)}% paid`;
}
