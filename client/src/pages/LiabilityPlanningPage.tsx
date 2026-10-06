import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { businessToday } from '../lib/businessDates';
import { planningSummary } from '../lib/planning';
import { downloadCSV } from '../lib/csv';
import { useStore } from '../useStore';

const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
export function LiabilityPlanningPage() {
  const { allocationSummaries, isLoaded } = useStore();
  const today = businessToday();
  const plan = planningSummary(allocationSummaries, today);
  return <div className="list-page">
    <PageHeader title="Liability planning" description={`Upcoming commitments and current capital concentration · ${today}`} actions={<Link className="button button--secondary" to="/due-calendar">Due calendar</Link>} />
    <p className="tools-hint">Principal uses recorded return dates and outstanding balances. Future profit is an estimate at the current monthly rate, without compounding or proration, stopping at the recorded return date. Ordinary contributions use monthly anniversaries; combinations use their first profit date. Estimates may include a period already paid.</p>
    {!isLoaded && <p role="status">Loading recorded balances…</p>}
    <div className="tools-grid">{plan.horizons.map(h => <section className="tools-panel" key={h.days}>
      <h2>Next {h.days} days</h2><p>Today through {h.through}</p><dl className="tools-metrics"><div><dt>Principal due</dt><dd>{money(h.principal)}</dd></div><div><dt>Estimated profit</dt><dd>{money(h.profitEstimate)}</dd></div><div><dt>Planning total</dt><dd>{money(h.principal + h.profitEstimate)}</dd></div></dl>
    </section>)}</div>
    <p className="tools-hint">Windows are cumulative, not additive. Overdue principal and undated capital are excluded from the future totals.</p>
    <div className="tools-grid"><section className="tools-panel"><h2>Overdue principal</h2><strong>{money(plan.overdue)}</strong><p>Past its recorded return date.</p></section><section className="tools-panel"><h2>No return date</h2><strong>{money(plan.undated)}</strong><p>Set dates to include this capital in planning.</p></section><section className="tools-panel"><h2>Reported pending profit</h2><strong>{money(plan.reportedPendingProfit)}</strong><p>Shown separately; the existing records do not identify every unsettled historical period.</p></section></div>
    <div className="tools-grid">{[['Partner concentration', plan.partners], ['Funding-source concentration', plan.cards]].map(([title, groups]) => <section className="tools-panel" key={String(title)}><h2>{String(title)}</h2><p>Share of {money(plan.total)} outstanding capital today</p>
      {(groups as typeof plan.partners).map(group => <div className="concentration-row" key={group.id}><div><strong>{group.label}</strong><span>{money(group.amount)} · {group.share.toFixed(1)}%</span></div><meter min={0} max={100} value={group.share} aria-label={`${group.label} share of capital`} /></div>)}
      {!(groups as typeof plan.partners).length && <p>No outstanding capital.</p>}
    </section>)}</div>
    <button className="button button--secondary" type="button" disabled={!isLoaded} onClick={() => downloadCSV(`liability-plan-${today}.csv`, ['Due date', 'Partner', 'Type', 'Funding source', 'Amount INR'], plan.obligations.map(o => [o.date, o.partnerName, o.kind === 'principal' ? 'Principal' : 'Profit estimate', o.cardName, o.amountRupees]))}>Export planning detail</button>
  </div>;
}
