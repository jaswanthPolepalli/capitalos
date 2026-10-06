import { useState } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cashbackStatus, validateCashback, type CashbackStatus } from '../../../functions/capitalos-api/cashback.mjs';
import { businessToday } from '../lib/businessDates';
import { buildProfitPaymentWhatsAppLink } from '../lib/whatsapp';
import { updateCashback, type AllocationSummary, type Cashback } from '../store';

export function CashbackModal({ allocation, onClose }: { allocation: AllocationSummary; onClose: () => void }) {
  const existing = allocation.cashback;
  const historical = allocation.receivedDate < businessToday();
  const [status, setStatus] = useState<CashbackStatus>(cashbackStatus(allocation));
  const [amount, setAmount] = useState(existing?.status === 'paid' && existing.amountRupees != null ? String(existing.amountRupees) : '');
  const [date, setDate] = useState(existing?.status === 'paid' ? existing.paidDate : businessToday());
  const [notes, setNotes] = useState(existing?.notes || '');
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Cashback | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError('');
    let payment: Cashback;
    try { payment = validateCashback({ status, amountRupees: amount.trim() === '' ? null : Number(amount), paidDate: date, notes }, allocation, businessToday()); }
    catch (err) { setError((err as Error).message); return; }
    setSaving(true);
    try { await updateCashback(allocation.id, payment, sendEmail); setSaved(payment); }
    catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cashback-title">
    <div className="modal cashback-modal">
      <div className="modal__header"><h2 id="cashback-title">{saved ? 'Cashback saved' : 'Cashback sharing'}</h2><button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Close cashback"><X size={18} /></button></div>
      {saved ? <div className="modal__body">
        <p role="status">{saved.status === 'paid' ? saved.amountRupees == null ? 'Marked paid · Amount not recorded. You can add it later.' : 'Cashback payment saved. Its ledger entry is up to date.' : 'Cashback status updated.'}</p>
        {saved.status === 'paid' && saved.amountRupees != null && <a className="button button--primary" target="_blank" rel="noopener noreferrer" href={buildProfitPaymentWhatsAppLink({
          kind: 'cashback', partnerName: allocation.partner?.name || 'Partner', partnerPhone: allocation.partner?.phone ?? null,
          amountRupees: saved.amountRupees, paidDate: saved.paidDate, fundingSource: 'card', cardName: allocation.creditCard?.cardName ?? null,
          amountGivenDate: allocation.receivedDate, capitalOutstanding: allocation.capitalOutstanding,
          profitPercent: Math.round(saved.amountRupees / allocation.amountRupees * 10000) / 100,
        })}>Share on WhatsApp</a>}
        <div className="modal__footer"><button className="button button--secondary" onClick={onClose}>Done</button></div>
      </div> : <form className="modal__body" onSubmit={save}>
        <p><strong>{allocation.partner?.name}</strong> · {allocation.creditCard?.cardName || 'Card'}<br />Contribution: {allocation.receivedDate} · ₹{allocation.amountRupees.toLocaleString('en-IN')}</p>
        <p className="form-hint">Additional to regular profit. Choose one transaction on this card per calendar month by marking it unpaid or paid. Other transactions will show Not applicable.</p>
        {allocation.cashbackSelectedAllocationId && allocation.cashbackSelectedAllocationId !== allocation.id && <p className="form-hint">{allocation.cashbackSelectionStatus === 'paid' ? 'Cashback is already paid on the linked transaction. Correct that payment before changing the selection or returning to Needs review.' : 'Marking this transaction unpaid will move the cashback selection here. Choosing Needs review clears the unpaid selection for this card and month; automatically excluded transactions return to review.'}{' '}<Link to={`/pending-profits?cashback=${encodeURIComponent(allocation.cashbackSelectedAllocationId)}`} onClick={onClose}>View selected cashback transaction</Link></p>}
        <div className="form-field"><label className="form-label" htmlFor="cashback-status">Cashback status</label><select id="cashback-status" className="form-input" value={status} onChange={e => setStatus(e.target.value as CashbackStatus)} disabled={saving}>
          <option value="review">Needs review</option><option value="unpaid">Cashback unpaid</option><option value="paid">Paid to partner</option><option value="not_applicable">Not applicable</option>
        </select></div>
        {status === 'paid' && <>
          <div className="form-field"><label className="form-label" htmlFor="cashback-amount">Cashback amount (₹)</label><input id="cashback-amount" className="form-input" type="number" inputMode="numeric" min="1" step="1" required={!historical} value={amount} onChange={e => setAmount(e.target.value)} disabled={saving} /></div>
          <div className="form-field"><label className="form-label" htmlFor="cashback-date">Date shared with partner</label><input id="cashback-date" className="form-input" type="date" min={allocation.receivedDate} max={businessToday()} required value={date} onChange={e => setDate(e.target.value)} disabled={saving} /></div>
          {historical && <p className="form-hint">Amount is optional for old transactions. Leave it blank if unknown; totals will include only recorded amounts.</p>}
          <label className="checkbox-row"><input type="checkbox" checked={sendEmail} disabled={saving || !allocation.partner?.email || !amount.trim()} onChange={e => setSendEmail(e.target.checked)} />Send cashback sharing email</label>
          <p className="form-hint">Leave unchecked when updating old records. WhatsApp sharing is available after saving.</p>
        </>}
        {existing?.status === 'paid' && status !== 'paid' && <p className="form-hint">This correction removes the cashback payment from the ledger. The previous values remain in change history.</p>}
        <div className="form-field"><label className="form-label" htmlFor="cashback-notes">Notes (optional)</label><textarea id="cashback-notes" className="form-input" maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} disabled={saving} /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal__footer"><button className="button button--secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : 'Save cashback'}</button></div>
      </form>}
    </div>
  </div>;
}
