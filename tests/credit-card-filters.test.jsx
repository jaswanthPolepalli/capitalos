// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreditCardsPage } from '../client/src/pages/CreditCardsPage';

const mock = vi.hoisted(() => ({ state: {} }));
vi.mock('../client/src/useStore', () => ({ useStore: () => mock.state }));
beforeEach(() => {
  vi.stubGlobal('React', React);
  const card = (id, partnerId, cardName, pendingLimit, notes = '') => ({
    id, partnerId, cardName, pendingLimit, notes, cardLimit: 10000,
    billGenerationDate: '2026-09-01', dueDate: '2026-09-20',
  });
  mock.state = {
    partners: [{ id: 'p', name: 'Paparao' }, { id: 'l', name: 'Lahari' }],
    creditCards: [card('a', 'p', 'UNI RUPAY', 0), card('b', 'p', 'HDFC VISA', 0, 'Travel card'), card('c', 'l', 'SBI', 9000), card('d', 'missing', 'Unassigned card', 0)],
    allocationSummaries: [{ creditCardId: 'a', capitalOutstanding: 8000, isFullyReturned: false }, { creditCardId: 'b', capitalOutstanding: 0, isFullyReturned: true }],
  };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const select = (label, value) => fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value } });
const summary = label => screen.getByText(label, { selector: 'span' }).parentElement.textContent;

it('combines partner and utilisation filters and keeps both financial summaries consistent', () => {
  render(<CreditCardsPage />);
  select('Filter by partner', 'p');
  select('Filter by utilisation', 'HIGH');
  expect(screen.getByRole('status').textContent).toBe('1 of 4 cards');
  expect(screen.getByText('UNI RUPAY')).toBeTruthy();
  expect(screen.queryByText('SBI')).toBeNull();
  expect(screen.queryByText('HDFC VISA')).toBeNull();
  expect(summary('Total card capacity')).toContain('₹10,000');
  expect(summary('Total limit')).toContain('₹10,000');
  const utilised = screen.getAllByText('Total utilised').map(node => node.parentElement.textContent);
  expect(utilised.every(text => text.includes('₹8,000'))).toBe(true);
  expect(screen.getAllByText('Total available').every(node => node.parentElement.textContent.includes('₹2,000'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByRole('status').textContent).toBe('4 of 4 cards');
  select('Filter by utilisation', 'HIGH');
  expect(screen.getByText('SBI')).toBeTruthy(); // Manual utilisation also counts.
  expect(screen.getByRole('status').textContent).toBe('2 of 4 cards');
});

it('searches notes without losing other filters and can recover from no matches', () => {
  render(<CreditCardsPage />);
  select('Filter by partner', 'p');
  select('Filter by utilisation', 'UNUSED');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search credit cards' }), { target: { value: ' TRAVEL ' } });
  expect(screen.getByText('HDFC VISA')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('1 of 4 cards');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing result' } });
  expect(screen.getByText('No matching cards')).toBeTruthy();
  expect(screen.queryByText('No credit cards yet')).toBeNull();
  expect(summary('Total card capacity')).toContain('₹0');
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('status').textContent).toBe('1 of 4 cards');
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  select('Filter by partner', 'UNASSIGNED');
  expect(screen.getByText('Unassigned card')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('1 of 4 cards');
});
