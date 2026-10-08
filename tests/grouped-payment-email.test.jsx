import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';

function setup({ fail, sendMail = vi.fn().mockResolvedValue({ accepted: ['partner@example.test'] }), email = 'partner@example.test' } = {}) {
  const seed = baseData(); seed.COS_Profits = [];
  Object.assign(seed.COS_Partners[0], { name: 'Partner <Test>', email });
  Object.assign(seed.COS_Allocations[0], { credit_card_id: 'c' });
  seed.COS_Allocations.push({ ...seed.COS_Allocations[0], ROWID: 'b', credit_card_id: null });
  seed.COS_CreditCards[0].card_name = 'Travel <Card>';
  return { ...createApiHarness(seed, fail, sendMail), sendMail };
}
function input(kind = 'profit') {
  return { groupId: '12345678-1234-1234-1234-123456789abc', kind, partnerId: 'p', date: '2026-09-25', reference: 'UTR<&>123', notes: '',
    entries: ['a', 'b'].map(allocationId => ({ allocationId, amountRupees: kind === 'profit' ? 140 : 1000,
      expectedBalance: kind === 'profit' ? 300 : allocationId === 'a' ? 9000 : 10000, recur: false })) };
}
afterEach(() => vi.restoreAllMocks());

describe('live grouped payment email', () => {
  it.each(['profit', 'capital'])('sends one consolidated %s email with scoped balances, no internal IDs, and no duplicate on replay', async kind => {
    const h = setup(); const body = input(kind);
    const response = await h.request('POST', 'payment-groups', body);
    expect(response.data).toMatchObject({ complete: true, email: { status: 'sent', recipient: 'partner@example.test' } });
    expect(h.sendMail).toHaveBeenCalledOnce();
    const mail = h.sendMail.mock.calls[0][0];
    expect(mail.to).toBe('partner@example.test');
    expect(mail.subject).toBe(`${kind === 'profit' ? 'Profit Payment' : 'Capital Return'} Confirmation — CapitalOS`);
    for (const text of ['Partner &lt;Test&gt;', 'Travel &lt;Card&gt;', 'Cash', 'UTR&lt;&amp;&gt;123', '25 Sept 2026', 'Entries: 2', '₹10,000', 'Remaining amounts apply only to the listed entries, as of this payment.', '/#/p/partner-p']) expect(mail.html).toContain(text);
    expect(mail.html).not.toContain(body.groupId); expect(mail.html).not.toContain('Entry a'); expect(mail.html).not.toContain('Entry b');
    if (kind === 'profit') {
      expect(mail.html).toContain('<strong>₹200</strong>'); expect(mail.html).toContain('Profit paid as % of this contribution');
      expect(mail.html).toContain('1%'); expect(mail.html).toContain('Profit remaining on this entry');
      expect(mail.html).not.toContain('per month');
    } else {
      expect(mail.html).toContain('<strong>₹2,000</strong>'); expect(mail.html).toContain('Capital remaining on this entry');
      expect(mail.html).toContain('₹8,000'); expect(mail.html).toContain('₹9,000'); expect(mail.html).not.toContain('%');
    }
    expect((await h.request('POST', 'payment-groups', body)).data.email.status).toBe('sent');
    expect(h.sendMail).toHaveBeenCalledOnce();
  });
  it('does not send when the partner has no email address', async () => {
    const h = setup({ email: '' });
    const result = await h.request('POST', 'payment-groups', input());
    expect(result.data).toMatchObject({ complete: true, email: { status: 'no_email' } });
    expect(h.sendMail).not.toHaveBeenCalled(); expect(h.db.COS_Profits).toHaveLength(2);
  });
  it('does not email an incomplete group', async () => {
    const h = setup({ fail: (table, action, row) => table === 'COS_Profits' && action === 'insert' && row.allocation_id === 'b' });
    const result = await h.request('POST', 'payment-groups', input());
    expect(result.data).toMatchObject({ complete: false, email: { status: 'incomplete' } });
    expect(h.sendMail).not.toHaveBeenCalled(); expect(h.db.COS_Profits).toHaveLength(1);
  });
  it('keeps recorded payments and does not resubmit an uncertain SMTP attempt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sendMail = vi.fn().mockRejectedValue(new Error('SMTP response lost'));
    const h = setup({ sendMail }); const body = input();
    const result = await h.request('POST', 'payment-groups', body);
    expect(result.status).toBe('success'); expect(result.data).toMatchObject({ complete: true, email: { status: 'unconfirmed' } });
    expect(h.db.COS_Profits).toHaveLength(2);
    expect((await h.request('POST', 'payment-groups', body)).data.email.status).toBe('unconfirmed');
    expect(sendMail).toHaveBeenCalledOnce();
  });
  it('reserves one email when two requests submit the same group concurrently', async () => {
    const h = setup(); const body = input();
    await Promise.all([h.request('POST', 'payment-groups', body), h.request('POST', 'payment-groups', body)]);
    expect((await h.request('POST', 'payment-groups', body)).data.email.status).toBe('sent');
    expect(h.sendMail).toHaveBeenCalledOnce(); expect(h.db.COS_Profits).toHaveLength(2);
  });
  it('does not send if its durable email reservation fails', async () => {
    const h = setup({ fail: (table, action, row) => table === 'COS_Activity' && action === 'insert' && row.entity_type === 'payment-group-email' && row.status === 'pending' });
    const result = await h.request('POST', 'payment-groups', input());
    expect(result.data).toMatchObject({ complete: true, email: { status: 'unconfirmed' } });
    expect(h.sendMail).not.toHaveBeenCalled(); expect(h.db.COS_Profits).toHaveLength(2);
  });
  it('does not resend if SMTP accepted the email but its outcome could not be audited', async () => {
    const h = setup({ fail: (table, action, row) => table === 'COS_Activity' && action === 'insert' && row.entity_type === 'payment-group-email' && row.status === 'committed' });
    const body = input();
    expect((await h.request('POST', 'payment-groups', body)).data.email.status).toBe('unconfirmed');
    expect((await h.request('POST', 'payment-groups', body)).data.email.status).toBe('unconfirmed');
    expect(h.sendMail).toHaveBeenCalledOnce(); expect(h.db.COS_Profits).toHaveLength(2);
  });
});
