import { useRef, useState } from 'react';
import { buildWhatsAppLink } from '../lib/whatsapp';
import { closeProfit } from '../store';

export function CloseProfitPanel({ allocationId, partnerId, pendingAmount, partnerName, canRecur, embedded = false, onCancel, onClose }: {
  allocationId: string; partnerId: string; pendingAmount: number; partnerName?: string | undefined; canRecur: boolean; embedded?: boolean; onCancel: () => void; onClose: () => void;
}) {
  const [recur, setRecur] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{ message: string; phone: string; emailStatus: string }>();
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(pendingAmount);
  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await closeProfit({ allocationId, partnerId, expectedPending: pendingAmount, confirmed: true, recur });
      setConfirmation(result.confirmation);
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to close profit. Please refresh and try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className={embedded ? 'overview-payment' : 'modal-backdrop'} role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby="close-profit-title">
    <div className="modal">
      <div className="modal__header"><h2 id="close-profit-title">Close profit without payment</h2></div>
      <div className="modal__body">
        {done ? <><p role="status">Profit closed. No money was recorded as paid.</p>{confirmation && <><p>{confirmation.emailStatus === 'sent' ? 'Closure confirmation email sent.' : confirmation.emailStatus === 'no_email' ? 'No partner email address is recorded.' : 'Email delivery could not be confirmed. The profit is already closed.'}</p><pre style={{ whiteSpace: 'pre-wrap' }}>{confirmation.message}</pre><a className="button button--secondary" href={buildWhatsAppLink(confirmation.phone, confirmation.message)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a></>}</> : <>
          <p role="alert"><strong>Warning:</strong> This will waive the remaining <strong>{amount}</strong> profit for {partnerName ?? 'this partner'} and remove it from pending. No money will be recorded as paid, principal remains unchanged. A closure confirmation will be emailed if the partner has an email address.</p>
          <p>The closure will be dated today and remain visible in history. Cancel to keep this profit pending.</p>
          {canRecur && <label><input type="checkbox" checked={recur} disabled={busy} onChange={e => setRecur(e.target.checked)} /> Principal will recur — start next month’s profit cycle at the configured rate</label>}
          {!recur && <p>No new recurring profit cycle will be created.</p>}
          {error && <p role="alert" className="form-error">{error}</p>}
        </>}
      </div>
      <div className="modal__footer">{done ? <button type="button" className="button button--primary" onClick={onClose}>Done</button> : <>
        <button type="button" className="button button--secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className="button button--primary" disabled={busy} onClick={() => void confirm()}>{busy ? 'Closing…' : 'Accept and close profit'}</button>
      </>}</div>
    </div>
  </div>;
}
