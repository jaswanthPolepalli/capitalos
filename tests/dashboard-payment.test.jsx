// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordProfitModal } from '../client/src/components/RecordProfitModal';
import { addProfitRecord } from '../client/src/store';
vi.mock('../client/src/store', () => ({ getAllocations: () => [{ id: 'a', amountRupees: 10000 }], addProfitRecord: vi.fn(), updateAllocationReturnDate: vi.fn() }));
beforeEach(() => { vi.stubGlobal('React', React); vi.clearAllMocks(); addProfitRecord.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function open() {
  render(<RecordProfitModal embedded allocationId="a" partnerId="p" partnerName="Arun" pendingAmount={300} expectedMonthlyProfit={800} allocationLabel="Cash contribution" canRecur={false} onClose={() => {}} />);
  return userEvent.setup();
}
it('records a payment from the embedded form without adding a nested dialog', async () => {
  const user = open();
  expect(screen.queryByRole('dialog')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Record Payment' }));
  expect(addProfitRecord).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  expect(addProfitRecord).toHaveBeenCalledWith(expect.objectContaining({ allocationId: 'a', partnerId: 'p', amountRupees: 420 }));
  expect(await screen.findByText('Payment Recorded')).toBeTruthy();
});
it('keeps a failed payment editable and exposes the error', async () => {
  addProfitRecord.mockRejectedValueOnce(new Error('Unable to save'));
  const user = open();
  await user.click(screen.getByRole('button', { name: 'Record Payment' }));
  expect(addProfitRecord).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Unable to save');
  expect(screen.getByLabelText('Partner + CFO amount (₹) *').value).toBe('420');
});
it('previews the final rate, allows adjustment and confirms exactly the reviewed split', async () => {
  const user = open();
  expect(screen.getByText('Final partner profit: 3%')).toBeTruthy();
  await user.click(screen.getByRole('checkbox', { name: 'Adjust partner profit %' }));
  const rate = screen.getByLabelText('Partner profit % of invested capital');
  await user.clear(rate); await user.type(rate, '2');
  expect(screen.getByText('Partner share: ₹200')).toBeTruthy();
  expect(screen.getByText('CFO share: ₹220')).toBeTruthy();
  expect(screen.getByText('Final partner profit: 2%')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Record Payment' }));
  expect(screen.getByRole('heading', { name: 'Confirm profit allocation' })).toBeTruthy();
  expect(addProfitRecord).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Back to edit' }));
  expect(screen.getByLabelText('Partner profit % of invested capital').value).toBe('2');
  await user.click(screen.getByRole('button', { name: 'Record Payment' }));
  await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  expect(addProfitRecord).toHaveBeenCalledWith(expect.objectContaining({ amountRupees: 420, partnerProfitPercent: 2 }));
});
it('rejects a rate above the combined amount and restores the standard split when unchecked', async () => {
  const user = open();
  await user.click(screen.getByRole('checkbox', { name: 'Adjust partner profit %' }));
  await user.clear(screen.getByLabelText('Partner profit % of invested capital'));
  await user.type(screen.getByLabelText('Partner profit % of invested capital'), '5');
  await user.click(screen.getByRole('button', { name: 'Record Payment' }));
  expect(addProfitRecord).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Confirm payment' })).toBeNull();
  await user.click(screen.getByRole('checkbox', { name: 'Adjust partner profit %' }));
  expect(screen.getByText('Partner share: ₹300')).toBeTruthy();
  expect(screen.getByText('CFO share: ₹120')).toBeTruthy();
});
it('keeps all entered profit with the partner when No CFO split is selected and confirms that choice', async () => {
  const user = open();
  await user.click(screen.getByRole('checkbox', { name: /No CFO split/ }));
  expect(screen.getByText('Partner share: ₹420')).toBeTruthy();
  expect(screen.getByText('CFO share: ₹0')).toBeTruthy();
  expect(screen.getByText('Final partner profit: 4.2%')).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Adjust partner profit %' }).disabled).toBe(true);
  const amount = screen.getByLabelText('Partner + CFO amount (₹) *');
  await user.clear(amount); await user.type(amount, '7000');
  expect(screen.getByText('Partner share: ₹7,000')).toBeTruthy();
  await user.click(screen.getByRole('checkbox', { name: /No CFO split/ }));
  expect(screen.getByText('Partner share: ₹5,000')).toBeTruthy();
  await user.click(screen.getByRole('checkbox', { name: /No CFO split/ }));
  await user.click(screen.getByRole('button', { name: 'Record Payment' }));
  expect(screen.getByText('Partner share: ₹7,000')).toBeTruthy();
  expect(screen.getByText('CFO share: ₹0')).toBeTruthy();
  expect(addProfitRecord).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  expect(addProfitRecord).toHaveBeenCalledWith(expect.objectContaining({ amountRupees: 7000, noCfoSplit: true, partnerProfitPercent: null }));
});
it('accepts a direct partner amount, updates the percentage and saves the reviewed exact amount', async () => {
  const user = open();
  await user.click(screen.getByRole('checkbox', { name: 'Adjust partner profit %' }));
  const amount = screen.getByLabelText('Or partner amount (₹)');
  await user.clear(amount); await user.type(amount, '225');
  expect(screen.getByLabelText('Partner profit % of invested capital').value).toBe('2.25');
  expect(screen.getByText('Partner share: ₹225')).toBeTruthy();
  expect(screen.getByText('CFO share: ₹195')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Record Payment' }));
  expect(screen.getByText('Partner share: ₹225')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Confirm payment' }));
  expect(addProfitRecord).toHaveBeenCalledWith(expect.objectContaining({ amountRupees: 420, partnerAmountRupees: 225, partnerProfitPercent: null }));
});
