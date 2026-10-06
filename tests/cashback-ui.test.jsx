import { prepareCashback, monthlyCashback } from '../functions/capitalos-api/cashback.mjs';
// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PendingProfitsPage } from '../client/src/pages/PendingProfitsPage';
import { RoleProvider } from '../client/src/context/RoleContext';
import * as store from '../client/src/store';
import { businessToday } from '../client/src/lib/businessDates';
import { buildStatement } from '../client/src/lib/statements';
let data;
beforeEach(async () => {
  vi.stubGlobal('React', React);
  sessionStorage.setItem('cos_role_unlocked', '1');
  data = {
    partners: [{ id: 'p', name: 'Test Partner', notes: '', phone: '', email: '' }],
    allocations: ['unpaid', 'review', 'not_applicable'].map((status, i) => ({ id: `a${i}`, partnerId: 'p', amountRupees: 10000, profitPercent: 3, receivedDate: `2025-0${i + 1}-01`, returnDate: '2025-02-01', creditCardId: 'c', notes: '', ...(status !== 'review' ? { cashback: { status, updatedAt: '2025-01-02T00:00:00Z' } } : {}) })),
    'capital-returns': [{ id: 'r', allocationId: 'a0', partnerId: 'p', amountRupees: 10000, returnedDate: '2025-02-01', notes: '' }],
    'profit-records': [], 'credit-cards': [{ id: 'c', cardName: 'Test Card', partnerId: 'p', notes: '' }],
  };
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    let result = data[url.split('/').at(-1)] ?? [];
    if (options?.method === 'PATCH' && url.endsWith('/cashback')) {
      const id = url.split('/').at(-2); const a = data.allocations.find(a => a.id === id);
      a.cashback = prepareCashback(JSON.parse(options.body), monthlyCashback(data.allocations).find(row => row.id === id), businessToday()); result = a;
    }
    return new Response(JSON.stringify({ status: 'success', data: result }));
  }));
  await store.loadAll();
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });
function open() { render(<MemoryRouter><RoleProvider><PendingProfitsPage /></RoleProvider></MemoryRouter>); return userEvent.setup(); }
it('keeps returned and older cashback pending across months, excludes not applicable, and explains why', async () => {
  const user = open();
  await user.selectOptions(screen.getByLabelText('Payment view'), 'cashback');
  await user.selectOptions(screen.getByLabelText('Cashback filter'), 'CB_UNPAID');
  const region = screen.getByRole('region', { name: 'Cashback sharing' });
  expect(within(region).getAllByRole('row')).toHaveLength(2);
  expect(within(region).getByText('Capital fully returned')).toBeTruthy();
  expect(within(region).getByText('Cashback unpaid')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Previous month' }));
  await user.click(screen.getByRole('button', { name: 'Previous month' }));
  expect(within(region).getByText('Cashback unpaid')).toBeTruthy();
  await user.selectOptions(screen.getByLabelText('Cashback filter'), 'CB_REVIEW');
  expect(within(region).getAllByRole('row')).toHaveLength(2);
  expect(within(region).getByText('Needs review')).toBeTruthy();
});
it('records and edits one payment, keeps sharing available after filter removal, and does not alter profit or principal', async () => {
  const user = open(); const pendingBefore = store.getAllocationSummaries()[0].profitPending;
  await user.selectOptions(screen.getByLabelText('Payment view'), 'cashback');
  await user.selectOptions(screen.getByLabelText('Cashback filter'), 'CB_UNPAID');
  await user.click(screen.getByRole('button', { name: 'Manage cashback' }));
  await user.selectOptions(screen.getByLabelText('Cashback status'), 'paid');
  expect(screen.getByLabelText('Date shared with partner').value).toBe(businessToday());
  await user.type(screen.getByLabelText('Cashback amount (₹)'), '500');
  await user.click(screen.getByRole('button', { name: 'Save cashback' }));
  expect(await screen.findByRole('link', { name: 'Share on WhatsApp' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Done' }));
  await user.selectOptions(screen.getByLabelText('Cashback filter'), 'CB_PAID');
  await user.click(screen.getByRole('button', { name: 'Edit cashback' }));
  await user.clear(screen.getByLabelText('Cashback amount (₹)'));
  await user.type(screen.getByLabelText('Cashback amount (₹)'), '750');
  await user.click(screen.getByRole('button', { name: 'Save cashback' }));
  await user.click(await screen.findByRole('button', { name: 'Done' }));
  await act(async () => { await store.loadAll(); });
  const events = store.getLedger().filter(e => e.eventType === 'CASHBACK_PAID');
  expect(events).toHaveLength(1); expect(events[0].amountRupees).toBe(750);
  expect(store.getAllocationSummaries()[0]).toMatchObject({ profitPending: pendingBefore, capitalOutstanding: 0 });
  const statement = buildStatement(store.getLedger(), 'p', '2025-01-01', businessToday());
  expect(statement.cashbackPaid).toBe(750); expect(statement.profitPaid).toBe(0); expect(statement.closingPrincipal).toBe(20000);
});

it('allows historical paid cashback without an amount and later fills it without affecting pending profit', async () => {
  const user = open();
  const pending = store.getAllocationSummaries()[0].profitPending;
  await user.selectOptions(screen.getByLabelText('Payment view'), 'cashback');
  await user.selectOptions(screen.getByLabelText('Cashback filter'), 'CB_UNPAID');
  await user.click(screen.getByRole('button', { name: 'Manage cashback' }));
  await user.selectOptions(screen.getByLabelText('Cashback status'), 'paid');
  expect(screen.getByLabelText('Cashback amount (₹)').required).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Save cashback' }));
  expect(await screen.findByText('Marked paid · Amount not recorded. You can add it later.')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Share on WhatsApp' })).toBeNull();
  expect(store.getLedger().find(e => e.eventType === 'CASHBACK_PAID').amountUnknown).toBe(true);
  expect(store.getPartnerSummaries()[0]).toMatchObject({ totalCashbackPaid: 0, totalProfitsReceived: 0, unknownCashbackCount: 1 });
  await act(async () => { await store.updateCashback('a0', { status: 'paid', amountRupees: 500, paidDate: businessToday() }); });
  expect(store.getPartnerSummaries()[0]).toMatchObject({ totalCashbackPaid: 500, totalProfitsReceived: 500, unknownCashbackCount: 0 });
  expect(store.getAllocationSummaries()[0].profitPending).toBe(pending);
});
it('keeps profit and cashback filters independent', async () => {
  const user = open();
  await user.selectOptions(screen.getByLabelText('Profit status'), 'PAID');
  await user.selectOptions(screen.getByLabelText('Payment view'), 'all');
  await user.selectOptions(screen.getByLabelText('Cashback filter'), 'CB_UNPAID');
  expect(screen.getByLabelText('Profit status').value).toBe('PAID');
  expect(within(screen.getByRole('table', { name: 'Cashback transactions' })).getAllByRole('row')).toHaveLength(2);
  expect(screen.queryByRole('table', { name: /pending profits/i })).toBeNull();
});

it('combines recorded earnings at allocation, partner, portfolio and statement levels while leaving regular profit pending', async () => {
  data['profit-records'] = [{ id: 'f', allocationId: 'a0', partnerId: 'p', amountRupees: 300, paidDate: businessToday(), notes: 'Partial payment · Remaining: ₹200' }];
  data.allocations[0].cashback = { status: 'paid', amountRupees: 500, paidDate: businessToday() };
  await store.loadAll();
  const allocation = store.getAllocationSummaries().find(a => a.id === 'a0');
  expect(allocation).toMatchObject({ totalProfitPaid: 300, totalCashbackPaid: 500, totalProfitsReceived: 800, profitPending: 200 });
  expect(store.getPartnerSummaries()[0]).toMatchObject({ totalProfitPaid: 300, totalCashbackPaid: 500, totalProfitsReceived: 800 });
  expect(store.getPortfolioTotals()).toMatchObject({ totalProfitPaid: 300, totalCashbackPaid: 500, totalProfitsReceived: 800 });
  expect(buildStatement(store.getLedger(), 'p', '2025-01-01', businessToday())).toMatchObject({ profitPaid: 300, cashbackPaid: 500, totalProfitsReceived: 800 });
});

it('links automatically excluded transactions to the selected cashback regardless of the current month or filter', async () => {
  data.allocations.push({ ...data.allocations[0], cashback: {status:'review'}, id:'later', amountRupees:12345, receivedDate:'2025-01-02' });
  await store.loadAll();
  const user = open();
  await user.selectOptions(screen.getByLabelText('Payment view'), 'cashback');
  await user.selectOptions(screen.getByLabelText('Cashback filter'), 'CB_NA');
  const table = screen.getByRole('table', {name:'Cashback transactions'});
  expect(within(table).getByText('₹12,345')).toBeTruthy();
  await user.click(within(table).getByRole('link', {name:'View selected cashback transaction'}));
  expect(screen.getByText(/Showing the linked cashback transaction/)).toBeTruthy();
  expect(within(table).getByText('Cashback unpaid')).toBeTruthy();
  expect(within(table).queryByText('₹12,345')).toBeNull();
  await user.click(screen.getByRole('button', {name:'Back to cashback list'}));
  expect(within(table).getByText('₹12,345')).toBeTruthy();
});

it('starts unselected transactions in review and immediately excludes peers when the user selects a later transaction', async () => {
  data.allocations = [data.allocations[0], {...data.allocations[0],id:'later',receivedDate:'2025-01-02'}].map(a=>({...a,cashback:{status:'review'}}));
  await store.loadAll();
  const user = open();
  await user.selectOptions(screen.getByLabelText('Payment view'), 'cashback');
  const table = screen.getByRole('table', {name:'Cashback transactions'});
  expect(within(table).getAllByText('Needs review')).toHaveLength(2);
  await user.click(within(table).getAllByRole('button',{name:'Review cashback'})[1]);
  await user.selectOptions(screen.getByLabelText('Cashback status'),'unpaid');
  await user.click(screen.getByRole('button',{name:'Save cashback'}));
  await user.click(await screen.findByRole('button',{name:'Done'}));
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  expect(within(table).getByText('Cashback unpaid')).toBeTruthy();
  await user.selectOptions(screen.getByLabelText('Cashback filter'),'CB_NA');
  expect(within(table).getByText('Not applicable')).toBeTruthy();
  expect(within(table).getByRole('link',{name:'View selected cashback transaction'}).getAttribute('href')).toBe('/pending-profits?cashback=later');
});

it('opens a selected historical paid transaction through its peer link outside the payment month', async () => {
  data.allocations[0].cashback = {status:'paid',amountRupees:500,paidDate:'2025-01-03'};
  data.allocations.push({...data.allocations[0],id:'peer',cashback:{status:'review'},receivedDate:'2025-01-02'});
  await store.loadAll();
  const user = open();
  await user.selectOptions(screen.getByLabelText('Payment view'),'cashback');
  await user.selectOptions(screen.getByLabelText('Cashback filter'),'CB_NA');
  await user.click(screen.getByRole('link',{name:'View selected cashback transaction'}));
  expect(within(screen.getByRole('table',{name:'Cashback transactions'})).getByText('₹500')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Edit cashback'})).toBeTruthy();
});
