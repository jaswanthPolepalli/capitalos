import { EarningsSummary } from './EarningsSummary';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { AllocationSummary, ProfitRecord, CapitalReturn } from '../store';
import { formatDate } from '../lib/format';

export function CombinationHistoryModal({ entry, allocations, profits, returns, onClose, onRevert, revertReason }: {
  entry: AllocationSummary; allocations: AllocationSummary[]; profits: ProfitRecord[]; returns: CapitalReturn[];
  onClose: () => void; onRevert?: () => void; revertReason: string | null;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;
  const ids = new Set<string>();
  function collect(a: AllocationSummary) {
    for (const source of a.combination?.sources ?? []) {
      if (ids.has(source.id)) continue;
      ids.add(source.id);
      const original = allocations.find(row => row.id === source.id);
      if (original) collect(original);
    }
  }
  collect(entry);
  const originals = allocations.filter(a => ids.has(a.id)).sort((a, b) => a.receivedDate.localeCompare(b.receivedDate));
  const oldDue = originals.reduce((sum, a) => sum + a.profitPending, 0);
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={dialog} className="modal combination-history-modal" role="dialog" aria-modal="true" aria-labelledby="combination-history-title" onKeyDown={e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? [])];
        const first = controls[0]; const last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="modal__header"><h2 id="combination-history-title">Combined capital history</h2><button className="icon-button" aria-label="Close history" type="button" onClick={onClose}><X size={18} /></button></div>
      <div className="modal__body">
        <p><strong>{entry.partner?.name}</strong> · {money(entry.amountRupees)} · effective {formatDate(entry.receivedDate)}</p>
        <div className="form-hint"><strong>{oldDue > 0 ? `${money(oldDue)} original profit still due` : 'Original profits fully paid'}</strong><br />Profit on the combined capital is tracked separately from these original payments.</div>
        <p>Combined capital: first profit due <strong>{entry.firstProfitDueDate ? formatDate(entry.firstProfitDueDate) : '—'}</strong> · Expected monthly profit <strong>{money(entry.expectedMonthlyProfit)}</strong></p>
        <p>Combined-entry profit paid: <strong>{money(entry.totalProfitPaid)}</strong> · Currently due: <strong>{money(entry.profitPending)}</strong></p>
        <EarningsSummary allocations={[entry, ...originals]} regularProfit={entry.totalProfitPaid + originals.reduce((sum, a) => sum + a.totalProfitPaid, 0)} />
        {originals.map(a => {
          const events = [
            ...profits.filter(p => p.allocationId === a.id).map(p => ({ id: `profit-${p.id}`, date: p.paidDate, label: 'Profit paid', amount: p.amountRupees, notes: p.notes })),
            ...returns.filter(r => r.allocationId === a.id).map(r => ({ id: `return-${r.id}`, date: r.returnedDate, label: 'Capital returned', amount: r.amountRupees, notes: r.notes })),
          ].sort((x, y) => x.date.localeCompare(y.date));
          return <section className="combination-history-card" key={a.id}>
            <h3>{money(a.amountRupees)} given {formatDate(a.receivedDate)}</h3>
            <p>{a.profitPercent}% per month · {a.creditCard?.cardName ?? 'Cash'} · {a.returnDate ? `Return ${formatDate(a.returnDate)}` : 'No return date'}</p>
            <strong style={{ color: a.profitPending > 0 ? 'var(--pending)' : 'var(--incoming)' }}>{a.profitPending > 0 ? `${money(a.profitPending)} profit still due` : 'Profit paid in full'}</strong>
            {a.notes && <p>{a.notes}</p>}
            {events.length ? <ul>{events.map(event => <li key={event.id}><span>{event.label} · {formatDate(event.date)}</span><strong>{money(event.amount)}</strong>{event.notes && <small>{event.notes}</small>}</li>)}</ul> : <p>No payments recorded.</p>}
          </section>;
        })}
        <Link className="entity-link" to={`/partners/${entry.partnerId}`}>Full partner history</Link>
        {onRevert && revertReason && <p style={{ color: 'var(--muted)', fontSize: 12 }}>Revert unavailable: {revertReason}</p>}
      </div>
      <div className="modal__footer">{onRevert && <button className="button button--secondary" disabled={!!revertReason} type="button" onClick={onRevert}>Revert combination</button>}<button className="button button--primary" type="button" onClick={onClose}>Close</button></div>
    </div>
  </div>;
}
