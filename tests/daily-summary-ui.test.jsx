// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SendSummaryEmail } from '../client/src/components/SendSummaryEmail';
import { operationsRequest } from '../client/src/lib/operationsApi';
const role = vi.hoisted(() => ({ isCFO: true }));
vi.mock('../client/src/context/RoleContext', () => ({ useRole: () => role }));
vi.mock('../client/src/lib/operationsApi', () => ({ operationsRequest: vi.fn() }));
beforeEach(() => { vi.stubGlobal('React', React); role.isCFO = true; vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('offers on-demand sending in CFO Reports and communicates recipient and schedule', async () => {
  operationsRequest.mockResolvedValue({ status: 'sent' });
  render(<SendSummaryEmail />); const user = userEvent.setup();
  expect(screen.getByText(/11:00 PM IST/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Send summary email' }));
  expect(screen.getByRole('status').textContent).toContain('jackgun9@gmail.com');
  expect(operationsRequest).toHaveBeenCalledWith('daily-summary/send', { requestId: expect.any(String) });
});
it('reuses the same request after a network failure and blocks clicks while sending', async () => {
  let finish; operationsRequest.mockImplementationOnce(() => new Promise((_, reject) => { finish = reject; })).mockResolvedValue({ status: 'sent' });
  render(<SendSummaryEmail />); const user = userEvent.setup();
  await user.click(screen.getByRole('button')); expect(screen.getByRole('button').disabled).toBe(true);
  finish(new Error('Network interrupted'));
  await screen.findByRole('alert'); await user.click(screen.getByRole('button'));
  expect(operationsRequest.mock.calls[0][1]).toEqual(operationsRequest.mock.calls[1][1]);
});
it('does not claim a mock or uncertain result was sent', async () => {
  operationsRequest.mockResolvedValueOnce({ status: 'mock' }).mockResolvedValue({ status: 'unconfirmed' });
  render(<SendSummaryEmail />); const user = userEvent.setup();
  await user.click(screen.getByRole('button')); expect(screen.getByRole('status').textContent).toContain('no email was sent');
  await user.click(screen.getByRole('button')); await waitFor(() => expect(screen.getByRole('button').disabled).toBe(true));
  expect(screen.getByRole('alert').textContent).toContain('Check the inbox');
});
it('does not offer sending in CEO read-only view', () => {
  role.isCFO = false; render(<SendSummaryEmail />); expect(screen.queryByRole('button')).toBeNull();
});
