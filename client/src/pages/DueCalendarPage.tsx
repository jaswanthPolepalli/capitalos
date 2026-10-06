import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useRole } from '../context/RoleContext';
import { addDays, businessToday, isISODate } from '../lib/businessDates';
import { buildObligations } from '../lib/planning';
import { operationsRequest, useRemoteList, type ReminderEvent } from '../lib/operationsApi';
import { useStore } from '../useStore';

const money = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export function DueCalendarPage() {
  const { allocationSummaries, isLoaded } = useStore();
  const { isCFO } = useRole();
  const today = businessToday();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 30));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [includeEstimates, setIncludeEstimates] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState(addDays(today, 3));
  const [channel, setChannel] = useState('manual');
  const history = useRemoteList<ReminderEvent>('reminder-events');
  const obligations = useMemo(() => buildObligations(allocationSummaries, today, 90), [allocationSummaries, today]);
  const invalidRange = !isISODate(from) || !isISODate(to) || from > to;
  const visible = obligations.filter(o => !invalidRange && o.date >= from && o.date <= to && (includeEstimates || o.kind === 'principal') && o.partnerName.toLowerCase().includes(search.toLowerCase()));
  const batch = visible.filter(o => selected.includes(o.id));
  const latest = (id: string) => history.rows.find(e => e.obligationId === id);
  const monthStart = `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const dayCount = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
  const offset = new Date(`${monthStart}T00:00:00Z`).getUTCDay();
  async function record(action: ReminderEvent['action']) {
    if (busy || !batch.length || !isCFO) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (action === 'snoozed' && (!isISODate(followUp) || followUp < today)) throw new Error('Choose a follow-up date today or later.');
      if (action === 'prepared') {
        const text = batch.map(o => `${o.partnerName}: ${o.kind === 'principal' ? 'Principal return' : 'Estimated profit — please confirm the period and amount'} ${money(o.amountRupees)}, ${o.date}.`).join('\n');
        await navigator.clipboard.writeText(text);
      }
      const outcomes = await Promise.allSettled(batch.map(o => operationsRequest<ReminderEvent>('reminder-events', {
        obligationId: o.id, partnerId: o.partnerId, allocationId: o.allocationId, kind: o.kind,
        action, channel, amountRupees: o.amountRupees, dueDate: o.date,
        followUpDate: action === 'snoozed' ? followUp : '', notes,
      })));
      const succeeded = batch.filter((_, i) => outcomes[i]?.status === 'fulfilled').map(o => o.id);
      setSelected(prev => prev.filter(id => !succeeded.includes(id)));
      const failed = outcomes.length - succeeded.length;
      setMessage(`${succeeded.length} reminder event${succeeded.length === 1 ? '' : 's'} saved${action === 'prepared' ? '. Draft copied; no message was sent' : ''}.`);
      if (failed) setError(`${failed} event(s) could not be saved. They remain selected for review. ${outcomes.find(o => o.status === 'rejected')?.status === 'rejected' ? 'Check history before retrying if the connection was interrupted.' : ''}`);
      else setReview(false);
      await history.refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="list-page">
    <PageHeader title="Due calendar & reminders" description="Review upcoming principal returns, prepare reminder batches, and keep a shared follow-up history." actions={<Link className="button button--secondary" to="/liability-planning">Liability planning</Link>} />
    <p className="tools-hint">This calendar shows recorded principal dates for the next 90 days and overdue principal. Optional profit dates are planning estimates, not confirmed unpaid bills. Reminder actions record your work; they do not send messages automatically.</p>
    <section className="tools-panel">
      <div className="tools-controls"><label>Calendar month<input className="form-input" type="month" min={today.slice(0, 7)} max={addDays(today, 90).slice(0, 7)} value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }} /></label><label className="tools-check"><input type="checkbox" checked={includeEstimates} onChange={e => { setIncludeEstimates(e.target.checked); setReview(false); }} /> Include estimated profit</label></div>
      <div className="due-calendar" aria-label={`Due dates for ${month}`}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span className="calendar-day-name" key={day}>{day}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: dayCount }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const count = obligations.filter(o => o.date === date && (includeEstimates || o.kind === 'principal')).length;
          return <button type="button" key={date} className={`calendar-day${date === today ? ' calendar-day--today' : ''}`} aria-label={`${date}: ${count} obligations`} aria-pressed={from === date && to === date} onClick={() => { setFrom(date); setTo(date); setSelected([]); setReview(false); }}><strong>{i + 1}</strong>{count > 0 && <small>{count} due</small>}</button>;
        })}
      </div>
    </section>
    <div className="tools-controls">
      <label>From<input className="form-input" type="date" value={from} onChange={e => { setFrom(e.target.value); setReview(false); }} /></label>
      <label>Through<input className="form-input" type="date" value={to} onChange={e => { setTo(e.target.value); setReview(false); }} /></label>
      <label>Partner search<input className="form-input" value={search} onChange={e => { setSearch(e.target.value); setReview(false); }} /></label>
      {[7, 30, 90].map(days => <button className="button button--secondary" type="button" key={days} onClick={() => { setFrom(today); setTo(addDays(today, days)); setReview(false); }}>Next {days} days</button>)}
      <button className="button button--secondary" type="button" onClick={() => { setFrom('1900-01-01'); setTo(addDays(today, -1)); setReview(false); }}>Overdue principal</button>
    </div>
    {invalidRange && <p role="alert">Choose a valid date range.</p>}
    {!isLoaded && <p role="status">Loading obligations…</p>}
    {isCFO && <div className="tools-controls"><button type="button" className="button button--secondary" disabled={busy} onClick={() => setSelected(visible.map(o => o.id))}>Select visible</button><button type="button" className="button button--primary" disabled={!batch.length || busy} onClick={() => setReview(true)}>Review {batch.length} selected</button><button type="button" className="button button--secondary" disabled={busy} onClick={() => { setSelected([]); setReview(false); }}>Clear selection</button></div>}
    {visible.map(o => { const event = latest(o.id); return <article className="tools-record" key={o.id}>
      {isCFO && <input type="checkbox" disabled={busy} aria-label={`Select ${o.partnerName} ${o.kind} ${o.date}`} checked={selected.includes(o.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, o.id] : prev.filter(id => id !== o.id))} />}
      <div><Link to={`/partners/${o.partnerId}`}><strong>{o.partnerName}</strong></Link><p>{o.date} · {o.kind === 'principal' ? 'Principal' : 'Estimated profit'} · {o.cardName}</p>{event && <small>Last action: {event.action}{event.followUpDate ? ` · follow up ${event.followUpDate}` : ''}</small>}</div><strong>{money(o.amountRupees)}</strong>
    </article>; })}
    {isLoaded && !invalidRange && !visible.length && <p>No matching obligations. Undated capital is shown in Liability planning.</p>}
    {review && isCFO && <section className="tools-panel" aria-label="Review reminder batch"><h2>Review reminder batch</h2><ul>{batch.map(o => <li key={o.id}>{o.partnerName} · {o.date} · {o.kind} · {money(o.amountRupees)}</li>)}</ul>
      <div className="tools-controls"><label>Channel<select className="form-input" value={channel} disabled={busy} onChange={e => setChannel(e.target.value)}>{['manual', 'whatsapp', 'phone', 'email'].map(value => <option key={value}>{value}</option>)}</select></label><label>Follow-up date<input className="form-input" type="date" min={today} value={followUp} disabled={busy} onChange={e => setFollowUp(e.target.value)} /></label><label>Notes<textarea className="form-input" maxLength={2000} value={notes} disabled={busy} onChange={e => setNotes(e.target.value)} /></label></div>
      <p>“Confirm already sent” records your confirmation; it is not delivery confirmation from a messaging service.</p>
      <div className="tools-controls">{([['prepared', 'Copy reminder draft'], ['sent', 'Confirm already sent'], ['snoozed', 'Save follow-up'], ['note', 'Save note']] as const).map(([action, label]) => <button type="button" className="button button--secondary" key={action} disabled={busy || !batch.length} onClick={() => void record(action)}>{label}</button>)}</div>
    </section>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <section className="tools-panel"><h2>Reminder history</h2><button className="button button--secondary" type="button" disabled={history.loading} onClick={() => void history.refresh()}>Refresh history</button>
      {history.loading && <p role="status">Loading reminder history…</p>}{history.error && <p role="alert">{history.error}</p>}
      {!history.loading && !history.error && history.rows.length === 0 && <p>No reminder activity yet.</p>}
      {!history.loading && !history.error && history.rows.filter(e => !search || (allocationSummaries.find(a => a.partnerId === e.partnerId)?.partner?.name || e.partnerId).toLowerCase().includes(search.toLowerCase())).map(e => <details key={e.id} className="tools-history-row"><summary>{new Date(e.occurredAt).toLocaleString('en-IN')} · {allocationSummaries.find(a => a.partnerId === e.partnerId)?.partner?.name || e.partnerId} · {e.action}</summary><p>{e.kind} · {e.dueDate} · {money(e.amountRupees)} · {e.channel}</p>{e.followUpDate && <p>Follow up {e.followUpDate}</p>}<p>{e.notes || 'No notes'}</p></details>)}
    </section>
  </div>;
}
