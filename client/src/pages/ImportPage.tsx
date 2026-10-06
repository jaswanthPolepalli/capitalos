import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IMPORT_FIELDS, REQUIRED_FIELDS, previewImport, type ImportKind, type ImportPreviewRow } from '../../../functions/capitalos-api/imports.mjs';
import { PageHeader } from '../components/PageHeader';
import { useRole } from '../context/RoleContext';
import { parseCSV, autoMapping, FIELD_LABELS, type ParsedCSV } from '../lib/importCsv';
import { downloadCSV } from '../lib/csv';
import { operationsRequest } from '../lib/operationsApi';
import { refreshAfterWrite } from '../store';
import { useStore } from '../useStore';

interface ImportOutcome { rowNumber: number; status: 'imported' | 'duplicate' | 'rejected' | 'unconfirmed'; messages: string[]; id?: string }
export function ImportPage() {
  const { partners, allocations, creditCards, isLoaded } = useStore();
  const { isCFO } = useRole();
  const [kind, setKind] = useState<ImportKind>('partners');
  const [file, setFile] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);
  const [page, setPage] = useState(1);
  const input = useRef<HTMLInputElement>(null);
  const fileReadVersion = useRef(0);
  const fields = IMPORT_FIELDS[kind];
  const required = REQUIRED_FIELDS[kind];
  const unmapped = required.filter(field => !mapping[field]);
  const preview = useMemo<ImportPreviewRow[]>(() => {
    if (!file || unmapped.length) return [];
    const rows = file.rows.map(row => ({ rowNumber: row.rowNumber, values: Object.fromEntries(fields.map(field => [field, row.cells[file.headers.indexOf(mapping[field] || '')] || ''])) }));
    return previewImport(kind, rows, { partners, allocations, creditCards }).map((row, index) => file.rows[index]?.error ? { ...row, status: 'rejected', messages: [file.rows[index]!.error] } : row);
  }, [file, mapping, kind, partners, allocations, creditCards, fields, unmapped.length]);
  const ready = preview.filter(row => row.status === 'ready');
  async function readFile(chosen?: File) {
    const version = ++fileReadVersion.current;
    setError(''); setOutcomes([]); setReviewed(false); setPage(1); setFile(null);
    if (!chosen) return;
    setFileLoading(true);
    try {
      if (chosen.size > 2 * 1024 * 1024) throw new Error('Choose a CSV file smaller than 2 MB.');
      const text = await chosen.text();
      if (version !== fileReadVersion.current) return;
      const parsed = parseCSV(text); setFile(parsed); setMapping(autoMapping(parsed.headers, fields));
      if (!parsed.rows.length) setError('This file has headers but no records.');
    } catch (cause) { if (version === fileReadVersion.current) setError((cause as Error).message); }
    finally { if (version === fileReadVersion.current) setFileLoading(false); }
  }
  async function commit() {
    if (busy || !isCFO || !reviewed || !ready.length) return;
    setBusy(true); setError('');
    try {
      const result = await operationsRequest<{ results: ImportOutcome[] }>('imports', { kind, rows: ready.map(({ rowNumber, values }) => ({ rowNumber, values })) });
      setOutcomes([...preview.filter(r => r.status !== 'ready').map(r => ({ rowNumber: r.rowNumber, status: r.status as 'duplicate' | 'rejected', messages: r.messages })), ...result.results].sort((a, b) => a.rowNumber - b.rowNumber));
      setReviewed(false);
      await refreshAfterWrite();
    } catch (cause) { setError(`${(cause as Error).message} If the request was interrupted, refresh records and review change history before retrying.`); setReviewed(false); }
    finally { setBusy(false); }
  }
  function template() {
    downloadCSV(`CapitalOS-${kind}-template.csv`, fields, kind === 'partners'
      ? [['Example Partner', '9000000000', 'partner@example.com', 'Replace this example before importing']]
      : [['Existing partner name or ID', 100000, 3, '2026-09-01', '2026-12-01', '', 'Replace this example before importing']]);
  }
  return <div className="list-page">
    <PageHeader title="Getting started & CSV import" description="Import partners first, then their capital contributions. Review every row before saving." />
    <ol className="onboarding-steps"><li><Link to="/partners">Create or import partners</Link></li><li><Link to="/capital-contributions">Add their capital and monthly rate</Link></li><li><Link to="/due-calendar">Review due dates</Link></li><li><Link to="/reports">Check balances and statements</Link></li></ol>
    <section className="tools-panel">
      <div className="tools-controls"><label>Import type<select className="form-input" value={kind} disabled={busy || fileLoading} onChange={e => { fileReadVersion.current++; setKind(e.target.value as ImportKind); setFile(null); setMapping({}); setOutcomes([]); setReviewed(false); setError(''); if (input.current) input.current.value = ''; }}><option value="partners">Partners</option><option value="allocations">Capital contributions</option></select></label>
        <button className="button button--secondary" type="button" onClick={template}>Download example CSV</button>
        <label>CSV file<input ref={input} className="form-input" type="file" accept=".csv,text/csv" disabled={!isCFO || busy || fileLoading} onChange={e => void readFile(e.target.files?.[0])} /></label>
      </div>
      <p>Up to 500 records / 2 MB. Dates use YYYY-MM-DD. Amounts use whole rupees; decimal amounts are rejected rather than rounded. Imports do not send partner emails.</p>
      {!isCFO && <p>Unlock CFO access to import records.</p>}
      {(fileLoading || !isLoaded) && <p role="status">Loading {fileLoading ? 'CSV preview' : 'existing records for duplicate checking'}…</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </section>
    {file && <section className="tools-panel"><h2>Map your columns</h2><div className="tools-grid">
      {fields.map(field => <label key={field}>{FIELD_LABELS[field]}{required.includes(field) ? ' *' : ''}<select className="form-input" value={mapping[field] || ''} disabled={busy} onChange={e => { setMapping(prev => ({ ...prev, [field]: e.target.value })); setReviewed(false); setOutcomes([]); setPage(1); }}><option value="">{required.includes(field) ? 'Choose column' : 'Not included'}</option>{file.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}
    </div>{unmapped.length > 0 && <p role="status">Map required columns to see the preview.</p>}</section>}
    {preview.length > 0 && <section className="tools-panel"><h2>Preview and duplicate check</h2><p role="status">{ready.length} ready · {preview.filter(r => r.status === 'duplicate').length} possible duplicates · {preview.filter(r => r.status === 'rejected').length} rejected</p>
      {kind === 'allocations' && <p>Ready capital: ₹{ready.reduce((sum, r) => sum + Number(r.data.amountRupees), 0).toLocaleString('en-IN')}. Estimated monthly profit at entered rates: ₹{ready.reduce((sum, r) => sum + Number(r.data.amountRupees) * Number(r.data.profitPercent) / 100, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}. Review return dates in the preview.</p>}
      <table className="adaptive-table tools-table" aria-label="CSV import preview"><thead><tr><th>Row</th><th>Record</th><th>Values</th><th>Status</th><th>Explanation</th></tr></thead><tbody>{preview.slice((page - 1) * 25, page * 25).map(row => <tr key={row.rowNumber}><td data-label="Row">{row.rowNumber}</td><td data-label="Record">{row.values.name || row.values.partner}</td><td data-label="Values"><dl>{fields.filter(field => row.values[field]).map(field => <div key={field}><dt>{FIELD_LABELS[field]}</dt><dd>{row.values[field]}</dd></div>)}</dl></td><td data-label="Status">{row.status}</td><td data-label="Explanation">{row.messages.join(' ') || 'Ready to import'}</td></tr>)}</tbody></table>
      <div className="tools-controls"><button className="button button--secondary" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous rows</button><span>Page {page} / {Math.ceil(preview.length / 25)}</span><button className="button button--secondary" type="button" disabled={page * 25 >= preview.length} onClick={() => setPage(page + 1)}>Next rows</button><button className="button button--secondary" type="button" onClick={() => downloadCSV('import-rejected-rows.csv', ['Row', ...file!.headers, 'Status', 'Explanation'], preview.filter(r => r.status !== 'ready').map(r => [r.rowNumber, ...(file!.rows.find(original => original.rowNumber === r.rowNumber)?.cells || []), r.status, r.messages.join(' ')]))}>Download rejected / duplicate rows</button></div>
      <label className="tools-check"><input type="checkbox" disabled={!ready.length || busy || !isLoaded} checked={reviewed} onChange={e => setReviewed(e.target.checked)} /> I reviewed the ready rows and their amounts. Duplicates and rejected rows will be skipped.</label>
      <button className="button button--primary" type="button" disabled={!isCFO || !reviewed || !ready.length || busy || !isLoaded} onClick={() => void commit()}>{busy ? 'Importing…' : `Import ${ready.length} ready rows`}</button>
    </section>}
    {outcomes.length > 0 && <section className="tools-panel" aria-label="Import results"><h2>Import results</h2><p role="status">{outcomes.filter(o => o.status === 'imported').length} imported · {outcomes.filter(o => o.status === 'duplicate').length} skipped duplicates · {outcomes.filter(o => o.status === 'rejected').length} rejected · {outcomes.filter(o => o.status === 'unconfirmed').length} unconfirmed</p>
      <p>Unconfirmed rows are not retried automatically. Inspect records and <Link to="/activity">change history</Link> before retrying.</p>
      <ul>{outcomes.map(o => <li key={o.rowNumber}>Row {o.rowNumber}: <strong>{o.status}</strong>{o.id ? ` · Record ${o.id}` : ''} {o.messages.join(' ')}</li>)}</ul>
      <button className="button button--secondary" type="button" onClick={() => downloadCSV('import-results.csv', ['Row', 'Status', 'Record ID', 'Explanation'], outcomes.map(o => [o.rowNumber, o.status, o.id || '', o.messages.join(' ')]))}>Export import results</button>
    </section>}
  </div>;
}
