// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BulkPaymentPage } from '../client/src/pages/BulkPaymentPage';
import { PortalLinksPage } from '../client/src/pages/PortalLinksPage';
import { MobileNavigation } from '../client/src/layout/MobileNavigation';

const state = vi.hoisted(() => ({ isCFO: true }));
vi.mock('../client/src/context/RoleContext', () => ({ useRole: () => ({ isCFO: state.isCFO }) }));
vi.mock('../client/src/useStore', () => ({ useStore: () => ({
  hasData: true, status: 'ready', isStale: false,
  partners: [{ id: 'a', name: 'Arun' }, { id: 'b', name: 'Priya' }],
  allocationSummaries: [{ id: 'allocation', partnerId: 'a', partner: { name: 'Arun' }, amountRupees: 10000, profitPercent: 3, profitPending: 300, isFullyReturned: false }],
}) }));
vi.mock('../client/src/store', () => ({ addProfitRecord: vi.fn() }));
beforeEach(() => { vi.stubGlobal('React', React); state.isCFO = true; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mount = component => { render(<MemoryRouter>{component}</MemoryRouter>); return userEvent.setup(); };

it('allows deselecting and selecting all payments outside the hidden table header', async () => {
  const user = mount(<BulkPaymentPage />);
  const deselect = screen.getByRole('button', { name: 'Deselect all' });
  expect(deselect.closest('thead')).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('1 of 1 selected');
  await user.click(deselect);
  expect(screen.getByRole('button', { name: /Review 0 payments/ }).disabled).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Select all' }));
  await user.click(screen.getByRole('button', { name: /Review 1 payment/ }));
  expect(screen.getByLabelText('Amount (₹) *').value).toBe('300');
});
it('gives bulk selection an identifiable pressed state and names financial values', async () => {
  const user = mount(<BulkPaymentPage />);
  const toggle = screen.getByRole('button', { name: /Deselect Arun/ });
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('table', { name: 'Select payments' }).querySelector('[data-label="Pending profit"]').textContent).toContain('300');
  await user.click(toggle);
  expect(screen.getByRole('button', { name: /Select Arun/ }).getAttribute('aria-pressed')).toBe('false');
});
it('does not expose payment controls in the read-only role', () => {
  state.isCFO = false;
  mount(<BulkPaymentPage />);
  expect(screen.queryByRole('button', { name: 'Deselect all' })).toBeNull();
});
it('filters partner portals and recovers from an empty search', async () => {
  const user = mount(<PortalLinksPage />);
  const search = screen.getByRole('searchbox', { name: 'Find a partner portal' });
  await user.type(search, 'priya');
  expect(screen.getByText('Priya')).toBeTruthy();
  expect(screen.queryByText('Arun')).toBeNull();
  await user.clear(search);
  await user.type(search, 'missing');
  expect(screen.getByRole('status').textContent).toContain('No partner portals');
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByText('Arun')).toBeTruthy();
});
it('contains drawer focus and restores the More trigger after Escape', async () => {
  const user = mount(<div className="app-shell"><button>Background control</button><MobileNavigation /></div>);
  const more = screen.getByRole('button', { name: 'More' });
  await user.click(more);
  const dialog = screen.getByRole('dialog');
  const close = within(dialog).getByRole('button', { name: 'Close navigation' });
  expect(document.activeElement).toBe(close);
  expect(document.querySelector('.app-shell').inert).toBe(true);
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(within(dialog).getAllByRole('link').at(-1));
  await user.tab();
  expect(document.activeElement).toBe(close);
  await user.keyboard('{Escape}');
  expect(document.activeElement).toBe(more);
  expect(document.querySelector('.app-shell').inert).toBe(false);
});

it('expands secondary record context without triggering the row action', async () => {
  const { RecordRow } = await import('../client/src/components/RecordRow');
  const rowAction = vi.fn();
  const user = mount(<table className="data-table"><tbody><RecordRow onClick={rowAction}>
    <td data-label="Outstanding">₹10,000</td><td data-label="Source">Cash</td><td><button>Edit contribution</button></td>
  </RecordRow></tbody></table>);
  const row = screen.getByRole('row');
  expect(row.getAttribute('data-details-expanded')).toBe('false');
  expect(screen.getByText('₹10,000').getAttribute('data-mobile-secondary')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Show details' }));
  expect(row.getAttribute('data-details-expanded')).toBe('true');
  expect(screen.getByRole('button', { name: 'Hide details' }).getAttribute('aria-expanded')).toBe('true');
  expect(rowAction).not.toHaveBeenCalled();
});
