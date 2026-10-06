import { expect, it } from 'vitest';
import { monthlyCashback, cashbackStatus, cashbackTotals } from '../functions/capitalos-api/cashback.mjs';

const transaction = (id: string, receivedDate = '2026-09-01', creditCardId = 'c', createdAt = '') =>
  ({ id, receivedDate, creditCardId, createdAt, cashback: { status: 'unpaid' as const } });
const statuses = (rows: Parameters<typeof monthlyCashback>[0]) => Object.fromEntries(monthlyCashback(rows).map(a => [a.id, cashbackStatus(a)]));

it('selects by transaction date, creation time, then stable numeric ID regardless of fetch order', () => {
  const rows = [transaction('10'), transaction('2'), transaction('later', '2026-09-02'), transaction('created-later', '2026-09-01', 'c', '2026-09-02T00:00:00Z')];
  expect(statuses(rows)).toEqual({ '2': 'unpaid', '10': 'not_first_transaction', later: 'not_first_transaction', 'created-later': 'not_first_transaction' });
  expect(statuses([...rows].reverse())).toEqual(statuses(rows));
});

it('resets monthly and yearly, separates cards, and ignores combined capital as a new transaction', () => {
  const rows = [transaction('first'), transaction('repeat', '2026-09-30'), transaction('next', '2026-10-01'), transaction('year', '2027-09-01'), transaction('other-card', '2026-09-02', 'other'), { ...transaction('combined', '2026-09-01'), combination: { sources: [] } }];
  expect(statuses(rows)).toMatchObject({ first: 'unpaid', repeat: 'not_first_transaction', next: 'unpaid', year: 'unpaid', 'other-card': 'unpaid' });
});

it('recalculates after backdating, deleting and restoring an earlier transaction without losing paid history', () => {
  const paid = { ...transaction('paid', '2026-09-02'), cashback: { status: 'paid' as const, amountRupees: 500, paidDate: '2026-09-03' } };
  const earlier = transaction('earlier');
  const result = monthlyCashback([paid, earlier]);
  expect(cashbackStatus(result[0]!)).toBe('not_first_transaction');
  expect(cashbackTotals(result).totalCashbackPaid).toBe(500);
  expect(cashbackStatus(monthlyCashback([result[0]!])[0]!)).toBe('paid');
  expect(cashbackStatus(monthlyCashback([result[0]!, earlier])[0]!)).toBe('not_first_transaction');
});
