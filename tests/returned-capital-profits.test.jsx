import { splitProfit } from '../functions/capitalos-api/profit-sharing.mjs';
// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PendingProfitsPage } from '../client/src/pages/PendingProfitsPage';
import { RoleProvider } from '../client/src/context/RoleContext';
import * as store from '../client/src/store';

let data;
beforeEach(async () => {
  vi.stubGlobal('React', React);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  sessionStorage.setItem('cos_role_unlocked', '1');
  data = {
    partners: [{ id: 'p', name: 'Paparao', notes: '', phone: '', email: '' }],
    allocations: [{ id: 'a', partnerId: 'p', amountRupees: 150000, profitPercent: 4, receivedDate: '2026-09-07', returnDate: '2026-09-24', creditCardId: null, notes: 'UNI' }],
    'capital-returns': [{ id: 'r', allocationId: 'a', partnerId: 'p', amountRupees: 150000, returnedDate: '2026-09-22', notes: '' }],
    'profit-records': [],
    'credit-cards': [],
  };
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    const resource = url.split('/').at(-1);
    let result = data[resource] ?? [];
    if (options?.method === 'POST') {
      result = { ...JSON.parse(options.body), id: String(data[resource].length + 1) };
      if (resource === 'profit-records') Object.assign(result, splitProfit(result.amountRupees));
      data[resource].push(result);
    }
    return new Response(JSON.stringify({ status: 'success', data: result }));
  }));
  await store.loadAll();
});
afterEach(() => { cleanup(); sessionStorage.clear(); delete HTMLElement.prototype.scrollIntoView; vi.unstubAllGlobals(); });

async function open() {
  render(<MemoryRouter><RoleProvider><PendingProfitsPage /></RoleProvider></MemoryRouter>);
  await act(async () => { await store.loadAll(); });
  return userEvent.setup();
}
async function chooseReturned(user) {
  await user.click(screen.getByRole('button', { name: 'Record Profit' }));
  await user.click(screen.getByRole('button', { name: 'Contribution' }));
  await user.click(screen.getByRole('option', { name: /Paparao.*Capital fully returned/ }));
}

it('records profit after full capital return and retains it in paid history and ledger after reload', async () => {
  const user = await open();
  await chooseReturned(user);
  expect(screen.getByLabelText('Partner + CFO amount (₹) *').value).toBe('8400');
  expect(screen.getByRole('checkbox', { name: /Principal will recur/ }).disabled).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Record Payment' }));
  await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  expect(await screen.findByText('Payment Recorded')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Done' }));
  await act(async () => { await store.loadAll(); });
  expect(store.getLedger().find(e => e.eventType === 'PROFIT_PAID')).toMatchObject({ allocationId: 'a', partnerId: 'p', amountRupees: 6000 });
  expect(store.getAllocationSummaries()[0]).toMatchObject({ capitalOutstanding: 0, isFullyReturned: true, nextMonthProfit: 0 });
  const paidRow = within(screen.getByRole('table', { name: /paid profits/i })).getByRole('row', { name: /Paparao/ });
  expect(within(paidRow).getByText('₹6,000')).toBeTruthy();
});

it('requires an explicit remaining balance when unknown and keeps that balance payable after return', async () => {
  data.allocations[0].profitPercent = 0;
  await store.loadAll();
  const user = await open();
  await chooseReturned(user);
  await user.type(screen.getByLabelText('Partner + CFO amount (₹) *'), '2800');
  await user.click(screen.getByRole('checkbox', { name: /This is a partial payment/ }));
  expect(screen.queryByLabelText(/Or remaining % rate/)).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Record Partial Payment' }));
  if (screen.queryByRole('button', { name: 'Confirm payment' })) await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  expect(screen.getByText('Enter the profit amount still owed after this payment.')).toBeTruthy();
  expect(data['profit-records']).toHaveLength(0);
  await user.type(screen.getByLabelText(/Partner amount still owed/), '4000');
  await user.click(screen.getByRole('button', { name: 'Record Partial Payment' }));
  if (screen.queryByRole('button', { name: 'Confirm payment' })) await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  await user.click(await screen.findByRole('button', { name: 'Done' }));
  await act(async () => { await store.loadAll(); });
  expect(store.getAllocationSummaries()[0].profitPending).toBe(4000);
  await user.click(screen.getAllByRole('button', { name: 'Pay ₹4,000 more' })[0]);
  await user.clear(screen.getByLabelText('Partner + CFO amount (₹) *'));
  await user.type(screen.getByLabelText('Partner + CFO amount (₹) *'), '1400');
  await user.click(screen.getByRole('checkbox', { name: /This is a partial payment/ }));
  await user.click(screen.getByRole('button', { name: 'Record Partial Payment' }));
  if (screen.queryByRole('button', { name: 'Confirm payment' })) await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  await user.click(await screen.findByRole('button', { name: 'Done' }));
  await act(async () => { await store.loadAll(); });
  expect(store.getAllocationSummaries()[0].profitPending).toBe(3000);
  await user.click(screen.getAllByRole('button', { name: 'Pay ₹3,000 more' })[0]);
  await user.click(screen.getByRole('button', { name: 'Record Payment' }));
  await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  await user.click(await screen.findByRole('button', { name: 'Done' }));
  expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: 0, totalProfitPaid: 6000, capitalOutstanding: 0 });
});

it('shows full unpaid profit after a partial capital return and only subtracts profit payments', async () => {
  Object.assign(data.allocations[0], { amountRupees: 178500, profitPercent: 3, notes: 'AXIS CC' });
  data['capital-returns'][0].amountRupees = 162500;
  await store.loadAll();
  const user = await open();
  expect(store.getAllocationSummaries()[0]).toMatchObject({ capitalOutstanding: 16000, currentCycleProfit: 5355, profitPending: 5355, expectedMonthlyProfit: 480 });
  await user.click(screen.getAllByRole('button', { name: 'Pay ₹5,355' })[0]);
  expect(screen.getByLabelText('Partner + CFO amount (₹) *').value).toBe('7497');
  await user.clear(screen.getByLabelText('Partner + CFO amount (₹) *'));
  await user.type(screen.getByLabelText('Partner + CFO amount (₹) *'), '1400');
  await user.click(screen.getByRole('checkbox', { name: /This is a partial payment/ }));
  await user.click(screen.getByRole('button', { name: 'Record Partial Payment' }));
  if (screen.queryByRole('button', { name: 'Confirm payment' })) await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  await user.click(await screen.findByRole('button', { name: 'Done' }));
  await act(async () => { await store.loadAll(); });
  expect(store.getAllocationSummaries()[0]).toMatchObject({ capitalOutstanding: 16000, totalProfitPaid: 1000, profitPending: 4355 });
  expect(screen.getAllByRole('button', { name: 'Pay ₹4,355 more' })).toHaveLength(2);
});

it('keeps manual recording unavailable in the read-only role', async () => {
  sessionStorage.clear();
  await open();
  expect(screen.queryByRole('button', { name: 'Record Profit' })).toBeNull();
});
