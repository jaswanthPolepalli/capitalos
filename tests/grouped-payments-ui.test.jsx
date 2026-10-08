// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';

let store, h, RoleProvider, GroupedPaymentModal, PaymentSelectionActions;
let loseResponse = false;
beforeEach(async () => {
  vi.stubGlobal('React', React);
  sessionStorage.setItem('cos_role_unlocked', '1');
  const data = baseData(); data.COS_Profits = [];
  data.COS_Allocations.push(...['b', 'c', 'd', 'e'].map(ROWID => ({ ...data.COS_Allocations[0], ROWID })));
  data.COS_Partners[0].phone = '9876543210';
  h = createApiHarness(data); loseResponse = false;
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    const path = url.replace('/server/capitalos-api/', '');
    const response = await h.request(options?.method || 'GET', path, options?.body ? JSON.parse(options.body) : undefined);
    if (path === 'payment-groups' && loseResponse) { loseResponse = false; throw new Error('Connection lost'); }
    return new Response(JSON.stringify(response), { status: response.status === 'error' ? 400 : 200 });
  }));
  store = await import('../client/src/store'); await store.loadAll();
  ({ RoleProvider } = await import('../client/src/context/RoleContext'));
  ({ GroupedPaymentModal } = await import('../client/src/components/GroupedPaymentModal'));
  ({ PaymentSelectionActions } = await import('../client/src/components/PaymentSelectionActions'));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });
function modal(kind = 'profit') {
  render(<MemoryRouter><RoleProvider><GroupedPaymentModal entries={store.getAllocationSummaries()} kind={kind} onClose={vi.fn()} /></RoleProvider></MemoryRouter>);
  return userEvent.setup();
}

it('records five rows in one save and builds one WhatsApp message with the total and breakdown', async () => {
  const user = modal();
  await user.type(screen.getByLabelText('Reference / UTR'), 'UTR-ONE');
  await user.click(screen.getByRole('button', { name: /Record 5 payments/ }));
  expect(await screen.findByRole('heading', { name: 'Payments recorded' })).toBeTruthy();
  expect(screen.getByText('Email not sent: this partner has no email address saved.')).toBeTruthy();
  expect(store.getProfitRecords()).toHaveLength(5);
  expect(store.getAllocationSummaries().every(a => a.profitPending === 0)).toBe(true);
  const links = screen.getAllByRole('link', { name: 'Share on WhatsApp' }); expect(links).toHaveLength(1);
  const url = new URL(links[0].href); const message = url.searchParams.get('text');
  expect(url.pathname).toBe('/919876543210');
  expect(message).toContain('₹1,500'); expect(message).toContain('Entries: 5'); expect(message).toContain('UTR-ONE');
  expect(message).not.toContain('Entry ');
  expect(message.match(/3% of this contribution/g)).toHaveLength(5);
  expect(message.match(/Profit remaining on this entry: ₹0/g)).toHaveLength(5);
  expect(message).toContain('Remaining amounts apply only to the listed entries, as of this payment.');
  expect(fetch.mock.calls.filter(([url, opts]) => url.endsWith('payment-groups') && opts.method === 'POST')).toHaveLength(1);
  await store.loadAll(); expect(store.getProfitRecords().every(p => p.paymentGroupId)).toBe(true);
});

it('automatically preserves the pending remainder when one row is only partly paid', async () => {
  const user = modal(); const amount = screen.getByLabelText('Partner + CFO amount — entry a (₹)');
  await user.clear(amount); await user.type(amount, '140');
  await user.click(screen.getByRole('button', { name: /Record 5 payments/ }));
  await screen.findByRole('heading', { name: 'Payments recorded' });
  expect(store.getAllocationSummaries().find(a => a.id === 'a')).toMatchObject({ profitPending: 200, isPartiallyPaid: true });
  const message = new URL(screen.getByRole('link', { name: 'Share on WhatsApp' }).href).searchParams.get('text');
  expect(message).toContain('Profit remaining on this entry: ₹200');
  expect(message).toContain('₹100* (1% of this contribution)');
});

it('returns capital across five rows, leaving profit obligations untouched', async () => {
  const user = modal('capital');
  await user.click(screen.getByRole('button', { name: /Record 5 payments/ }));
  await screen.findByRole('heading', { name: 'Payments recorded' });
  expect(store.getAllocationSummaries().every(a => a.capitalOutstanding === 0 && a.profitPending === 300)).toBe(true);
  expect(store.getLedger().filter(e => e.eventType === 'CAPITAL_RETURNED')).toHaveLength(6);
  const message = new URL(screen.getByRole('link', { name: 'Share on WhatsApp' }).href).searchParams.get('text');
  expect(message).toContain('₹49,000');
  expect(message).not.toContain('Entry ');
  expect(message).not.toContain('%');
  expect(message.match(/Capital remaining on this entry: ₹0/g)).toHaveLength(5);
});

