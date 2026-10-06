// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { buildCombination } from '../functions/capitalos-api/combinations.mjs';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });

it('selects two individual contributions, confirms terms, and displays one entry with original history', async () => {
  vi.stubGlobal('React', React);
  sessionStorage.setItem('cos_role_unlocked', '1');
  const data = {
    partners: [{ id: 'p', name: 'Example Partner', phone: '', email: '', notes: '' }],
    allocations: [50000, 100000].map((amountRupees, i) => ({ id: String(i + 1), partnerId: 'p', amountRupees, profitPercent: 3, receivedDate: `2025-08-${i ? '20' : '05'}`, returnDate: null, creditCardId: null, notes: '' })),
    'capital-returns': [], 'profit-records': [], 'credit-cards': [],
  };
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (url.endsWith('/revert-combination')) {
      data.allocations = data.allocations.filter(a => a.id !== 'combined');
      return new Response(JSON.stringify({ status: 'success', data: { id: 'combined' } }));
    }
    if (url.endsWith('/combine')) {
      const entry = { ...buildCombination(JSON.parse(options.body), data.allocations, [], []), id: 'combined' };
      data.allocations.push(entry);
      return new Response(JSON.stringify({ status: 'success', data: entry }));
    }
    return new Response(JSON.stringify({ status: 'success', data: data[url.split('/').pop()] || [] }));
  }));
  const { CapitalContributionsPage } = await import('../client/src/pages/CapitalContributionsPage');
  const { RoleProvider } = await import('../client/src/context/RoleContext');
  const user = userEvent.setup();
  render(<MemoryRouter><RoleProvider><CapitalContributionsPage /></RoleProvider></MemoryRouter>);
  await user.click(await screen.findByRole('checkbox', { name: /Select contribution 1,/ }));
  await user.click(screen.getByRole('checkbox', { name: /Select contribution 2,/ }));
  await user.click(screen.getByRole('button', { name: 'Combine selected (2)' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('₹1,50,000')).toBeTruthy();
  await user.clear(within(dialog).getByLabelText('New monthly profit rate (%)'));
  await user.type(within(dialog).getByLabelText('New monthly profit rate (%)'), '4');
  await user.click(within(dialog).getByRole('button', { name: 'Confirm combination' }));
  const table = screen.getByRole('table', { name: 'Capital contributions' });
  expect(await within(table).findByRole('button', { name: 'View combination' })).toBeTruthy();
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  expect(within(table).queryByText(/₹50,000 given/)).toBeNull();
  await user.click(within(table).getByRole('button', { name: 'View combination' }));
  const history = screen.getByRole('dialog', { name: 'Combined capital history' });
  expect(within(history).getByText(/₹50,000 given/)).toBeTruthy();
  expect(within(history).getByText(/₹1,00,000 given/)).toBeTruthy();
  expect(within(history).getByText(/first profit due/)).toBeTruthy();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  await user.click(screen.getByRole('checkbox', { name: 'Show original combined entries' }));
  expect(within(table).getAllByRole('row')).toHaveLength(4);
  await user.click(within(table).getByRole('button', { name: 'View combination' }));
  await user.click(screen.getByRole('button', { name: 'Revert combination' }));
  expect(screen.getByRole('dialog').textContent).toContain('original dates, rates, return dates');
  await user.click(screen.getByRole('button', { name: 'Confirm revert' }));
  expect(within(table).queryByRole('button', { name: 'View combination' })).toBeNull();
  expect(within(table).getAllByRole('row')).toHaveLength(3);
  expect(within(table).getAllByRole('checkbox')).toHaveLength(2);
});
