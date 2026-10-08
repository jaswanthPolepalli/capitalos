import { describe, expect, it } from 'vitest';
import { actualPaidRate, monthlyPayout, monthlyRateLabel, paidRateLabel } from '../client/src/lib/profitDisplay.js';
import type { ProfitRecord } from '../client/src/store.js';
const allocation = { id: 'a', amountRupees: 149999, profitPercent: 4, expectedMonthlyProfit: 6000, profitPending: 6000 };
const payment = (amountRupees: number, extra = {}): ProfitRecord => ({ id: 'p', allocationId: 'a', partnerId: 'partner', amountRupees, paidDate: '2026-10-05', notes: '', ...extra });
describe('shared profit presentation', () => {
  it('replaces a completed estimate with actual paid and excludes unrelated months and contributions', () => {
    const records = [payment(5000), payment(9000, { paidDate: '2026-09-05' }), payment(8000, { allocationId: 'other' })];
    expect(monthlyPayout({ ...allocation, profitPending: 0 }, records, '2026-10')).toBe(5000);
    expect(monthlyRateLabel(allocation, records, '2026-10')).toBe('3.33% paid');
    expect(monthlyPayout(allocation, records, '2026-11')).toBe(6000);
    expect(monthlyRateLabel(allocation, records, '2026-11')).toBe('4% p.m.');
  });
  it('includes only the remaining balance after multiple partial payments', () => {
    const records = [payment(1000), payment(2000)];
    expect(monthlyPayout({ ...allocation, profitPending: 2500 }, records, '2026-10')).toBe(5500);
    expect(monthlyRateLabel(allocation, records, '2026-10')).toBe('2.00% paid');
  });
  it('uses saved payment capital and handles missing or zero capital without inventing a paid rate', () => {
    expect(paidRateLabel(payment(5000, { profitCapitalRupees: 100000 }), allocation)).toBe('5.00% paid');
    expect(paidRateLabel(payment(5000), allocation)).toBe('3.33% paid');
    expect(actualPaidRate(payment(5000))).toBeNull();
    expect(paidRateLabel(payment(5000), { amountRupees: 0 })).toBe('Paid rate unavailable');
  });
});
