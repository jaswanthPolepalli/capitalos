// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
let EditEntryModal;
let store;

let data;
beforeEach(async () => {
  vi.stubGlobal('React', React);
  data = {
    partners: [{ id: 'p', name: 'Partner', notes: '', phone: '', email: '' }],
    allocations: [{ id: 'a', partnerId: 'p', amountRupees: 100000, profitPercent: 3, receivedDate: '2025-01-01', returnDate: null, creditCardId: null, notes: 'Original · WA_CONFIRMED' }],
    'profit-records': [{ id: 'profit', allocationId: 'a', partnerId: 'p', amountRupees: 1000, paidDate: '2025-02-01', notes: '' }],
    'capital-returns': [{ id: 'return', allocationId: 'a', partnerId: 'p', amountRupees: 500, returnedDate: '2025-02-01', notes: 'Old note' }],
    'credit-cards': [],
  };
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    const parts = url.replace('/server/capitalos-api/', '').split('/');
    if (options?.method === 'PATCH') {
      const record = data[parts[0]].find(r => r.id === parts[1]);
      Object.assign(record, JSON.parse(options.body));
      return new Response(JSON.stringify({ status: 'success', data: record }));
    }
    return new Response(JSON.stringify({ status: 'success', data: data[parts[0]] ?? [] }));
  }));
  store = await import('../client/src/store');
  ({ EditEntryModal } = await import('../client/src/components/EditEntryModal'));
  await store.loadAll();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function open(type, close = vi.fn()) {
  render(<MemoryRouter><EditEntryModal event={store.getLedger().find(e => e.eventType === type)} allocationSummaries={store.getAllocationSummaries()} onClose={close} /></MemoryRouter>);
  return userEvent.setup();
}

it('adds partial and recurring settings to a saved profit and persists after reload', async () => {
  const close = vi.fn();
  const user = open('PROFIT_PAID', close);
  await user.click(screen.getByRole('checkbox', { name: /This was a partial payment/ }));
  await user.type(screen.getByLabelText('Profit still due (₹)'), '1500');
  await user.click(screen.getByRole('checkbox', { name: /Principal will recur/ }));
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(close).toHaveBeenCalledOnce();
  await store.loadAll();
  expect(store.getAllocationSummaries()[0]).toMatchObject({ isPartiallyPaid: true, isRecurring: true, profitPending: 1500 });
});

it('preserves percentage-based partial payments and confirmation when editing notes', async () => {
  data['profit-records'][0].notes = 'Ref: 123 · Partial payment · Remaining %: 1.5% · Capital reinvested · WA_CONFIRMED';
  await store.loadAll();
  const user = open('PROFIT_PAID');
  expect(screen.getByLabelText('Or remaining profit rate (%)').value).toBe('1.5');
  expect(screen.getByLabelText('Notes').value).toBe('Ref: 123');
  await user.type(screen.getByLabelText('Notes'), ' updated');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(data['profit-records'][0].notes).toContain('Remaining %: 1.5%');
  expect(data['profit-records'][0].notes).toContain('WA_CONFIRMED');
  expect(store.getAllocationSummaries()[0].profitPending).toBe(1500);
});

it('removes partial and recurring flags without leaving stale ledger notes', async () => {
  data['profit-records'][0].notes = 'Partial payment · Remaining: ₹2,000 · Capital reinvested';
  await store.loadAll();
  const user = open('PROFIT_PAID');
  await user.click(screen.getByRole('checkbox', { name: /This was a partial payment/ }));
  await user.click(screen.getByRole('checkbox', { name: /Principal will recur/ }));
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(store.getLedger().find(e => e.eventType === 'PROFIT_PAID').notes).toBe('');
  expect(store.getAllocationSummaries()[0]).toMatchObject({ isPartiallyPaid: false, isRecurring: false, profitPending: 0 });
});

it('shows persistence errors and leaves the editor open', async () => {
  const close = vi.fn();
  const user = open('PROFIT_PAID', close);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection failed')));
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Connection failed');
  expect(close).not.toHaveBeenCalled();
});

it('edits contribution rate to zero and return date while preserving confirmation', async () => {
  const user = open('CAPITAL_RECEIVED');
  await user.clear(screen.getByLabelText('Profit % per month *'));
  await user.type(screen.getByLabelText('Profit % per month *'), '0');
  await user.type(screen.getByLabelText(/Return date/), '2026-12-01');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(data.allocations[0]).toMatchObject({ profitPercent: 0, returnDate: '2026-12-01', notes: 'Original · WA_CONFIRMED' });
});

it('rejects a capital return greater than available capital', async () => {
  const close = vi.fn();
  const user = open('CAPITAL_RETURNED', close);
  await user.clear(screen.getByLabelText('Amount returned (₹)'));
  await user.type(screen.getByLabelText('Amount returned (₹)'), '100001');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(screen.getByRole('alert').textContent).toContain('exceeds');
  expect(close).not.toHaveBeenCalled();
});

it('opens shared editors from partner contribution and payment histories', async () => {
  sessionStorage.setItem('cos_role_unlocked', '1');
  const { PartnerDetailPage } = await import('../client/src/pages/PartnerDetailPage');
  const { RoleProvider } = await import('../client/src/context/RoleContext');
  const { Routes, Route } = await import('react-router-dom');
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/partners/p']}><RoleProvider><Routes><Route path="/partners/:id" element={<PartnerDetailPage />} /></Routes></RoleProvider></MemoryRouter>);
  await user.click(await screen.findByRole('button', { name: 'Edit profit payment' }));
  expect(screen.getByRole('dialog', { name: 'Edit Profit Payment' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Edit capital return' }));
  expect(screen.getByRole('dialog', { name: 'Edit Capital Return' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Edit contribution' }));
  expect(screen.getByRole('dialog', { name: 'Edit Contribution' })).toBeTruthy();
  sessionStorage.clear();
});

it('clears an optional return date, including after a partial native date edit, and persists null', async () => {
  data.allocations[0].returnDate = '2026-09-10';
  await store.loadAll();
  const user = open('CAPITAL_RECEIVED');
  const originalInput = screen.getByLabelText(/Return date/);
  await user.clear(originalInput);
  // Browsers expose an empty value for an incomplete native date. Clear must
  // remain available and replace the input to discard its internal segments.
  await user.click(screen.getByRole('button', { name: 'Clear return date' }));
  expect(screen.getByLabelText(/Return date/)).not.toBe(originalInput);
  expect(screen.getByLabelText(/Return date/).value).toBe('');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(data.allocations[0].returnDate).toBeNull();
  await store.loadAll();
  expect(store.getAllocations()[0].returnDate).toBeNull();
});
