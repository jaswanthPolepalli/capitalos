import { describe, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
import { buildProfitPaymentWhatsAppLink } from '../client/src/lib/whatsapp';

describe('profit payment confirmations', () => {
  it('labels the partner-facing contribution rate as estimated', async () => {
    const seed = baseData();
    seed.COS_Partners[0].email = 'partner@example.test';
    const sendMail = vi.fn().mockResolvedValue({});
    const h = createApiHarness(seed, undefined, sendMail);
    await h.request('POST', 'allocations', { partnerId: 'p', amountRupees: 12000, profitPercent: 3, receivedDate: '2026-09-01' });
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledOnce());
    expect(sendMail.mock.calls[0][0].html).toContain('Contribution Source</th><td>Cash</td>');
    expect(sendMail.mock.calls[0][0].html).toContain('Estimated profit % per month');
    expect(sendMail.mock.calls[0][0].html).not.toContain('Profit Rate');
  });

  it('includes the linked card name as the contribution source in the email', async () => {
    const seed = baseData();
    seed.COS_Partners[0].email = 'partner@example.test';
    seed.COS_CreditCards[0].card_name = 'HDFC Credit Card';
    const sendMail = vi.fn().mockResolvedValue({});
    const h = createApiHarness(seed, undefined, sendMail);
    await h.request('POST', 'allocations', { partnerId: 'p', amountRupees: 12000, profitPercent: 3, receivedDate: '2026-09-01', creditCardId: 'c' });
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledOnce());
    expect(sendMail.mock.calls[0][0].html).toContain('Contribution Source</th><td>Credit Card — HDFC Credit Card</td>');
  });

  it('shows same-card outstanding split by bill status after a capital return', async () => {
    const seed = baseData();
    seed.COS_Partners[0].email = 'partner@example.test';
    Object.assign(seed.COS_Allocations[0], { credit_card_id: 'c', return_date: '2026-12-01', notes: 'WA_CONFIRMED' });
    seed.COS_Allocations.push({ ...seed.COS_Allocations[0], ROWID: 'b', amount_rupees: 20000, return_date: null, notes: '' });
    const sendMail = vi.fn().mockResolvedValue({});
    const h = createApiHarness(seed, undefined, sendMail);
    await h.request('POST', 'capital-returns', { partnerId: 'p', allocationId: 'a', amountRupees: 3000, returnedDate: '2026-10-09' });
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledOnce());
    const html = sendMail.mock.calls[0][0].html;
    expect(html).toContain('Bill generated</td><td>₹6,000</td>');
    expect(html).toContain('Bill not generated</td><td>₹20,000</td>');
  });

  it('accepts and reloads profit paid after the principal has been fully returned', async () => {
    const seed = baseData();
    seed.COS_Returns[0].amount_rupees = seed.COS_Allocations[0].amount_rupees;
    const h = createApiHarness(seed);
    const result = await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 840, paidDate: '2026-09-23', notes: 'Final profit after capital return' });
    expect(result.status).toBe('success');
    const reloaded = await h.request('GET', 'profit-records');
    expect(reloaded.data).toContainEqual(expect.objectContaining({ allocationId: 'a', amountRupees: 600, notes: 'Final profit after capital return' }));
    expect(h.db.COS_Returns).toEqual(seed.COS_Returns);
    expect(h.db.COS_Allocations).toEqual(seed.COS_Allocations);
  });

  it.each([false, true])('emails the payment and allocation details (card: %s)', async card => {
    const seed = baseData();
    seed.COS_Partners[0].name = 'Jaswanth <Test>';
    seed.COS_Partners[0].email = 'partner@example.test';
    Object.assign(seed.COS_Allocations[0], { amount_rupees: 900000, received_date: '2026-09-01', credit_card_id: card ? 'c' : null });
    seed.COS_Returns[0].amount_rupees = 100000;
    seed.COS_Returns.push({ ROWID: 'deleted', allocation_id: 'a', amount_rupees: 400000, notes: 'DELETED:2026-09-01T00:00:00Z' });
    seed.COS_CreditCards[0].card_name = 'Travel <Card>';
    const sendMail = vi.fn().mockResolvedValue({});
    const h = createApiHarness(seed, undefined, sendMail);
    const result = await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 11900, paidDate: '2026-09-14' });
    expect(result.status).toBe('success');
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledOnce());
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe('Profit Payment Confirmation — CapitalOS');
    for (const text of ['Hi Jaswanth &lt;Test&gt;,', '₹8,500', '14 Sept 2026', '01 Sept 2026', '₹8,00,000', '0.94%', card ? 'Credit Card (Travel &lt;Card&gt;)' : 'Cash']) expect(mail.html).toContain(text);
    expect(mail.html).not.toContain('per month');
  });

  it('shows the actual rate without a monthly suffix on WhatsApp, using contribution capital after returns', () => {
    const options = { partnerName: 'Jaswanth', amountRupees: 8500, paidDate: '2026-09-14', capitalOutstanding: 800000, contributionAmountRupees: 900000, profitPercent: 3 };
    const message = opts => new URL(buildProfitPaymentWhatsAppLink(opts)).searchParams.get('text');
    expect(message(options)).toContain('Rate: 0.94%');
    expect(message(options)).not.toContain('per month');
    expect(message({ ...options, capitalOutstanding: 0 })).toContain('Rate: 0.94%');
  });
});
