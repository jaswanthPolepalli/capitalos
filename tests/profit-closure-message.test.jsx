import { expect, it, vi } from 'vitest';
import { profitClosureMessage } from '../functions/capitalos-api/profit-closure-message.mjs';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
const a = { id: 'a', amountRupees: 150000, receivedDate: '2026-09-07', cashback: { status: 'paid', amountRupees: 1000 } };
const current = { id: 'c', allocationId: 'a', amountRupees: 0, paidDate: '2026-10-08' };
const partial = { id: 'p', allocationId: 'a', amountRupees: 5000, paidDate: '2026-10-01', notes: 'Partial payment' };
const message = (allocation = a, records = [partial]) => profitClosureMessage({ name: 'Paparao' }, allocation, current, records, 'HDFC VISA');
it('matches the approved example and isolates the transaction', () => {
  const text = message(a, [partial, current, { ...partial, allocationId: 'other', amountRupees: 9999 }]);
  expect(text).toContain('Current profit: ₹0');
  expect(text).toContain('Partial profits paid earlier: ₹5,000');
  expect(text).toContain('Cashback paid: ₹1,000');
  expect(text).toContain('Total profit received: ₹6,000');
  expect(text).toContain('Total return: 4.00%');
  expect(text).toContain('07 September 2026');
});
it('omits unpaid cashback and absent partial payments', () => {
  const text = message({ ...a, cashback: { status: 'unpaid', amountRupees: 1000 } }, []);
  expect(text).not.toContain('Cashback paid:'); expect(text).not.toContain('Partial profits');
  expect(text).toContain('Total return: 0.00%');
});
it('includes earlier completed cycles without mislabelling them as partial', () => {
  const text = message(a, [partial, { ...partial, id: 'full', notes: 'Capital reinvested', amountRupees: 6000 }]);
  expect(text).toContain('Other profits paid earlier: ₹6,000');
  expect(text).toContain('Total profit received: ₹12,000');
  expect(text).toContain('Total return: 8.00%');
});
it('does not invent a total rate for unknown cashback', () => {
  const text = message({ ...a, cashback: { status: 'paid', amountRupees: null } });
  expect(text).toContain('Cashback paid: Amount not recorded');
  expect(text).toContain('At least ₹5,000'); expect(text).toContain('Total return: Unavailable');
});
it('emails the same escaped snapshot and rejects duplicate closure without a second email', async () => {
  const seed = baseData(); seed.COS_Profits = [];
  seed.COS_Partners[0].email = 'synthetic@example.test'; seed.COS_Partners[0].name = '<Test>';
  const send = vi.fn().mockResolvedValue({}); const h = createApiHarness(seed, undefined, send);
  const input = { allocationId: 'a', partnerId: 'p', expectedPending: 300, confirmed: true, recur: false };
  const result = await h.request('POST', 'profit-records/close', input);
  expect(result.data.confirmation.emailStatus).toBe('sent');
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0].subject).toBe('Profit Closure Confirmation — CapitalOS');
  expect(send.mock.calls[0][0].html).toContain('Hi &lt;Test&gt;');
  expect(result.data.confirmation.message).toContain('Hi <Test>');
  await h.request('POST', 'profit-records/close', input); expect(send).toHaveBeenCalledOnce();
});
it('keeps closure successful when email delivery fails', async () => {
  const seed = baseData(); seed.COS_Profits = []; seed.COS_Partners[0].email = 'synthetic@example.test';
  const h = createApiHarness(seed, undefined, vi.fn().mockRejectedValue(new Error('Synthetic SMTP failure')));
  const result = await h.request('POST', 'profit-records/close', { allocationId: 'a', partnerId: 'p', expectedPending: 300, confirmed: true, recur: false });
  expect(result.data.confirmation.emailStatus).toBe('unconfirmed'); expect(h.db.COS_Profits).toHaveLength(1);
});
