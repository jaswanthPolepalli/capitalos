import { describe, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
import { cashbackStatus } from '../functions/capitalos-api/cashback.mjs';
import { buildProfitPaymentWhatsAppLink } from '../client/src/lib/whatsapp';

function seed() { const data = baseData(); data.COS_Allocations[0].credit_card_id = 'c'; return data; }
const payment = { status: 'paid', amountRupees: 500, paidDate: '2026-09-01', notes: 'Historical cashback' };
describe('independent cashback settlements', () => {
  it('leaves legacy card transactions for review and initializes new card transactions as unpaid', async () => {
    const h = createApiHarness(seed());
    expect(cashbackStatus((await h.request('GET', 'allocations')).data[0])).toBe('review');
    const result = await h.request('POST', 'allocations', { partnerId: 'p', amountRupees: 10000, profitPercent: 3, receivedDate: '2026-09-01', creditCardId: 'c' });
    expect(result.data.cashback.status).toBe('unpaid');
  });
  it('updates a single payment after full capital return, preserving regular profit and principal', async () => {
    const data = seed(); data.COS_Returns[0].amount_rupees = 10000;
    const h = createApiHarness(data);
    const beforeProfit = structuredClone(h.db.COS_Profits), beforeReturns = structuredClone(h.db.COS_Returns);
    expect((await h.request('PATCH', 'allocations/a/cashback', payment)).status).toBe('success');
    const createdAt = (await h.request('GET', 'allocations')).data[0].cashback.createdAt;
    await h.request('PATCH', 'allocations/a/cashback', { ...payment, amountRupees: 700, paidDate: '2026-09-02' });
    const saved = (await h.request('GET', 'allocations')).data[0];
    expect(saved.cashback).toMatchObject({ amountRupees: 700, paidDate: '2026-09-02', createdAt });
    expect(h.db.COS_Allocations).toHaveLength(1);
    expect(h.db.COS_Profits).toEqual(beforeProfit); expect(h.db.COS_Returns).toEqual(beforeReturns);
    const edits = h.db.COS_Activity.filter(r => r.status === 'committed');
    expect(JSON.parse(JSON.parse(edits.at(-1).before_state).cashback_data).amountRupees).toBe(500);
    await h.request('PATCH', 'allocations/a/cashback', { status: 'not_applicable' });
    expect((await h.request('GET', 'allocations')).data[0].cashback).not.toHaveProperty('amountRupees');
  });
  it.each([{ amountRupees: -1 }, { amountRupees: 1.5 }, { amountRupees: '500' }, { paidDate: '2026-02-30' }, { paidDate: '2025-12-31' }, { paidDate: '2099-01-01' }, { status: 'unknown' }])('rejects invalid payment %j', async patch => {
    const h = createApiHarness(seed());
    expect((await h.request('PATCH', 'allocations/a/cashback', { ...payment, ...patch })).status).toBe('error');
    expect(h.db.COS_Allocations[0].cashback_data).toBeUndefined();
  });
  it('rejects cash contributions and hidden parents', async () => {
    const cash = createApiHarness(baseData());
    expect((await cash.request('PATCH', 'allocations/a/cashback', payment)).status).toBe('error');
    const h = createApiHarness(seed()); await h.request('DELETE', 'partners/p');
    expect((await h.request('PATCH', 'allocations/a/cashback', payment)).status).toBe('error');
  });
  it('preserves cashback through ordinary contribution edits and rejects incompatible edits', async () => {
    const h = createApiHarness(seed());
    await h.request('PATCH', 'allocations/a/cashback', payment);
    await h.request('PATCH', 'allocations/a', { notes: 'Edited notes' });
    expect((await h.request('GET', 'allocations')).data[0].cashback.amountRupees).toBe(500);
    expect((await h.request('PATCH', 'allocations/a', { creditCardId: null })).status).toBe('error');
    expect((await h.request('PATCH', 'allocations/a', { receivedDate: '2026-09-02' })).status).toBe('error');
  });
  it('uses cashback wording and only emails when explicitly selected', async () => {
    const data = seed(); data.COS_Partners[0].email = 'partner@example.test';
    const sendMail = vi.fn().mockResolvedValue({}); const h = createApiHarness(data, undefined, sendMail);
    await h.request('PATCH', 'allocations/a/cashback', payment);
    expect(sendMail).not.toHaveBeenCalled();
    await h.request('PATCH', 'allocations/a/cashback', { ...payment, sendEmail: true });
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledOnce());
    expect(sendMail.mock.calls[0][0]).toMatchObject({ subject: 'Cashback Sharing — CapitalOS' });
    expect(sendMail.mock.calls[0][0].html).toContain('Your cashback sharing has been processed');
    expect(sendMail.mock.calls[0][0].html).not.toContain('Profit Payment Confirmation');
    const text = new URL(buildProfitPaymentWhatsAppLink({ kind: 'cashback', partnerName: 'Partner', ...payment })).searchParams.get('text');
    expect(text).toContain('*Cashback Sharing*'); expect(text).not.toContain('profit payment');
  });
});

it('accepts an unknown historical cashback amount, preserves paid status, and suppresses incomplete email', async () => {
  const data = seed(); data.COS_Partners[0].email = 'partner@example.test';
  const sendMail = vi.fn(); const h = createApiHarness(data, undefined, sendMail);
  const result = await h.request('PATCH', 'allocations/a/cashback', { ...payment, amountRupees: null, sendEmail: true });
  expect(result.data.cashback).toMatchObject({ status: 'paid', amountRupees: null });
  expect(sendMail).not.toHaveBeenCalled();
  await h.request('PATCH', 'allocations/a/cashback', { ...payment, amountRupees: 900 });
  expect((await h.request('GET', 'allocations')).data[0].cashback.amountRupees).toBe(900);
});
