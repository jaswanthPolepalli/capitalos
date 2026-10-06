// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LedgerPage } from '../client/src/pages/LedgerPage';
import * as store from '../client/src/store';

let scrollIntoView;
beforeEach(async () => {
  vi.stubGlobal('React', React);
  vi.useFakeTimers();
  scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
  const data = {
    partners: [{ id: 'p', name: 'Partner', notes: '', phone: '', email: '' }],
    allocations: Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1), partnerId: 'p', amountRupees: 100000, profitPercent: 3,
      receivedDate: '2026-01-01', returnDate: null, creditCardId: null, notes: `Entry ${i + 1}`,
    })),
  };
  vi.stubGlobal('fetch', vi.fn(async url => new Response(JSON.stringify({
    status: 'success', data: data[url.split('/').at(-1)] ?? [],
  }))));
  await store.loadAll();
});
afterEach(() => {
  cleanup();
  delete HTMLElement.prototype.scrollIntoView;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function open(url = '/ledger') {
  render(<MemoryRouter initialEntries={[url]}><LedgerPage /></MemoryRouter>);
  await act(async () => { await store.loadAll(); });
}

it('jumps to a linked entry on a later page only once, including during hover and refresh', async () => {
  const target = store.getLedger()[26];
  await open(`/ledger?highlight=${target.id}`);
  expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(scrollIntoView.mock.instances[0].textContent).toContain(target.notes);
  const note = screen.getByText(target.notes);
  fireEvent.mouseEnter(note);
  fireEvent.mouseLeave(note);
  await act(async () => { await store.loadAll(); });
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
});

it('clears the highlight after four seconds and does not pull back on freshness ticks or polling', async () => {
  const target = store.getLedger()[0];
  await open(`/ledger?highlight=${target.id}`);
  expect(screen.getByText(target.notes).closest('tr').classList.contains('table-row--highlighted')).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(screen.getByText(target.notes).closest('tr').classList.contains('table-row--highlighted')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(56000); });
  expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
});

it('leaves ordinary ledger browsing and filters in place during background updates', async () => {
  await open();
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'p' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(screen.getAllByRole('combobox')[0].value).toBe('p');
  expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  expect(scrollIntoView).not.toHaveBeenCalled();
});
