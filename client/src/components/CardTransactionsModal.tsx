import { useState } from 'react';
import { X } from 'lucide-react';
import type { CapitalAllocation, CreditCard, LedgerEvent, LedgerEventType } from '../store';
import { formatDate } from '../lib/format';
import './card-transactions.css';

const labels: Record<LedgerEventType, string> = {
  CAPITAL_RECEIVED: 'Capital received',
  CAPITAL_RETURNED: 'Capital returned',
  PROFIT_PAID: 'Profit paid',
  CASHBACK_PAID: 'Cashback sharing',
};
const money = (value: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(value);

export function CardTransactionsModal({ card, partnerName, allocations, ledger, onClose }: {
  card: CreditCard;
  partnerName: string;
  allocations: CapitalAllocation[];
  ledger: LedgerEvent[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const linked = new Map(allocations.filter(a => a.creditCardId === card.id).map(a => [a.id, a]));
  const transactions = ledger.filter(event => linked.has(event.allocationId)).sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) ||
    b.refId.localeCompare(a.refId, undefined, { numeric: true }) || b.id.localeCompare(a.id));
  const invalidRange = Boolean(from && to && from > to);
  const query = search.trim().toLowerCase();
  const filtered = transactions.filter(event => !invalidRange &&
    (type === 'ALL' || event.eventType === type) && (!from || event.date >= from) && (!to || event.date <= to) &&
    (!query || [event.notes, event.refId, event.allocationId, labels[event.eventType],
      event.amountUnknown ? 'Amount not recorded' : String(event.amountRupees), linked.get(event.allocationId)?.notes ?? '']
      .some(value => value.toLowerCase().includes(query))));
  const hasFilters = Boolean(search || type !== 'ALL' || from || to);

  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="card-transactions-title"
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal card-transactions-modal">
      <div className="modal__header">
        <div><h2 id="card-transactions-title">{card.cardName} transactions</h2><p className="card-transactions-partner">{partnerName}</p></div>
        <button className="icon-button" type="button" aria-label="Close card transactions" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="modal__body">
        <p className="card-transactions-caption">All recorded activity linked to this card · Newest transaction date first</p>
        <div className="card-transactions-filters">
          <div className="form-field card-transactions-search">
            <label className="form-label" htmlFor="card-transaction-search">Search transactions</label>
            <input id="card-transaction-search" className="form-input" type="search" placeholder="Notes, reference, amount…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="card-transaction-type">Transaction type</label>
            <select id="card-transaction-type" className="form-input" value={type} onChange={e => setType(e.target.value)}>
              <option value="ALL">All types</option>
              {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="form-field"><label className="form-label" htmlFor="card-transaction-from">From date</label>
            <input id="card-transaction-from" className="form-input" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></div>
          <div className="form-field"><label className="form-label" htmlFor="card-transaction-to">To date</label>
            <input id="card-transaction-to" className="form-input" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></div>
        </div>
        {invalidRange && <p className="form-error" role="alert">From date must be on or before To date.</p>}
        <div className="card-transactions-count">
          <span role="status">{filtered.length} of {transactions.length} transactions</span>
          {hasFilters && <button className="button button--secondary" type="button" onClick={() => { setSearch(''); setType('ALL'); setFrom(''); setTo(''); }}>Clear transaction filters</button>}
        </div>
        {filtered.length === 0 ? <div className="table-empty">
          <h3>{transactions.length ? 'No matching transactions' : 'No transactions yet'}</h3>
          <p>{transactions.length ? 'Adjust or clear the filters to see more transactions.' : 'Recorded contributions and payments linked to this card will appear here.'}</p>
        </div> : <div className="card-transactions-table-scroll" tabIndex={0} role="region" aria-label="Transaction list">
          <table className="card-transactions-table" aria-label="Card transactions, newest first">
            <thead><tr>
              <th scope="col">Date</th>
              <th scope="col">Transaction type</th>
              <th scope="col" className="card-transaction-amount">Amount</th>
              <th scope="col">Notes</th>
              <th scope="col" title="Monthly profit rate">%</th>
            </tr></thead>
            <tbody>{filtered.map(event => <tr key={event.id}>
              <td className="card-transaction-date"><time dateTime={event.date}>{formatDate(event.date)}</time></td>
              <td>{labels[event.eventType]}</td>
              <td className="card-transaction-amount" style={{ color: event.eventType === 'CAPITAL_RECEIVED' ? 'var(--incoming)' : 'var(--outgoing)' }}>
                {event.amountUnknown ? 'Amount not recorded' : `${event.eventType === 'CAPITAL_RECEIVED' ? '+' : '−'}${money(event.amountRupees)}`}
              </td>
              <td className="card-transaction-notes">{event.notes || '—'}</td>
              <td className="card-transaction-rate" title="Monthly profit rate">{linked.get(event.allocationId)!.profitPercent}%</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div>
      <div className="modal__footer"><button className="button button--secondary" type="button" onClick={onClose}>Close</button></div>
    </div>
  </div>;
}
