import { useState } from 'react';
import { combineAllocations, type AllocationSummary } from '../store';
import { formatDate } from '../lib/format';
import { firstCombinedProfitDate } from '../../../functions/capitalos-api/combinations.mjs';

export function CombineCapitalModal({ entries, onClose }: { entries: AllocationSummary[]; onClose: () => void }) {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [rate, setRate] = useState(String(entries[0]?.profitPercent ?? 3));
  const [returnDate, setReturnDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const capital = entries.reduce((s, a) => s + a.capitalOutstanding, 0);
  const debt = entries.reduce((s, a) => s + a.profitPending, 0);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await combineAllocations({ allocationIds: entries.map(a => a.id), effectiveDate: date, profitPercent: Number(rate), returnDate: returnDate || null });
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to combine. Please try again.'); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="combine-title"><div className="modal">
    <div className="modal__header"><h2 id="combine-title">Combine selected capital</h2><button type="button" className="icon-button" aria-label="Close" onClick={onClose} disabled={saving}>×</button></div>
    <form className="modal__body" onSubmit={save}>
      <p>{entries[0]?.partner?.name} · {entries.length} contributions</p>
      {entries.map(a => <p key={a.id}>{money(a.capitalOutstanding)} remaining · given {formatDate(a.receivedDate)} · {a.profitPercent}%</p>)}
      <div className="form-hint">Combined capital: <strong>{money(capital)}</strong><br />Unpaid profit carried separately: <strong>{money(debt)}</strong></div>
      <p style={{ fontSize: 12 }}>The selected entries become history on the effective date. Original dates, rates, returns and profit payments remain available. Unpaid profit can still be paid against each original entry.</p>
      <div className="form-field"><label className="form-label" htmlFor="combine-date">Effective date</label><input id="combine-date" className="form-input" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="form-field"><label className="form-label" htmlFor="combine-rate">New monthly profit rate (%)</label><input id="combine-rate" className="form-input" type="number" required min="0" max="100" step="0.01" value={rate} onChange={e => setRate(e.target.value)} /></div>
      <div className="form-field"><label className="form-label" htmlFor="combine-return">New return date (optional)</label><input id="combine-return" className="form-input" type="date" min={date} value={returnDate} onChange={e => setReturnDate(e.target.value)} /></div>
      <p>New expected monthly profit: <strong>{money(Math.round(capital * Number(rate) / 100))}</strong></p>
      {date && <p>First profit due: <strong>{formatDate(firstCombinedProfitDate(date))}</strong> (on the effective date). Choose Principal will recur when recording profit to include it next month.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal__footer"><button className="button button--secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button><button className="button button--primary" disabled={saving} type="submit">{saving ? 'Combining…' : 'Confirm combination'}</button></div>
    </form>
  </div></div>;
}
