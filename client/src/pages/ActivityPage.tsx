import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useRemoteList, type ActivityEvent } from '../lib/operationsApi';
import { activityDetails, fieldLabels } from '../lib/activity';
import { formatDate } from '../lib/format';
import { useStore } from '../useStore';

export function ActivityPage() {
  const { rows, loading, error, refresh } = useRemoteList<ActivityEvent>('activity');
  const { partners, creditCards } = useStore();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const money = (value: unknown) => typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : String(value);
  function value(key: string, input: unknown): string {
    if (key === 'creditCardId' && (input === null || input === '')) return 'Cash / bank';
    if (input === undefined || input === null || input === '') return '—';
    if (key === 'amountRupees' || key === 'cashbackAmount') return typeof input === 'string' && input === 'Amount not recorded' ? input : money(Number(input));
    if (key === 'cashbackStatus') return ({ paid: 'Paid to partner', unpaid: 'Not paid', review: 'Needs review', not_applicable: 'Not applicable' } as Record<string, string>)[String(input)] || String(input);
    if (key === 'profitPercent') return `${input}%`;
    if (key.endsWith('Date')) return formatDate(String(input));
    if (key === 'partnerId') return partners.find(p => p.id === String(input))?.name || `Partner ${input}`;
    if (key === 'creditCardId') return creditCards.find(c => c.id === String(input))?.cardName || `Card ${input}`;
    if (typeof input === 'object') return Object.entries(input).filter(([k]) => !['updatedAt', 'createdAt'].includes(k)).map(([k, v]) => `${fieldLabels[k] || k.replace(/_/g, ' ')}: ${value(k, v)}`).join(' · ');
    return String(input);
  }
  const events = useMemo(() => {
    const groups = new Map<string, ActivityEvent[]>();
    for (const event of rows) groups.set(event.operationId, [...(groups.get(event.operationId) || []), event]);
    return [...groups.values()].map(group => group.find(e => e.status === 'committed') || group.find(e => e.status === 'unconfirmed') || group[0]!)
      .map(event => ({ event, details: activityDetails(event) }))
      .filter(({ details }) => type === 'all' || (type === 'combine' ? ['combine', 'revert-combination'].includes(details.kind) : details.kind === type))
      .filter(({ event, details }) => `${details.label} ${details.entity} ${event.entityId} ${partners.find(p => p.id === String(details.after.partnerId || details.before.partnerId))?.name || ''} ${JSON.stringify(event.before)} ${JSON.stringify(event.after)}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt));
  }, [rows, search, type, partners]);
  const pageCount = Math.max(1, Math.ceil(events.length / 25));
  const currentPage = Math.min(page, pageCount);
  return <div className="list-page">
    <PageHeader title="Change history" description="See what changed, for whom, and when. Expand an entry for previous values." actions={<Link className="button button--secondary" to="/ledger">Transaction ledger</Link>} />
    <div className="tools-controls"><label>Search history<input className="form-input" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><label>Change type<select className="form-input" value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option value="all">All changes</option><option value="update">Edits</option><option value="combine">Capital combinations</option><option value="create">Created records</option><option value="delete">Deleted records</option><option value="restore">Restored records</option></select></label><button className="button button--secondary" type="button" disabled={loading} onClick={() => void refresh()}>Refresh history</button></div>
    <p className="tools-hint">Entries marked “Needs checking” may not have saved. Check the record before retrying.</p>
    {loading && <p role="status">Loading history…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && !events.length && <p>No matching changes recorded.</p>}
    {!loading && !error && events.slice((currentPage - 1) * 25, currentPage * 25).map(({ event, details }) => {
      const { before, after, combination, originals, keys } = details;
      const partnerId = after.partnerId || before.partnerId;
      return <article className="tools-panel activity-entry" key={event.id}>
        <div className="activity-entry-heading"><h2>{partnerId ? value('partnerId', partnerId) : String(after.name || before.name || details.entity)} · {['combine', 'revert-combination'].includes(details.kind) ? details.label : `${details.entity} ${details.label.toLowerCase()}`}</h2><span>{event.status === 'committed' ? 'Saved' : 'Needs checking'}</span></div>
        <p className="activity-entry-time">{new Date(event.occurredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
        <div className="activity-change-summary">{keys.slice(0, 3).map(key => <p key={key}><strong>{fieldLabels[key] || key.replace(/_/g, ' ')}:</strong> {value(key, before[key])} → <strong>{value(key, after[key])}</strong></p>)}</div>
        {event.status !== 'committed' && event.reason && <p>{event.reason}</p>}
        {combination && <details><summary>Capital combination details</summary><section aria-label="Combination details">
          <p>Effective date: <strong>{formatDate(combination.effectiveDate)}</strong> · Combined capital: <strong>{money(after.amountRupees ?? before.amountRupees)}</strong> · Profit rate: <strong>{value('profitPercent', after.profitPercent ?? before.profitPercent)}</strong></p>
          <p>Original unpaid profit carried separately: <strong>{money(combination.sources.reduce((sum, source) => sum + source.pending, 0))}</strong></p>
          <ul className="audit-sources">{combination.sources.map(source => {
            const original = originals.find(a => String(a.id) === source.id);
            return <li key={source.id}>Capital entry {source.id}: {money(source.capital)} remaining · {money(source.pending)} unpaid profit{original && <> · Received {value('receivedDate', original.receivedDate)} · Original amount {money(original.amountRupees)} · Rate {value('profitPercent', original.profitPercent)} · Funding {value('creditCardId', original.creditCardId)} · Planned return {value('returnDate', original.returnDate)}{original.notes ? ` · Notes: ${original.notes}` : ''}</>}</li>;
          })}</ul>
        </section></details>}
        <details><summary>View changed values ({keys.length})</summary><dl className="change-values">{keys.map(key => <div key={key}><dt>{fieldLabels[key] || key.replace(/_/g, ' ')}</dt><dd><span>Before: {value(key, before[key])}</span><span>After: {value(key, after[key])}</span></dd></div>)}</dl><p className="tools-hint">Record reference: {event.entityId} · Recorded by: {event.actor} (identity unverified)</p></details>
        {details.kind === 'delete' && !keys.length && <p>Record deleted; previous values remain in this audit log.</p>}
      </article>;
    })}
    <div className="tools-controls"><button className="button button--secondary" type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button className="button button--secondary" type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div>
  </div>;
}
