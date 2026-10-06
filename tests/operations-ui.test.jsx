// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PartnerStatementPage } from '../client/src/pages/PartnerStatementPage';
import { ImportPage } from '../client/src/pages/ImportPage';
import { DueCalendarPage } from '../client/src/pages/DueCalendarPage';
import { ActivityPage } from '../client/src/pages/ActivityPage';
import { ModalAccessibility } from '../client/src/components/ModalAccessibility';
import { downloadCSV } from '../client/src/lib/csv';
const fixture = vi.hoisted(() => ({ current: null }));
vi.mock('../client/src/useStore', () => ({ useStore: () => fixture.current }));
vi.mock('../client/src/context/RoleContext', () => ({ useRole: () => ({ isCFO: true }) }));
vi.mock('../client/src/store', () => ({ refreshAfterWrite: vi.fn(async () => {}) }));
vi.mock('../client/src/lib/csv', () => ({ downloadCSV: vi.fn() }));
let reminderHistory;
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-18T10:00:00Z')); vi.clearAllMocks();
  reminderHistory = [];
  const partner = { id: 'p', name: 'Partner A', email: '', phone: '', notes: '', createdAt: '2026-01-01' };
  const allocation = { id: 'a', partnerId: 'p', partner, amountRupees: 1000, capitalOutstanding: 1000, totalCapitalReturned: 0, receivedDate: '2026-01-01', returnDate: '2026-09-25', creditCardId: null, profitPercent: 3, profitPending: 30, firstProfitDueDate: null };
  fixture.current = { isLoaded: true, partners: [partner], getPartner: id => id === 'p' ? partner : undefined, allocations: [allocation], creditCards: [], allocationSummaries: [allocation], ledger: [
    { id: '1', refId: 'a', allocationId: 'a', partnerId: 'p', eventType: 'CAPITAL_RECEIVED', amountRupees: 1000, date: '2026-03-01', createdAt: '2026-03-01T00:00:00Z', notes: 'Opening capital' },
    { id: '2', refId: 'r', allocationId: 'a', partnerId: 'p', eventType: 'CAPITAL_RETURNED', amountRupees: 200, date: '2026-09-18', createdAt: '2026-09-18T00:00:00Z', notes: 'Part returned' },
  ] };
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    let data = [];
    if (url.endsWith('/reminder-events')) {
      if (options?.method === 'POST') { const body = JSON.parse(options.body); data = { ...body, id: 'event', occurredAt: '2026-09-18T10:00:00Z' }; reminderHistory.unshift(data); }
      else data = reminderHistory;
    }
    if (url.endsWith('/imports')) data = { results: JSON.parse(options.body).rows.map(row => ({ rowNumber: row.rowNumber, status: 'imported', messages: [], id: 'new' })) };
    return new Response(JSON.stringify({ status: 'success', data }));
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function mount(page) { render(<MemoryRouter>{page}</MemoryRouter>); return userEvent.setup(); }

it('uses the selected statement range for opening/closing balances and export', async () => {
  render(<MemoryRouter initialEntries={['/partners/p/statement']}><Routes><Route path="/partners/:id/statement" element={<PartnerStatementPage />} /></Routes></MemoryRouter>);
  const user = userEvent.setup();
  const table = screen.getByRole('table', { name: 'Statement transactions' });
  expect(table.textContent).toContain('₹800.00');
  await user.click(screen.getByRole('button', { name: 'Apply Apr–Mar year' }));
  expect(screen.getByLabelText('From').value).toBe('2026-04-01'); expect(screen.getByLabelText('Through').value).toBe('2027-03-31');
  await user.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(downloadCSV.mock.calls[0][2][0]).toEqual(['2026-04-01', 'Opening principal', '', '', '', '', 1000, 'Before start date']);
  await user.clear(screen.getByLabelText('From')); await user.type(screen.getByLabelText('From'), '2028-01-01');
  expect(screen.getByRole('alert')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Print / Save as PDF' }).disabled).toBe(true);
});
it('maps an uploaded CSV, previews rejected/duplicate rows and imports only reviewed valid rows', async () => {
  const user = mount(<ImportPage />);
  await user.selectOptions(screen.getByLabelText('Import type'), 'allocations');
  const file = new File(['Investor,Capital,Rate,Date\nPartner A,25000,3,2026-09-01\nPartner A,25000,3,2026-09-01\nPartner A,-5,3,invalid'], 'test.csv', { type: 'text/csv' });
  file.text = async () => 'Investor,Capital,Rate,Date\nPartner A,25000,3,2026-09-01\nPartner A,25000,3,2026-09-01\nPartner A,-5,3,invalid';
  await user.upload(screen.getByLabelText('CSV file'), file);
  await user.selectOptions(await screen.findByLabelText('Partner name or ID *'), 'Investor');
  expect(await screen.findByText('1 ready · 1 possible duplicates · 1 rejected')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Import 1 ready rows' }).disabled).toBe(true);
  await user.click(screen.getByRole('checkbox', { name: /I reviewed/ }));
  await user.click(screen.getByRole('button', { name: 'Import 1 ready rows' }));
  expect(await screen.findByRole('region', { name: 'Import results' })).toBeTruthy();
  const call = fetch.mock.calls.find(([url]) => url.endsWith('/imports'));
  expect(JSON.parse(call[1].body).rows).toHaveLength(1);
  expect(screen.getByText('1 imported · 1 skipped duplicates · 1 rejected · 0 unconfirmed')).toBeTruthy();
});
it('reviews a reminder batch and stores manual sent history without sending a message', async () => {
  const user = mount(<DueCalendarPage />);
  await screen.findByText('No reminder activity yet.');
  await user.click(screen.getByRole('button', { name: 'Select visible' }));
  await user.click(screen.getByRole('button', { name: 'Review 1 selected' }));
  await user.click(screen.getByRole('button', { name: 'Confirm already sent' }));
  await waitFor(() => expect(reminderHistory).toHaveLength(1));
  expect(reminderHistory[0]).toMatchObject({ action: 'sent', kind: 'principal', amountRupees: 1000, dueDate: '2026-09-25' });
  expect(fetch.mock.calls.every(([url]) => url === '/server/capitalos-api/reminder-events')).toBe(true);
});
it('shows a history loading failure instead of claiming there were no changes', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'error', message: 'History storage unavailable' }), { status: 503 })));
  mount(<ActivityPage />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'History storage unavailable');
  expect(screen.queryByText('No matching changes recorded.')).toBeNull();
});
it('traps keyboard focus, closes with Escape and restores the launch button', async () => {
  function Example() {
    const [open, setOpen] = React.useState(false);
    return <><ModalAccessibility /><button onClick={() => setOpen(true)}>Open payment</button><button>Background action</button>{open && <div role="dialog" aria-modal="true" aria-label="Payment" className="modal-backdrop"><div className="modal"><div className="modal__header"><button onClick={() => setOpen(false)}>Close</button></div><div className="modal__body"><input aria-label="Amount" /><button>Save payment</button></div></div></div>}</>;
  }
  const user = mount(<Example />);
  const launch = screen.getByRole('button', { name: 'Open payment' }); await user.click(launch);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' })));
  await user.tab({ shift: true }); expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save payment' }));
  await user.tab(); expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(document.activeElement).toBe(launch);
  expect(document.body.style.overflow).not.toBe('hidden');
});

