// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CloseProfitPanel } from '../client/src/components/CloseProfitPanel';
import { closeProfit, addProfitRecord } from '../client/src/store';
import { RecordProfitModal } from '../client/src/components/RecordProfitModal';
vi.mock('../client/src/store', () => ({ closeProfit: vi.fn(), addProfitRecord: vi.fn(), getAllocations: () => [], updateAllocationReturnDate: vi.fn() }));
beforeEach(() => { vi.stubGlobal('React', React); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const props = { allocationId: 'a', partnerId: 'p', pendingAmount: 6000, partnerName: 'Test Partner', canRecur: true, onCancel: vi.fn(), onClose: vi.fn() };
it('requires explicit acceptance, allows cancellation and never asks for an amount', async () => {
  render(<CloseProfitPanel {...props} />);
  expect(screen.getByRole('alert').textContent).toContain('₹6,000');
  expect(screen.queryByRole('spinbutton')).toBeNull();
  expect(closeProfit).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));
  expect(props.onCancel).toHaveBeenCalledOnce(); expect(closeProfit).not.toHaveBeenCalled();
});
it('confirms zero closure with explicit recurrence and blocks repeat clicks while saving', async () => {
  let resolve; closeProfit.mockImplementation(() => new Promise(r => { resolve = r; }));
  render(<CloseProfitPanel {...props} />); const user = userEvent.setup();
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Accept and close profit' }));
  expect(closeProfit).toHaveBeenCalledExactlyOnceWith({ allocationId: 'a', partnerId: 'p', expectedPending: 6000, confirmed: true, recur: true });
  expect(screen.getByRole('button', { name: 'Closing…' }).disabled).toBe(true);
  resolve({}); await screen.findByRole('status');
  expect(screen.getByRole('status').textContent).toContain('No money');
});
it('keeps a failed closure open and defaults recurrence to off', async () => {
  closeProfit.mockRejectedValue(new Error('Balance changed'));
  render(<CloseProfitPanel {...props} canRecur={false} />);
  expect(screen.queryByRole('checkbox')).toBeNull();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Accept and close profit' }));
  expect(closeProfit.mock.calls[0][0].recur).toBe(false);
  expect(screen.getByText('Balance changed')).toBeTruthy();
  expect(props.onClose).not.toHaveBeenCalled();
});

it('opens the warning from the payment form with a blank amount and closes without recording a payment', async () => {
  closeProfit.mockResolvedValue({ amountRupees: 0 });
  render(<RecordProfitModal allocationId="a" partnerId="p" pendingAmount={6000} expectedMonthlyProfit={6000} allocationLabel="Test contribution" onClose={props.onClose} />);
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText(/Partner \+ CFO amount.*₹/));
  await user.click(screen.getByRole('button', { name: 'Close profit without payment' }));
  expect(closeProfit).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Accept and close profit' }));
  expect(await screen.findByRole('status')).toBeTruthy();
  expect(closeProfit).toHaveBeenCalledOnce();
  expect(addProfitRecord).not.toHaveBeenCalled();
});

it('shows the closure snapshot and a user-controlled WhatsApp link with email outcome', async () => {
  const message = 'Profit Closure Confirmation\nCurrent profit: ₹0\nTotal return: 4.00%';
  closeProfit.mockResolvedValue({ amountRupees: 0, confirmation: { message, phone: '9999999999', emailStatus: 'unconfirmed' } });
  render(<CloseProfitPanel {...props} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Accept and close profit' }));
  const link = await screen.findByRole('link', { name: 'Share on WhatsApp' });
  expect(new URL(link.href).searchParams.get('text')).toBe(message);
  expect(screen.getByText(/Email delivery could not be confirmed/)).toBeTruthy();
  expect(closeProfit).toHaveBeenCalledOnce();
});
