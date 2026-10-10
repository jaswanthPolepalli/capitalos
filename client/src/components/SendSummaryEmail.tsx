import { useRef, useState } from 'react';
import { Download, Eye, Mail } from 'lucide-react';
import { useRole } from '../context/RoleContext';
import { operationsRequest } from '../lib/operationsApi';

export function SendSummaryEmail() {
  const { isCFO } = useRole();
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [showData, setShowData] = useState(false);
  if (!isCFO) return null;

  async function download() {
    if (inFlight.current) return;
    inFlight.current = true; setDownloading(true); setMessage(''); setError(false);
    try {
      const result = await operationsRequest<{ status: string; filename?: string; contentBase64?: string; summary?: any }>('daily-summary/download', {});
      if (result.status === 'mock') { setMessage('Local preview: PDF download is available with live data.'); return; }
      if (result.status !== 'ready' || !result.contentBase64 || !result.filename) throw new Error('Unable to generate the summary PDF.');
      if (result.summary) setSummary(result.summary);
      const bytes = Uint8Array.from(atob(result.contentBase64), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url; link.download = result.filename;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('PDF download started. No email was sent.');
    } catch (cause) {
      setError(true); setMessage(cause instanceof Error ? cause.message : 'Unable to download summary. Please retry.');
    } finally { inFlight.current = false; setDownloading(false); }
  }

  async function displayData() {
    if (inFlight.current) return;
    inFlight.current = true; setDownloading(true); setMessage(''); setError(false);
    try {
      const result = await operationsRequest<{ status: string; summary?: any }>('daily-summary/data');
      if (result.status === 'mock') { setMessage('Report data preview is available with live data.'); return; }
      if (result.status !== 'ready' || !result.summary) throw new Error('Unable to load report data.');
      setSummary(result.summary); setShowData(true);
    } catch (cause) {
      setError(true); setMessage(cause instanceof Error ? cause.message : 'Unable to load report data.');
    } finally { inFlight.current = false; setDownloading(false); }
  }

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
  return <section className="summary-email-panel" aria-label="Daily summary">
    <div><strong>Daily summary</strong><p>Download the card and cashback summary, or email it to jackgun9@gmail.com. Automatic send at 11:00 PM IST on days with transactions.</p></div>
    <button className="button button--secondary" type="button" onClick={() => void download()} disabled={busy || downloading}>
      <Download size={15} /> {downloading ? 'Preparing PDF…' : 'Download PDF'}
    </button>
    <button className="button button--secondary" type="button" onClick={() => showData ? setShowData(false) : void displayData()} disabled={busy || downloading}>
      <Eye size={15} /> {showData ? 'Hide report data' : 'Display report data'}
    </button>
    <button className="button button--secondary" type="button" onClick={() => void send()} disabled={busy || downloading || uncertain}>
      <Mail size={15} /> {busy ? 'Sending summary…' : 'Send summary email'}
    </button>
    {message && <p className={error ? 'form-error' : 'tools-hint'} role={error ? 'alert' : 'status'}>{message}</p>}
    {showData && summary && <div className="daily-summary-preview" aria-label="Daily summary data">
      <h3>Report data · {summary.date} · from 12:01 AM IST</h3>
      <p>Activity: {summary.activity.count} transactions · Capital added ₹{summary.activity.additions.toLocaleString('en-IN')} · Capital returned ₹{summary.activity.returns.toLocaleString('en-IN')} · Profits paid ₹{summary.activity.profits.toLocaleString('en-IN')} · Cashback paid ₹{summary.activity.cashback.toLocaleString('en-IN')}</p>
      <p>Current card usage ₹{summary.balances.cardCurrent.toLocaleString('en-IN')} · Cash outstanding ₹{summary.balances.cashCurrent.toLocaleString('en-IN')} · Total ₹{summary.balances.totalCurrent.toLocaleString('en-IN')}</p>
      <h4>Cash by partner and due date</h4>
      {summary.cashRows.length ? <ul>{summary.cashRows.map((row: any, i: number) => <li key={`${row.partnerId}-${row.dueDate || 'none'}-${i}`}>{row.partner} · {row.dueDate || 'No due date'} · ₹{row.amount.toLocaleString('en-IN')}</li>)}</ul> : <p>No cash outstanding.</p>}
      <h4>Card balances</h4>
      {summary.rows.length ? <ul>{summary.rows.map((row: any) => <li key={`${row.cardId}-${row.billed}`}>{row.partner} · {row.card} · ₹{row.amount.toLocaleString('en-IN')} · due {row.due.filter(Boolean).join(', ') || 'not generated'} · profit pending ₹{row.profit.toLocaleString('en-IN')}</li>)}</ul> : <p>No card balances.</p>}
    </div>}
  </section>;
}
