import { ProfitSplitPreview, profitPreview, profitOptions } from './ProfitSplitPreview';
import { combinedForPartner } from '../../../functions/capitalos-api/profit-sharing.mjs';
import { useRef, useState } from 'react';
import { CheckCircle2, MessageCircle, X } from 'lucide-react';
import { addPaymentGroup, getAllocations, getCapitalReturns, getProfitRecords, type AllocationSummary, type PaymentGroupInput, type PaymentGroupResult } from '../store';
import { preparePaymentGroup } from '../../../functions/capitalos-api/payment-groups.mjs';
import { businessToday } from '../lib/businessDates';
import { formatDate } from '../lib/format';
import { buildGroupedPaymentWhatsAppLink } from '../lib/whatsapp';
import { useStoreStatus } from '../useStoreStatus';
import { useRole } from '../context/RoleContext';

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
export const paymentEligible = (a: AllocationSummary, kind: 'profit' | 'capital') => kind === 'profit' ? a.profitPending > 0 : !a.combinationReserved && a.capitalOutstanding > 0;
const contributionLabel = (a: AllocationSummary) => `${fmt(a.amountRupees)} · ${a.creditCard?.cardName || 'Cash'} · ${formatDate(a.receivedDate)}`;
const label = (a: AllocationSummary) => `${contributionLabel(a)} · Entry ${a.id}`;