it('recovers a lost server response using the same group, without recording duplicates', async () => {
  const user = modal(); loseResponse = true;
  await user.click(screen.getByRole('button', { name: /Record 5 payments/ }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Connection lost');
  expect(h.db.COS_Profits).toHaveLength(5);
  expect(screen.getByLabelText('Partner + CFO amount — entry a (₹)').disabled).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Check save status' }));
  await screen.findByRole('heading', { name: 'Payments recorded' });
  expect(h.db.COS_Profits).toHaveLength(5); expect(store.getProfitRecords()).toHaveLength(5);
});

it('rejects stale balances and excessive returns without saving', async () => {
  const user = modal('capital'); const amount = screen.getByLabelText('Capital returned — entry a (₹)');
  await user.clear(amount); await user.type(amount, '9001');
  await user.click(screen.getByRole('button', { name: /Record 5 payments/ }));
  expect(screen.getByRole('alert').textContent).toContain('exceeds');
  expect(h.db.COS_Returns).toHaveLength(1);
  await user.clear(amount); await user.type(amount, '9000');
  h.db.COS_Returns.push({ ROWID: 'new-return', partner_id: 'p', allocation_id: 'a', amount_rupees: 500, returned_date: '2026-09-20', notes: '' });
  await user.click(screen.getByRole('button', { name: /Record 5 payments/ }));
  expect((await screen.findByRole('alert')).textContent).toContain('balance changed');
  expect(amount.disabled).toBe(false);
  expect(h.db.COS_Returns).toHaveLength(2);
});

it('disables combined payment for mixed partners', async () => {
  const entries = store.getAllocationSummaries(); entries[1] = { ...entries[1], partnerId: 'other' };
  render(<MemoryRouter><RoleProvider><PaymentSelectionActions entries={entries} onClear={vi.fn()} /></RoleProvider></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Record selected profit' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Return selected capital' }).disabled).toBe(true);
  expect(screen.getByRole('status').textContent).toContain('one partner');
});

it('opens the combined flow from partner row selection', async () => {
  const { PartnerDetailPage } = await import('../client/src/pages/PartnerDetailPage');
  render(<MemoryRouter initialEntries={['/partners/p']}><RoleProvider><Routes><Route path="/partners/:id" element={<PartnerDetailPage />} /></Routes></RoleProvider></MemoryRouter>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('checkbox', { name: 'Select all payable partner entries' }));
  await user.click(screen.getByRole('button', { name: 'Record selected profit' }));
  expect(within(screen.getByRole('dialog')).getAllByRole('spinbutton')).toHaveLength(5);
  await user.click(screen.getByRole('button', { name: /Record 5 payments/ }));
  await screen.findByRole('heading', { name: 'Payments recorded' });
});

it.each(['Profits', 'Contributions'])('opens combined payments from %s row selection', async page => {
  const Component = page === 'Profits' ? (await import('../client/src/pages/PendingProfitsPage')).PendingProfitsPage : (await import('../client/src/pages/CapitalContributionsPage')).CapitalContributionsPage;
  render(<MemoryRouter><RoleProvider><Component /></RoleProvider></MemoryRouter>);
  const user = userEvent.setup();
  const boxes = page === 'Profits' ? screen.getAllByRole('checkbox', { name: /Select payment entry/ }) : screen.getAllByRole('checkbox', { name: /Select contribution/ });
  await user.click(boxes[0]); await user.click(boxes[1]);
  await user.click(screen.getByRole('button', { name: 'Record selected profit' }));
  expect(within(screen.getByRole('dialog')).getAllByRole('spinbutton')).toHaveLength(2);
});

it('shares only confirmed rows when saving stops partway through the selection', async () => {
  const seed = baseData(); seed.COS_Profits = [];
  seed.COS_Allocations.push(...['b', 'c', 'd', 'e'].map(ROWID => ({ ...seed.COS_Allocations[0], ROWID })));
  h = createApiHarness(seed, (table, action, row) => table === 'COS_Profits' && action === 'insert' && row.allocation_id === 'b');
  await store.loadAll();
  const user = modal();
  await user.click(screen.getByRole('button', { name: /Record 5 payments/ }));
  expect((await screen.findByRole('alert')).textContent).toContain('could not be confirmed');
  const message = new URL(screen.getByRole('link', { name: 'Share recorded payments on WhatsApp' }).href).searchParams.get('text');
  expect(message).toContain('Entries: 1'); expect(message).toContain('₹300');
  expect(message.match(/Profit paid: /g)).toHaveLength(1);
  expect(message).not.toContain('Entry ');
  expect(store.getProfitRecords()).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Check save status' }));
  expect(h.db.COS_Profits).toHaveLength(1);
});
