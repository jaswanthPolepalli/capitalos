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
  await user.click(screen.getByRole('button', { name: /Send summary email|Sending summary/ })); expect(screen.getByRole('button', { name: /Send summary email|Sending summary/ }).disabled).toBe(true);
  finish(new Error('Network interrupted'));
  await screen.findByRole('alert'); await user.click(screen.getByRole('button', { name: /Send summary email|Sending summary/ }));
  expect(operationsRequest.mock.calls[0][1]).toEqual(operationsRequest.mock.calls[1][1]);
});
it('does not claim a mock or uncertain result was sent', async () => {
  operationsRequest.mockResolvedValueOnce({ status: 'mock' }).mockResolvedValue({ status: 'unconfirmed' });
  render(<SendSummaryEmail />); const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Send summary email|Sending summary/ })); expect(screen.getByRole('status').textContent).toContain('no email was sent');
  await user.click(screen.getByRole('button', { name: /Send summary email|Sending summary/ })); await waitFor(() => expect(screen.getByRole('button', { name: /Send summary email|Sending summary/ }).disabled).toBe(true));
  expect(screen.getByRole('alert').textContent).toContain('Check the inbox');
});
it('does not offer sending in CEO read-only view', () => {
  role.isCFO = false; render(<SendSummaryEmail />); expect(screen.queryByRole('button')).toBeNull();
});
it('downloads the PDF without requesting an email', async () => {
  const create = vi.fn(() => 'blob:summary');
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    expect(this.download).toBe('CapitalOS-Daily-Summary-2026-10-08.pdf');
    expect(this.href).toBe('blob:summary');
  });
  operationsRequest.mockResolvedValue({ status: 'ready', filename: 'CapitalOS-Daily-Summary-2026-10-08.pdf', contentBase64: btoa('%PDF-test') });
  try {
    render(<SendSummaryEmail />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(operationsRequest).toHaveBeenCalledExactlyOnceWith('daily-summary/download', {});
    expect(create.mock.calls[0][0].type).toBe('application/pdf');
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toContain('No email was sent');
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:summary'), { timeout: 1500 });
  } finally { click.mockRestore(); }
});
it('allows retrying a failed download and keeps downloading available after uncertain email delivery', async () => {
  operationsRequest.mockResolvedValueOnce({ status: 'unconfirmed' }).mockRejectedValueOnce(new Error('Download failed')).mockResolvedValue({ status: 'mock' });
  render(<SendSummaryEmail />); const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Send summary email' }));
  expect(screen.getByRole('button', { name: 'Download PDF' }).disabled).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Download PDF' }));
  expect(screen.getByRole('alert').textContent).toContain('Download failed');
  await user.click(screen.getByRole('button', { name: 'Download PDF' }));
  expect(screen.getByRole('status').textContent).toContain('Local preview');
});
