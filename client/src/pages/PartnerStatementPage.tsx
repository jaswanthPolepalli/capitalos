import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate } from '../lib/format';
import { downloadCSV } from '../lib/csv';
import { businessToday, financialYearRange, financialYearStart } from '../lib/businessDates';
import { buildStatement } from '../lib/statements';
import { useStore } from '../useStore';

const labels = { CAPITAL_RECEIVED: 'Capital received', CAPITAL_RETURNED: 'Capital returned', PROFIT_PAID: 'Profit paid', CASHBACK_PAID: 'Cashback sharing' };
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(value);

export function PartnerStatementPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { getPartner, ledger, isLoaded } = useStore();
  const today = businessToday();
  const [year, setYear] = useState(financialYearStart(today));
  const [range, setRange] = useState(() => ({ from: financialYearRange(financialYearStart(today)).from, to: today }));
  const partner = getPartner(id);
  const result = useMemo(() => {
    try { return { statement: buildStatement(ledger, id, range.from, range.to), error: '' }; }
    catch (error) { return { statement: null, error: (error as Error).message }; }
  }, [ledger, id, range]);
  const statement = result.statement;
  if (!isLoaded && !partner) return <p role="status">Loading statement…</p>;
  if (!partner) return <div className="list-page"><h1>Partner not found</h1><Link to="/partners">Back to partners</Link></div>;

  function exportCSV() {
    if (!statement) return;
    downloadCSV(`CapitalOS-statement-${id}-${range.from}-${range.to}.csv`, ['Date', 'Transaction', 'Capital received (INR)', 'Capital returned (INR)', 'Profit paid (INR)', 'Cashback shared (INR)', 'Principal balance (INR)', 'Notes'], [
      [range.from, 'Opening principal', '', '', '', '', statement.openingPrincipal, 'Before start date'],
      ...statement.rows.map(e => [e.date, labels[e.eventType], e.eventType === 'CAPITAL_RECEIVED' ? e.amountRupees : '', e.eventType === 'CAPITAL_RETURNED' ? e.amountRupees : '', e.eventType === 'PROFIT_PAID' ? e.amountRupees : '', e.eventType === 'CASHBACK_PAID' ? e.amountUnknown ? 'Amount not recorded' : e.amountRupees : '', e.runningBalance, e.notes]),
      [range.to, 'Closing principal', '', '', '', '', statement.closingPrincipal, 'Through end date'],
    ]);
  }
  return <div className="statement-page">
    <div className="statement-actions no-print">
      <Link className="button button--secondary" to={`/partners/${id}`}><ArrowLeft size={15} /> Back to partner</Link>
      <button type="button" className="button button--secondary" disabled={!statement} onClick={exportCSV}><Download size={15} /> Export CSV</button>
      <button type="button" className="button button--primary" disabled={!statement} onClick={() => window.print()}><Printer size={15} /> Print / Save as PDF</button>
    </div>
    <section className="tools-panel no-print" aria-label="Statement period">
      <div className="tools-controls">
        <label>From<input className="form-input" type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} /></label>
        <label>Through<input className="form-input" type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} /></label>
        <label>Financial year starts<select className="form-input" value={year} onChange={e => setYear(Number(e.target.value))}>
          {Array.from({ length: 15 }, (_, i) => financialYearStart(today) - i).map(y => <option key={y} value={y}>{y}–{y + 1}</option>)}
        </select></label>
        <button className="button button--secondary" type="button" onClick={() => setRange(financialYearRange(year))}>Apply Apr–Mar year</button>
        <button className="button button--secondary" type="button" onClick={() => setRange({ from: ledger.filter(e => e.partnerId === id).reduce((min, e) => e.date < min ? e.date : min, today), to: today })}>All recorded history</button>
      </div>
      {result.error && <p className="form-error" role="alert">{result.error}</p>}
    </section>
    {statement && <article className="statement-document">
      <header className="statement-header">
        <div><h1 className="statement-header__title">CapitalOS</h1><p>Capital account statement</p><h2>{partner.name}</h2>
          <p>{[partner.phone, partner.email].filter(Boolean).join(' · ')}</p></div>
        <div className="statement-header__meta"><p><strong>Period:</strong> {formatDate(range.from)} – {formatDate(range.to)}</p><p>Generated {formatDate(today)} · INR</p></div>
      </header>
      <div className="statement-summary-grid">
        {[
          ['Opening principal', statement.openingPrincipal], ['Capital received', statement.received], ['Capital returned', statement.returned],
          ['Closing principal', statement.closingPrincipal], ['Profit paid in period', statement.profitPaid], ['Cashback shared in period', statement.cashbackPaid], ['Total profits received', statement.totalProfitsReceived],
        ].map(([label, value]) => <div className="statement-summary-card" key={String(label)}><span className="statement-summary-card__label">{label}</span><strong className="statement-summary-card__value">{money(Number(value))}</strong></div>)}
      </div>
      <p className="tools-hint">Opening principal is the balance before {formatDate(range.from)}. Profit and cashback payments are shown separately and do not reduce principal. Combined capital is not counted as a new contribution.</p>
      {statement.unknownCashbackCount > 0 && <p>{statement.unknownCashbackCount} cashback amount(s) not recorded. Totals include known amounts only.</p>}
      <h2 className="statement-section__title">Transactions and running principal balance</h2>
      <table className="statement-table adaptive-table" aria-label="Statement transactions">
        <thead><tr><th>Date</th><th>Transaction</th><th>Received</th><th>Returned</th><th>Profit paid</th><th>Cashback shared</th><th>Principal balance</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td data-label="Date">{formatDate(range.from)}</td><td data-label="Transaction">Opening balance</td><td data-label="Received">—</td><td data-label="Returned">—</td><td data-label="Profit paid">—</td><td data-label="Cashback shared">—</td><td data-label="Principal balance">{money(statement.openingPrincipal)}</td><td data-label="Notes">Before period</td></tr>
          {statement.rows.map(e => <tr key={e.id}>
            <td data-label="Date">{formatDate(e.date)}</td><td data-label="Transaction">{labels[e.eventType]}</td>
            <td data-label="Received">{e.eventType === 'CAPITAL_RECEIVED' ? money(e.amountRupees) : '—'}</td>
            <td data-label="Returned">{e.eventType === 'CAPITAL_RETURNED' ? money(e.amountRupees) : '—'}</td>
            <td data-label="Profit paid">{e.eventType === 'PROFIT_PAID' ? money(e.amountRupees) : '—'}</td>
            <td data-label="Cashback shared">{e.eventType === 'CASHBACK_PAID' ? e.amountUnknown ? 'Amount not recorded' : money(e.amountRupees) : '—'}</td>
            <td data-label="Principal balance"><strong>{money(e.runningBalance)}</strong></td><td data-label="Notes">{e.notes.replace(/\s*WA_CONFIRMED\s*/g, '').trim() || '—'}</td>
          </tr>)}
          <tr><td data-label="Date">{formatDate(range.to)}</td><td data-label="Transaction">Closing balance</td><td data-label="Received">{money(statement.received)}</td><td data-label="Returned">{money(statement.returned)}</td><td data-label="Profit paid">{money(statement.profitPaid)}</td><td data-label="Cashback shared">{money(statement.cashbackPaid)}</td><td data-label="Principal balance"><strong>{money(statement.closingPrincipal)}</strong></td><td data-label="Notes">Through period end</td></tr>
        </tbody>
      </table>
      {!statement.rows.length && <p>No transactions in this period. Opening and closing balances are shown above.</p>}
      <footer className="statement-footer"><p>Based on current recorded transactions through the selected end date. Later corrections can change a regenerated statement; save the PDF to retain this version.</p><p>All amounts are in Indian rupees. This statement does not estimate unpaid historical profit.</p></footer>
    </article>}
  </div>;
}
