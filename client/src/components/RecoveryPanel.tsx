import { useState } from 'react';
import { useRole } from '../context/RoleContext';
import { useRemoteList } from '../lib/operationsApi';
import { restoreEntity } from '../store';

interface DeletedRecord { id: string; name?: string; cardName?: string; partnerId?: string; amountRupees?: number; deletedAt: string | null; deletedBecause: string; restoreBlocked: string }
const resources = [['partners', 'Partners'], ['allocations', 'Contributions'], ['capital-returns', 'Capital returns'], ['profit-records', 'Profit payments'], ['credit-cards', 'Credit cards']];

export function RecoveryPanel() {
  const { isCFO } = useRole();
  const [resource, setResource] = useState('partners');
  const { rows, loading, error, refresh } = useRemoteList<DeletedRecord>(`${resource}?deleted=true`);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  async function restore(id: string) {
    setSaving(id); setMessage(''); setFailure('');
    try { await restoreEntity(resource, id); await refresh(); setMessage('Restored. Balances and ledger have been refreshed.'); }
    catch (cause) { setFailure((cause as Error).message); }
    finally { setSaving(''); }
  }
  return <section className="settings-section" aria-labelledby="recovery-title">
    <h2 id="recovery-title">Deleted Records</h2>
    <p>Restore a partner before its contributions, and a contribution before its payments. Restoring a parent reveals its records; entries deleted separately stay deleted.</p>
    <div className="tools-controls">
      <label>Record type<select className="form-input" disabled={!!saving} value={resource} onChange={e => { setResource(e.target.value); setMessage(''); setFailure(''); }}>{resources.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button className="button button--secondary" type="button" disabled={loading || !!saving} onClick={() => void refresh()}>Refresh deleted records</button>
    </div>
    {loading && <p role="status">Loading deleted records…</p>}
    {(error || failure) && <p role="alert" className="form-error">{error || failure}</p>}
    {message && <p role="status">{message}</p>}
    {!loading && !error && rows.length === 0 && <p>No deleted records in this category.</p>}
    {!loading && !error && rows.map(row => <article className="tools-record" key={row.id}>
      <div><strong>{row.name || row.cardName || `Record ${row.id}`}</strong>{row.amountRupees !== undefined && <p>₹{row.amountRupees.toLocaleString('en-IN')}</p>}<p>{row.deletedBecause}{row.deletedAt ? ` · ${new Date(row.deletedAt).toLocaleString('en-IN')}` : ''}</p></div>
      {row.restoreBlocked ? <p>{row.restoreBlocked}</p> : <button className="button button--secondary" type="button" disabled={!isCFO || !!saving} onClick={() => void restore(row.id)}>{saving === row.id ? 'Restoring…' : 'Restore'}</button>}
    </article>)}
    {!isCFO && <p>Unlock CFO access to restore records.</p>}
  </section>;
}
