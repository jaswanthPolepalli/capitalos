// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditCardsPage } from '../client/src/pages/CreditCardsPage';
import { ModalAccessibility } from '../client/src/components/ModalAccessibility';

const mock = vi.hoisted(() => ({ state: {} }));
vi.mock('../client/src/useStore', () => ({ useStore: () => mock.state }));
vi.mock('../client/src/context/RoleContext', () => ({ useRole: () => ({ isCFO: true }) }));
beforeEach(() => {
  vi.stubGlobal('React', React);
  const card = (id, partnerId) => ({ id, partnerId, cardName: `Card ${id}`, cardLimit: 10000, pendingLimit: 0, billGenerationDate: '2026-10-01', dueDate: '2026-10-20', notes: '' });
  const allocation = (id, creditCardId) => ({ id, creditCardId, partnerId: 'p', amountRupees: 1000, receivedDate: '2026-09-01', profitPercent: 2, returnDate: '2026-10-20', notes: 'Travel contribution' });
  const event = (id, eventType, date, createdAt, allocationId = 'a') => ({ id, eventType, date, createdAt, allocationId, partnerId: 'p', refId: id, amountRupees: 100, notes: `Note ${id}` });
  mock.state = {
    partners: [{ id: 'p', name: 'Partner' }], creditCards: [card('one', 'p'), card('two', 'p'), card('orphan', 'missing')],
    allocationSummaries: [], allocations: [allocation('a', 'one'), allocation('b', 'two')],
    ledger: [
      event('older-date', 'CAPITAL_RECEIVED', '2026-09-01', '2026-10-06T10:00:00Z'),
      event('early', 'CAPITAL_RETURNED', '2026-10-05', '2026-10-05T09:00:00Z'),
      event('late', 'PROFIT_PAID', '2026-10-05', '2026-10-05T12:00:00Z'),
      { ...event('cashback', 'CASHBACK_PAID', '2026-10-06', '2026-10-06T08:00:00Z'), amountUnknown: true, amountRupees: 0 },
      event('other-card', 'PROFIT_PAID', '2026-10-06', '2026-10-06T09:00:00Z', 'b'),
      event('cash', 'CAPITAL_RECEIVED', '2026-10-06', '2026-10-06T09:00:00Z', 'cash'),
    ],
  };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function open() {
  render(<><ModalAccessibility /><CreditCardsPage /></>);
  fireEvent.click(screen.getByRole('button', { name: 'View transactions for Card one' }));
  return within(screen.getByRole('dialog'));
}
const change = (element, value) => fireEvent.change(element, { target: { value } });

it('shows only the selected card’s complete recorded history, by transaction date and same-day creation time', () => {
  const original = [...mock.state.ledger];
  const dialog = open();
  expect(dialog.getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Date', 'Transaction type', 'Amount', 'Notes', '%']);
  const rows = dialog.getAllByRole('row').slice(1);
  expect(rows.every(row => within(row).getAllByRole('cell').length === 5)).toBe(true);
  expect(rows.map(row => within(row).getByText(/^Note /).textContent)).toEqual(['Note cashback', 'Note late', 'Note early', 'Note older-date']);
  expect(dialog.queryByText('Note other-card')).toBeNull();
  expect(dialog.queryByText('Note cash')).toBeNull();
  expect(dialog.getByText('Amount not recorded')).toBeTruthy();
  expect(dialog.getAllByText('2%')).toHaveLength(4);
  expect(mock.state.ledger).toEqual(original);
});

it('combines inclusive date bounds, transaction type and case-insensitive search, and clears filters', () => {
  const dialog = open();
  change(dialog.getByLabelText('From date'), '2026-10-05');
  change(dialog.getByLabelText('To date'), '2026-10-05');
  expect(dialog.getAllByRole('row').slice(1)).toHaveLength(2);
  change(dialog.getByLabelText('Transaction type'), 'PROFIT_PAID');
  change(dialog.getByRole('searchbox'), ' LATE ');
  expect(dialog.getAllByRole('row').slice(1)).toHaveLength(1);
  expect(dialog.getByText('Note late')).toBeTruthy();
  change(dialog.getByRole('searchbox'), 'nothing matches');
  expect(dialog.getByText('No matching transactions')).toBeTruthy();
  fireEvent.click(dialog.getByRole('button', { name: 'Clear transaction filters' }));
  expect(dialog.getAllByRole('row').slice(1)).toHaveLength(4);
  change(dialog.getByLabelText('From date'), '2026-10-06');
  change(dialog.getByLabelText('To date'), '2026-10-01');
  expect(dialog.getByRole('alert').textContent).toContain('From date must be on or before To date');
});

it('supports keyboard opening, focus containment, Escape and restoring focus', async () => {
  const user = userEvent.setup();
  render(<><ModalAccessibility /><CreditCardsPage /></>);
  const trigger = screen.getByRole('button', { name: 'View transactions for Card one' });
  trigger.focus();
  await user.keyboard('{Enter}');
  const dialog = within(screen.getByRole('dialog'));
  await waitFor(() => expect(document.activeElement).toBe(dialog.getByRole('button', { name: 'Close card transactions' })));
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(dialog.getByRole('button', { name: 'Close', exact: true }));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it('opens from row space and unassigned cards, resets filters on reopening, and keeps edit actions separate', () => {
  const dialog = open();
  change(dialog.getByRole('searchbox'), 'missing');
  fireEvent.click(dialog.getByRole('button', { name: 'Close', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'View transactions for Card one' }).closest('tr'));
  expect(within(screen.getByRole('dialog')).getAllByRole('row').slice(1)).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Close card transactions' }));
  fireEvent.click(screen.getByRole('button', { name: 'View transactions for Card orphan' }));
  expect(within(screen.getByRole('dialog')).getByText('No transactions yet')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close card transactions' }));
  fireEvent.click(screen.getAllByTitle('Edit card')[0]);
  expect(screen.getByRole('dialog').textContent).toContain('Edit Credit Card');
  expect(screen.queryByText('Card one transactions')).toBeNull();
});