export function GroupedPaymentModal({ entries, kind, onClose }: {
  entries: AllocationSummary[]; kind: 'profit' | 'capital'; onClose: () => void;
}) {
  // Preserve the reviewed balances and labels as store notifications arrive.
  const [snapshot] = useState(entries);
  const [rows, setRows] = useState(() => entries.map(a => ({ customPercent: null as string | null, allocationId: a.id, amount: String(kind === 'profit' ? combinedForPartner(a.profitPending) : a.capitalOutstanding),
    expectedBalance: kind === 'profit' ? a.profitPending : a.capitalOutstanding, recur: kind === 'profit' && !a.combinationReserved && a.capitalOutstanding > 0 && a.isRecurring })));
  const [date, setDate] = useState(businessToday);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PaymentGroupResult | null>(null);
  const request = useRef<PaymentGroupInput | null>(null);
  const inFlight = useRef(false);
  const { isCFO } = useRole();
  const { hasData, status, isStale } = useStoreStatus();
  const ready = hasData && status === 'ready' && !isStale;
  const partner = snapshot[0]?.partner;
  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const locked = busy || request.current !== null;
  const title = kind === 'profit' ? 'Record selected profit payments' : 'Return selected capital';

  async function save() {
    if (inFlight.current || !isCFO) return;
    setError('');
    if (!request.current) {
      if (!ready) { setError('Refresh records successfully before saving.'); return; }
      const input: PaymentGroupInput = { groupId: crypto.randomUUID(), kind, partnerId: snapshot[0]?.partnerId || '', date, reference, notes,
        entries: rows.map(row => ({ allocationId: row.allocationId, amountRupees: Number(row.amount), ...(kind === 'profit' ? { ...profitOptions(row.customPercent) } : {}), expectedBalance: row.expectedBalance, recur: row.recur })) };
      try { preparePaymentGroup(input, getAllocations(), getCapitalReturns(), getProfitRecords(), businessToday()); }
      catch (e) { setError(e instanceof Error ? e.message : 'Review the selected entries.'); return; }
      request.current = input;
    }
    inFlight.current = true; setBusy(true);
    try { setResult(await addPaymentGroup(request.current)); }
    catch (e) {
      if ((e as { canEdit?: boolean }).canEdit) request.current = null;
      setError(e instanceof Error ? e.message : 'The save result could not be confirmed.');
    } finally { inFlight.current = false; setBusy(false); }
  }

  const saved = result?.results.filter(r => r.status === 'saved' && r.record) || [];
  const savedTotal = saved.reduce((sum, r) => sum + r.record!.amountRupees, 0);
  const shareLink = saved.length ? buildGroupedPaymentWhatsAppLink({ partnerName: partner?.name || 'Partner', partnerPhone: partner?.phone || null,
    kind, date, reference, entries: saved.map(item => {
      const a = snapshot.find(a => a.id === item.allocationId)!;
      const balance = rows.find(r => r.allocationId === item.allocationId)!.expectedBalance;
      return { label: contributionLabel(a), contributionAmountRupees: a.amountRupees, amountRupees: item.record!.amountRupees, remaining: balance - item.record!.amountRupees };
    }) }) : null;

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="group-payment-title">
    <div className="modal grouped-payment-modal">
      <div className="modal__header"><h2 id="group-payment-title">{result?.complete ? 'Payments recorded' : title}</h2>
        <button className="icon-button" type="button" aria-label="Close grouped payment" disabled={busy} onClick={onClose}><X size={18} /></button></div>
      <form className="modal__body" noValidate onSubmit={e => { e.preventDefault(); void save(); }}>
        <p><strong>{partner?.name}</strong> · {snapshot.length} entries · Total: <strong>{fmt(total)}</strong></p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!ready && !locked && <p role="status">Refresh records successfully before saving.</p>}
        {!result && <>
          <div className="form-row">
            <div className="form-field"><label className="form-label" htmlFor="group-date">Payment date</label><input id="group-date" className="form-input" type="date" max={businessToday()} value={date} disabled={locked} onChange={e => setDate(e.target.value)} /></div>
            <div className="form-field"><label className="form-label" htmlFor="group-reference">Reference / UTR</label><input id="group-reference" className="form-input" maxLength={200} value={reference} disabled={locked} onChange={e => setReference(e.target.value)} /></div>
          </div>
          <div className="group-payment-rows">{rows.map((row, index) => {
            const a = snapshot[index]!;
            const remaining = Math.max(0, row.expectedBalance - (kind === 'profit' ? profitPreview(Number(row.amount), a.amountRupees, row.customPercent).split?.amountRupees ?? 0 : Number(row.amount || 0)));
            return <div className="group-payment-row" key={a.id}>
              <p>{label(a)}</p>
              <label className="form-label" htmlFor={`group-amount-${a.id}`}>{kind === 'profit' ? 'Partner + CFO amount' : 'Capital returned'} — entry {a.id} (₹)</label>
              <input id={`group-amount-${a.id}`} className="form-input" type="number" min="1" step="1" max={kind === 'profit' ? combinedForPartner(row.expectedBalance) : row.expectedBalance} value={row.amount} disabled={locked}
                onChange={e => setRows(rows => rows.map(r => r.allocationId === a.id ? { ...r, amount: e.target.value } : r))} />
              {kind === 'profit' && <ProfitSplitPreview amount={Number(row.amount)} capital={a.amountRupees} customPercent={row.customPercent} disabled={locked} onPercentChange={value => setRows(rows => rows.map(r => r.allocationId === a.id ? { ...r, customPercent: value } : r))} />}
              <p className="form-hint">{kind === 'profit' ? 'Partner due' : 'Due'}: {fmt(row.expectedBalance)} · Remaining: {fmt(remaining)}{kind === 'profit' && remaining > 0 ? ' (partial payment)' : ''}</p>
              {kind === 'profit' && !a.combinationReserved && a.capitalOutstanding > 0 && <label className="checkbox-row"><input type="checkbox" checked={row.recur} disabled={locked} onChange={e => setRows(rows => rows.map(r => r.allocationId === a.id ? { ...r, recur: e.target.checked } : r))} />Principal will recur — entry {a.id}</label>}
            </div>;
          })}</div>
          <div className="form-field"><label className="form-label" htmlFor="group-notes">Notes</label><textarea id="group-notes" className="form-input" maxLength={1000} rows={2} value={notes} disabled={locked} onChange={e => setNotes(e.target.value)} /></div>
        </>}
        {result && <div aria-live="polite">
          <p><CheckCircle2 size={16} /> {saved.length} of {rows.length} entries recorded · {fmt(savedTotal)}</p>
          {!result.complete && <p role="alert">Some payments could not be confirmed. Refresh and inspect the payment history and Activity before recording them again.</p>}
          {result.email && <p role="status">{
            result.email.status === 'sent' ? `Email confirmation sent${result.email.recipient ? ` to ${result.email.recipient}` : ''}.`
            : result.email.status === 'no_email' ? 'Email not sent: this partner has no email address saved.'
            : result.email.status === 'mock' ? 'Email is disabled in local mock mode.'
            : result.email.status === 'incomplete' ? 'Email not sent because some payments need verification.'
            : 'Email could not be confirmed. Your recorded payments are saved. Check email history before sending another confirmation.'
          }</p>}
          <ul>{result.results.map(item => <li key={item.allocationId}>{label(snapshot.find(a => a.id === item.allocationId)!)} — {item.status === 'saved' ? 'Recorded' : item.status === 'not_attempted' ? 'Not attempted' : 'Needs verification'}</li>)}</ul>
          {shareLink && <><a className="button button--primary" href={shareLink} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} />Share {result.complete ? 'on WhatsApp' : 'recorded payments on WhatsApp'}</a><p className="form-hint">Opens one message with the recorded total and entry breakdown. You send it.</p></>}
        </div>}
        {request.current && !result && !busy && <p role="status">The save result is uncertain. Check save status to look up this same payment without creating another copy.</p>}
        <div className="modal__footer">
          <button type="button" className="button button--secondary" disabled={busy} onClick={onClose}>{result ? 'Done' : 'Close'}</button>
          {!result?.complete && <button type="submit" className="button button--primary" disabled={busy || !isCFO || (!request.current && !ready)}>{busy ? 'Saving…' : request.current ? 'Check save status' : `Record ${rows.length} payments · ${fmt(total)}`}</button>}
        </div>
      </form>
    </div>
  </div>;
}
