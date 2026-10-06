import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cashbackStatus, cashbackTotals } from '../../../functions/capitalos-api/cashback.mjs';
import type { AllocationSummary } from '../store';
import { formatDate } from '../lib/format';
import { CashbackModal } from './CashbackModal';
import { RecordRow } from './RecordRow';

export const cashbackLabels = { review: 'Needs review', unpaid: 'Cashback pending', paid: 'Cashback paid', not_applicable: 'Not applicable' };
export function CashbackList({ entries, canEdit }: { entries: AllocationSummary[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<AllocationSummary | null>(null);
  const [limit, setLimit] = useState(20);
  const entryIds = entries.map(a => a.id).join(',');
  useEffect(() => setLimit(20), [entryIds]);
  const totals = cashbackTotals(entries);
  return <section className="cashback-section" aria-label="Cashback sharing">
    <div className="cashback-list-heading"><h2>Cashback sharing <small>({entries.length})</small></h2><span>Cashback paid: <strong>₹{totals.totalCashbackPaid.toLocaleString('en-IN')}</strong></span></div>
    <p className="cashback-list-hint">Pending and unreviewed entries stay visible across months, even after capital return.</p>
    {totals.unknownCashbackCount > 0 && <p className="cashback-list-hint">{totals.unknownCashbackCount} paid cashback amount(s) not recorded; excluded from totals.</p>}
    <div className="table-wrapper"><table className="data-table cashback-table" aria-label="Cashback transactions">
      <thead><tr><th className="table-th">Partner / card</th><th className="table-th">Received</th><th className="table-th table-th--money">Capital</th><th className="table-th">Cashback status</th><th className="table-th table-th--money">Cashback paid</th><th className="table-th">Paid on</th><th className="table-th">Actions</th></tr></thead>
      <tbody>{entries.slice(0, limit).map(a => {
        const status = cashbackStatus(a), payment = a.cashback;
        return <RecordRow key={a.id}>
          <td className="table-cell" data-label="Partner / card"><Link className="entity-link" to={`/partners/${a.partnerId}`}>{a.partner?.name || a.partnerId}</Link><small className="cashback-source">{a.creditCard?.cardName || 'Card'}</small></td>
          <td className="table-cell" data-label="Received">{formatDate(a.receivedDate)}</td>
          <td className="table-cell table-cell--money" data-label="Capital">₹{a.amountRupees.toLocaleString('en-IN')}</td>
          <td className="table-cell" data-label="Cashback status"><span className={`cashback-badge cashback-badge--${status}`}>{cashbackLabels[status]}</span>
            {a.profitPending > 0 && <small className="cashback-source">Profit pending: ₹{a.profitPending.toLocaleString('en-IN')}</small>}
            {a.isFullyReturned && <small className="cashback-source">Capital fully returned</small>}
            {a.combinationReserved && <small className="cashback-source">Capital moved to combined entry</small>}
          </td>
          <td className="table-cell table-cell--money" data-label="Amount shared">{payment?.status === 'paid' ? payment.amountRupees == null ? 'Amount not recorded' : `₹${payment.amountRupees.toLocaleString('en-IN')}` : '—'}</td>
          <td className="table-cell" data-label="Paid on">{payment?.status === 'paid' ? formatDate(payment.paidDate) : '—'}</td>
          <td className="table-cell table-cell--action" data-label="Actions"><div className="cashback-list-actions">
            {canEdit && <button className="button button--secondary" type="button" onClick={() => setEditing(a)}>{status === 'paid' ? 'Edit cashback' : status === 'review' ? 'Review cashback' : 'Manage cashback'}</button>}
            {payment?.status === 'paid' && <Link className="button button--secondary" to={`/ledger?highlight=l-cb-${a.id}`}>Ledger</Link>}
          </div></td>
        </RecordRow>;
      })}</tbody>
    </table></div>
    {entries.length === 0 && <p>No cashback entries match these filters.</p>}
    {entries.length > limit && <button className="button button--secondary" onClick={() => setLimit(n => n + 20)}>Show more cashback entries</button>}
    {editing && <CashbackModal allocation={editing} onClose={() => setEditing(null)} />}
  </section>;
}
