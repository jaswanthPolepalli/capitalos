import { useRef, useState } from 'react';
import { closeProfit } from '../store';

export function CloseProfitPanel({ allocationId, partnerId, pendingAmount, partnerName, canRecur, embedded = false, onCancel, onClose }: {
  allocationId: string; partnerId: string; pendingAmount: number; partnerName?: string | undefined; canRecur: boolean; embedded?: boolean; onCancel: () => void; onClose: () => void;
}) {
  const [recur, setRecur] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(pendingAmount);
  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      await closeProfit({ allocationId, partnerId, expectedPending: pendingAmount, confirmed: true, recur });
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to close profit. Please refresh and try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className={embedded ? 'overview-payment' : 'modal-backdrop'} role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby="close-profit-title">
    <div className="modal">
      <div className="modal__header"><h2 id="close-profit-title">Close profit without payment</h2></div>
      <div className="modal__body">
        {done ? <p role="status">Profit closed. No money was recorded as paid.</p> : <>
          <p role="alert"><strong>Warning:</strong> This will waive the remaining <strong>{amount}</strong> profit for {partnerName ?? 'this partner'} and remove it from pending. No money will be recorded as paid, no payment email will be sent, and principal remains unchanged.</p>
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