it('shows readable edits and combination terms, searches partner names, and filters change types', async () => {
  const combination = { effectiveDate: '2026-10-01', sources: [{ id: 'a', capital: 1000, pending: 30, profitRecordIds: [] }], revertSnapshot: JSON.stringify({ allocations: [{ id: 'a', amountRupees: 1000, receivedDate: '2026-01-01', profitPercent: 3, returnDate: null, creditCardId: null, notes: 'Original terms' }] }) };
  const base = { entityType: 'COS_Allocations', actor: 'Unverified caller', occurredAt: '2026-10-01T10:00:00Z', reason: '' };
  const rows = [
    { ...base, id: 'pending', operationId: 'edit', entityId: 'a', action: 'update', status: 'pending', before: { partner_id: 'p', profit_percent: '3' }, after: { partner_id: 'p', profit_percent: '4' } },
    { ...base, id: 'saved', operationId: 'edit', entityId: 'a', action: 'update', status: 'committed', before: { partner_id: 'p', profit_percent: '3' }, after: { partner_id: 'p', profit_percent: '4' } },
    { ...base, id: 'combined', operationId: 'combine', entityId: 'b', action: 'create', status: 'committed', before: null, after: { partner_id: 'p', amount_rupees: 1000, profit_percent: '4', notes: `CAPITALOS_COMBINATION_V1:${JSON.stringify({ combination, notes: '' })}` } },
  ];
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'success', data: rows }))));
  const user = mount(<ActivityPage />);
  expect(await screen.findByRole('heading', { name: 'Partner A · Capital combined' })).toBeTruthy();
  expect(screen.getAllByRole('heading', { name: 'Partner A · Capital entry edited' })).toHaveLength(1);
  await user.click(screen.getByText('Capital combination details'));
  expect(screen.getByRole('region', { name: 'Combination details' }).textContent).toContain('₹30');
  await user.click(screen.getByText('Capital combination details'));
  expect(screen.getByRole('region', { name: 'Combination details' }).textContent).toContain('Original terms');
  expect(screen.queryByText(/CAPITALOS_COMBINATION_V1/)).toBeNull();
  await user.selectOptions(screen.getByLabelText('Change type'), 'update');
  expect(screen.queryByRole('heading', { name: 'Partner A · Capital combined' })).toBeNull();
  await user.click(screen.getByText('View changed values (1)'));
  expect(screen.getByText('Profit rate')).toBeTruthy();
  expect(screen.getByText('Before: 3%')).toBeTruthy();
  expect(screen.getByText('After: 4%')).toBeTruthy();
  await user.type(screen.getByLabelText('Search history'), 'Partner A');
  expect(screen.getByRole('heading', { name: 'Partner A · Capital entry edited' })).toBeTruthy();
  await user.selectOptions(screen.getByLabelText('Change type'), 'combine');
  expect(screen.getByRole('heading', { name: 'Partner A · Capital combined' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Partner A · Capital entry edited' })).toBeNull();
});
