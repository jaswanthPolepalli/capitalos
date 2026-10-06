// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ReportsPage } from '../client/src/pages/ReportsPage';
import { downloadCSV } from '../client/src/lib/csv';
vi.mock('../client/src/lib/csv', () => ({ downloadCSV: vi.fn() }));
vi.mock('recharts', () => ({ ResponsiveContainer: () => null, Bar: () => null, BarChart: () => null, CartesianGrid: () => null, Legend: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null }));
vi.mock('../client/src/useStore', () => ({ useStore: () => ({
  partners: [{ id: 'p', name: 'Partner A' }],
  ledger: [
    { partnerId: 'p', date: '2026-09-05', eventType: 'CAPITAL_RECEIVED', amountRupees: 1000 },
    { partnerId: 'p', date: '2026-08-05', eventType: 'CAPITAL_RETURNED', amountRupees: 200 },
    { partnerId: 'p', date: '2026-01-05', eventType: 'PROFIT_PAID', amountRupees: 50 },
    { partnerId: 'p', date: '2026-09-05', eventType: 'CASHBACK_PAID', amountRupees: 25 },
    { partnerId: 'p', date: '2025-12-05', eventType: 'CAPITAL_RECEIVED', amountRupees: 500 },
  ],
  allocationSummaries: [{ capitalOutstanding: 1300 }],
  partnerSummaries: [{ totalProfitPending: 100 }],
}) }));
beforeEach(() => { vi.stubGlobal('React', React); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-17T12:00:00')); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function open() { render(<MemoryRouter><ReportsPage /></MemoryRouter>); return userEvent.setup(); }
function partnerCells() { return within(screen.getByRole('table', { name: 'Partner activity' })).getAllByRole('row')[1].textContent; }
it('uses the same selected period for partner activity, export, and ledger link', async () => {
  const user = open();
  expect(partnerCells()).toBe('Partner A₹1,000₹0₹0₹25₹25');
  expect(screen.getByRole('link', { name: /View transactions/ }).getAttribute('href')).toBe('/ledger?from=2026-09-01&to=2026-09-30');
  await user.click(screen.getByRole('button', { name: 'Quarterly' }));
  expect(partnerCells()).toBe('Partner A₹1,000₹200₹0₹25₹25');
  await user.click(screen.getByRole('button', { name: 'Export report CSV' }));
  expect(downloadCSV.mock.calls[0][2]).toContainEqual(['Activity summary', 'Q3 2026', 'Total', 1000, 200, 0, 25, '']);
  expect(screen.getByText('₹1,300')).toBeTruthy();
});
it('uses calendar years and supports all-time activity', async () => {
  const user = open();
  await user.click(screen.getByRole('button', { name: 'Annual' }));
  expect(partnerCells()).toBe('Partner A₹1,000₹200₹50₹25₹75');
  expect(screen.getAllByText('2026 (Jan–Dec)').length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'All time' }));
  expect(partnerCells()).toBe('Partner A₹1,500₹200₹50₹25₹75');
  expect(screen.getByRole('link', { name: /View transactions/ }).getAttribute('href')).toBe('/ledger');
});
it('blocks incomplete and reversed custom ranges and includes both date boundaries', async () => {
  const user = open();
  await user.click(screen.getByRole('button', { name: 'Custom' }));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Export report CSV' }).disabled).toBe(true);
  await user.type(screen.getByLabelText('From date'), '2026-09-06');
  await user.type(screen.getByLabelText('To date'), '2026-09-05');
  expect(screen.getByRole('alert')).toBeTruthy();
  await user.clear(screen.getByLabelText('From date'));
  await user.type(screen.getByLabelText('From date'), '2026-09-05');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(partnerCells()).toBe('Partner A₹1,000₹0₹0₹25₹25');
  await user.clear(screen.getByLabelText('From date'));
  await user.type(screen.getByLabelText('From date'), '2026-09-06');
  await user.clear(screen.getByLabelText('To date'));
  await user.type(screen.getByLabelText('To date'), '2026-09-07');
  expect(screen.getByText('No transactions in this period.')).toBeTruthy();
});
