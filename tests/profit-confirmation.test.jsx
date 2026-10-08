import { describe, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
import { buildProfitPaymentWhatsAppLink } from '../client/src/lib/whatsapp';

describe('profit payment confirmations', () => {
  it('accepts and reloads profit paid after the principal has been fully returned', async () => {
    const seed = baseData();
    seed.COS_Returns[0].amount_rupees = seed.COS_Allocations[0].amount_rupees;
    const h = createApiHarness(seed);
    const result = await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 600, paidDate: '2026-09-23', notes: 'Final profit after capital return' });
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
    const result = await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 8500, paidDate: '2026-09-14' });
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
