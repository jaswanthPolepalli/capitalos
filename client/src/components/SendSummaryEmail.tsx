import { useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { useRole } from '../context/RoleContext';
import { operationsRequest } from '../lib/operationsApi';

export function SendSummaryEmail() {
  const { isCFO } = useRole();
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(false);
  if (!isCFO) return null;

  async function send() {
    if (inFlight.current || uncertain) return;
    inFlight.current = true; setBusy(true); setMessage(''); setError(false);
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await operationsRequest<{ status: string }>('daily-summary/send', { requestId: requestId.current });
      if (result.status === 'sent') {
        setMessage('Summary email sent to jackgun9@gmail.com.');
        requestId.current = null;
      } else if (result.status === 'mock') {
        setMessage('Local preview: no email was sent.'); requestId.current = null;
      } else {
        setUncertain(true); setError(true);
        setMessage('Delivery could not be confirmed. Check the inbox and Activity before sending again.');
      }
    } catch (cause) {
      setError(true);
      setMessage(`${cause instanceof Error ? cause.message : 'Unable to send summary.'} Retry uses the same request to avoid duplicate email.`);
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="summary-email-panel" aria-label="Daily summary email">
    <div><strong>Daily summary email</strong><p>Complete card and cashback position to jackgun9@gmail.com. Automatic send at 11:00 PM IST on days with transactions.</p></div>
    <button className="button button--secondary" type="button" onClick={() => void send()} disabled={busy || uncertain}>
      <Mail size={15} /> {busy ? 'Sending summary…' : 'Send summary email'}
    </button>
    {message && <p className={error ? 'form-error' : 'tools-hint'} role={error ? 'alert' : 'status'}>{message}</p>}
  </section>;
}
