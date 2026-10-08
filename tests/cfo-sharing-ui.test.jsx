// @vitest-environment jsdom
import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModalAccessibility } from '../client/src/components/ModalAccessibility';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CFOSharePage } from '../client/src/pages/CFOSharePage';
import { PublicPortalPage } from '../client/src/pages/PublicPortalPage';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
import * as store from '../client/src/store';

beforeEach(async () => {
  vi.stubGlobal('React', React);
  const h = createApiHarness(baseData());
  await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 7000, paidDate: '2026-10-08', notes: '' });
  vi.stubGlobal('fetch', vi.fn(async url => new Response(JSON.stringify(await h.request('GET', String(url).replace('/server/capitalos-api/', ''))))));
  await store.loadAll();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('lists invested amounts and CFO earnings with only the requested columns', async () => {
  render(<MemoryRouter><CFOSharePage /></MemoryRouter>);
  const table = await screen.findByRole('table', { name: 'CFO share transactions' });
  expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Date', 'Partner', 'Amount', 'CFO share', 'CFO %']);
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  expect(within(table).getByText('₹10,000')).toBeTruthy();
  expect(within(table).getByText('₹2,000')).toBeTruthy();
  expect(within(table).getByText('20%')).toBeTruthy();
  expect(within(table).queryByText('₹7,000')).toBeNull();
  expect(within(table).queryByText('₹5,000')).toBeNull();
});
it('shows partner amounts without CFO amounts, split details or navigation in the partner portal', async () => {
  render(<MemoryRouter initialEntries={['/p/partner-p']}><Routes><Route path="/p/:token" element={<PublicPortalPage />} /></Routes></MemoryRouter>);
  await screen.findAllByText('Synthetic Partner');
  expect(screen.getAllByText('₹5,000').length).toBeGreaterThan(0);
  for (const text of ['₹7,000', '₹2,000', 'CFO Share', 'Partner share', 'CFO share']) expect(screen.queryByText(text)).toBeNull();
  expect(document.body.textContent).not.toContain('PROFIT_SPLIT');
});

it('opens the transaction details from the row and supports keyboard dismissal', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><ModalAccessibility /><CFOSharePage /></MemoryRouter>);
  const table = await screen.findByRole('table', { name: 'CFO share transactions' });
  await user.click(within(table).getByText('₹2,000'));
  const dialog = screen.getByRole('dialog', { name: 'Transaction details' });
  const value = label => within(dialog).getByText(label, { selector: 'dt' }).nextElementSibling.textContent;
  expect(value('Given date')).toMatch(/Jan.*2026/);
  expect(value('Return date')).toMatch(/Dec.*2026/);
  expect(value('Outstanding capital (current)')).toBe('₹9,000');
  expect(value('Partner share')).toBe('₹5,000');
  expect(value('Partner profit %')).toBe('50%');
  expect(value('CFO share')).toBe('₹2,000');
  expect(value('CFO %')).toBe('20%');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  const button = within(table).getByRole('button', { name: /View transaction/ });
  button.focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('dialog')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Close transaction details' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
