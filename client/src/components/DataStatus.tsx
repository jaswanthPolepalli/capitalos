import type { ReactNode } from 'react';
import { useStoreStatus } from '../useStoreStatus';

export function DataStatus({ children }: { children: ReactNode }) {
  const state = useStoreStatus();
  const loading = state.status === 'loading' || state.status === 'idle';
  const showStatus = !state.hasData || Boolean(state.error) || (state.isStale && !loading);
  return <>
    {showStatus && <section className="data-status no-print" aria-label="Data freshness">
      <div role={state.error ? 'alert' : 'status'} aria-live="polite">
        <strong>{state.error ? (state.hasData ? 'Showing saved data — refresh failed.' : 'Records could not be loaded.')
          : loading ? (state.hasData ? 'Refreshing records…' : 'Loading records…')
          : state.isStale ? 'Balances may have changed since the last refresh.' : 'Records refreshed.'}</strong>
        {state.error && <p>{state.error}</p>}
        {state.lastSuccess && <p>Last refreshed: {new Date(state.lastSuccess).toLocaleString('en-IN')}.</p>}
        {state.hasData && (state.error || state.isStale) && <p>Refresh before making financial decisions or recording payments.</p>}
      </div>
      <button type="button" className="button button--secondary" disabled={loading} onClick={() => void state.refresh()}>{state.error ? 'Retry loading' : 'Refresh records'}</button>
    </section>}
    {state.hasData ? children : null}
  </>;
}
