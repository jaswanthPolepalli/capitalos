import type { ProfitRecord } from '../store';
import { useState } from 'react';
import { X } from 'lucide-react';
import { DataStatus } from '../components/DataStatus';
import { useStore } from '../useStore';
import { formatDate } from '../lib/format';
import './cfo-share.css';

const fmt = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export function CFOSharePage() {
  const { profitRecords, partners, allocations, allocationSummaries } = useStore();
  const cashbackRecords: ProfitRecord[] = allocations.flatMap(a => {
    const p = a.cashback;
    return p?.status === 'paid' && p.amountRupees != null && p.combinedAmountRupees != null
      ? [{ ...p, id: `cashback-${a.id}`, allocationId: a.id, partnerId: a.partnerId, amountRupees: p.amountRupees, notes: p.notes || '' }] : [];
  });
  const allRecords = [...profitRecords, ...cashbackRecords];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = allRecords.find(r => r.id === selectedId);
  const contribution = selected ? allocationSummaries.find(a => a.id === selected.allocationId) : undefined;
  const selectedCapital = selected?.profitCapitalRupees ?? contribution?.amountRupees;
  const percent = (amount: number, capital: number | undefined) => capital && capital > 0 ? `${Number((amount / capital * 100).toFixed(4))}%` : '—';
  const [month, setMonth] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate);
  const records = allRecords.filter(p => p.combinedAmountRupees !== undefined
    && (p.cfoShareRupees ?? 0) > 0
    && (!month || p.paidDate.startsWith(month))
    && (!fromDate || p.paidDate >= fromDate)
    && (!toDate || p.paidDate <= toDate)
    && (!partnerId || p.partnerId === partnerId))
    .sort((a, b) => b.paidDate.localeCompare(a.paidDate) || b.id.localeCompare(a.id, undefined, { numeric: true }));
  const total = records.reduce((sum, r) => sum + (r.cfoShareRupees ?? 0), 0);

  return <div className="list-page cfo-share-page">
    <h1 className="cfo-share-page__heading">CFO Share</h1>
    <DataStatus>
      <div className="cfo-share-page__total"><span>Total amount</span><strong>{fmt(total)}</strong></div>
      <div className="cfo-share-page__filters" role="group" aria-label="Transaction filters">
        <div className="form-field"><label htmlFor="cfo-month" className="form-label">Payment month</label><input id="cfo-month" className="form-input" type="month" value={month} onChange={e => setMonth(e.target.value)} /></div>
        <div className="form-field"><label htmlFor="cfo-from" className="form-label">From date</label><input id="cfo-from" className="form-input" type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} /></div>
        <div className="form-field"><label htmlFor="cfo-to" className="form-label">To date</label><input id="cfo-to" className="form-input" type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} /></div>
        <div className="form-field"><label htmlFor="cfo-partner" className="form-label">Partner</label><select id="cfo-partner" className="form-input" value={partnerId} onChange={e => setPartnerId(e.target.value)}><option value="">All partners</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <button type="button" className="button button--secondary" onClick={() => { setMonth(''); setFromDate(''); setToDate(''); setPartnerId(''); }}>Clear filters</button>
      </div>
      {invalidRange && <p className="form-error" role="alert">From date must be on or before To date.</p>}
      <div className="table-wrapper cfo-share-page__transactions">
        <table className="data-table" aria-label="CFO share transactions">
          <thead><tr><th className="table-th">Date</th><th className="table-th">Partner</th><th className="table-th">Amount</th><th className="table-th">CFO share</th><th className="table-th" title="CFO share divided by invested capital">CFO %</th></tr></thead>
          <tbody>{records.map(r => {
            const capital = r.profitCapitalRupees ?? allocations.find(a => a.id === r.allocationId)?.amountRupees;
            const cfoShare = r.cfoShareRupees ?? 0;
            return <tr key={r.id} className="table-row cfo-share-page__row" onClick={() => setSelectedId(r.id)}>
              <td className="table-cell">{formatDate(r.paidDate)}{r.id.startsWith('cashback-') && <small className="cashback-source">Cashback</small>}</td>
              <td className="table-cell"><button type="button" className="cfo-share-page__record" aria-label={`View transaction for ${partners.find(p => p.id === r.partnerId)?.name || 'Partner'} on ${formatDate(r.paidDate)}`} onClick={e => { e.stopPropagation(); setSelectedId(r.id); }}>{partners.find(p => p.id === r.partnerId)?.name || 'Partner'}</button></td>
              <td className="table-cell">{capital === undefined ? '—' : fmt(capital)}</td>
              <td className="table-cell"><strong>{fmt(cfoShare)}</strong></td>
              <td className="table-cell">{capital && capital > 0 ? `${Number((cfoShare / capital * 100).toFixed(4))}%` : '—'}</td>
            </tr>;
          })}
          {!records.length && <tr><td className="table-cell" colSpan={5}>No transactions for this selection.</td></tr>}</tbody>
        </table>
      </div>
      {selected && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cfo-transaction-title" onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}>
        <div className="modal cfo-share-details">
          <div className="modal__header"><h2 id="cfo-transaction-title">Transaction details</h2><button type="button" className="icon-button" aria-label="Close transaction details" onClick={() => setSelectedId(null)}><X size={18} /></button></div>
          <div className="modal__body">
            <p className="cfo-share-details__partner">{partners.find(p => p.id === selected.partnerId)?.name || 'Partner'}</p>
            <dl className="cfo-share-details__grid">
              <div><dt>{selected.id.startsWith('cashback-') ? 'Cashback payment date' : 'Profit payment date'}</dt><dd>{formatDate(selected.paidDate)}</dd></div>
              <div><dt>Given date</dt><dd>{contribution?.receivedDate ? formatDate(contribution.receivedDate) : '—'}</dd></div>
              <div><dt>Return date</dt><dd>{contribution?.returnDate ? formatDate(contribution.returnDate) : 'Not set'}</dd></div>
              <div><dt>Funding source</dt><dd>{contribution ? contribution.creditCard?.cardName || (contribution.creditCardId ? 'Credit card' : 'Cash') : '—'}</dd></div>
              <div><dt>Invested amount</dt><dd>{contribution ? fmt(contribution.amountRupees) : '—'}</dd></div>
              <div><dt>Outstanding capital (current)</dt><dd>{contribution ? fmt(contribution.capitalOutstanding) : '—'}</dd></div>
              <div><dt>Capital returned (current)</dt><dd>{contribution ? fmt(contribution.totalCapitalReturned) : '—'}</dd></div>
              <div><dt>Contribution profit rate</dt><dd>{contribution ? `${contribution.profitPercent}%` : '—'}</dd></div>
              <div><dt>Entered amount</dt><dd>{fmt(selected.combinedAmountRupees ?? selected.amountRupees)}</dd></div>
              <div><dt>Split</dt><dd>{selected.noCfoSplit ? 'No CFO split' : selected.partnerAmountRupees !== undefined ? 'Direct partner amount' : selected.partnerProfitPercent !== undefined ? 'Adjusted partner rate' : 'Standard split'}</dd></div>
              <div><dt>Partner share</dt><dd>{fmt(selected.amountRupees)}</dd></div>
              <div><dt>Partner profit %</dt><dd>{percent(selected.amountRupees, selectedCapital)}</dd></div>
              <div><dt>CFO share</dt><dd>{fmt(selected.cfoShareRupees ?? 0)}</dd></div>
              <div><dt>CFO %</dt><dd>{percent(selected.cfoShareRupees ?? 0, selectedCapital)}</dd></div>
              <div><dt>Capital used for profit %</dt><dd>{selectedCapital === undefined ? '—' : fmt(selectedCapital)}</dd></div>
              {selected.partnerProfitPercent !== undefined && <div><dt>Requested partner rate</dt><dd>{selected.partnerProfitPercent}%</dd></div>}
              <div className="cfo-share-details__notes"><dt>Notes</dt><dd>{selected.notes || 'No notes'}</dd></div>
            </dl>
          </div>
          <div className="modal__footer"><button type="button" className="button button--secondary" onClick={() => setSelectedId(null)}>Close</button></div>
        </div>
      </div>}
    </DataStatus>
  </div>;
}
