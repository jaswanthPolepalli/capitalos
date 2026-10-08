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
  expect(addProfitRecord).toHaveBeenCalledWith(expect.objectContaining({ allocationId: 'a', partnerId: 'p', amountRupees: 300 }));
  expect(await screen.findByText('Payment Recorded')).toBeTruthy();
});
it('keeps a failed payment editable and exposes the error', async () => {
  addProfitRecord.mockRejectedValueOnce(new Error('Unable to save'));
  const user = open();
  await user.click(screen.getByRole('button', { name: 'Record Payment' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Unable to save');
  expect(screen.getByLabelText('Amount paid (₹) *').value).toBe('300');
});
