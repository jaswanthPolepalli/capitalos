import { afterEach, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
afterEach(() => vi.unstubAllEnvs());
it('sends an on-demand PDF to the fixed address regardless of caller recipient and deduplicates a retry', async () => {
  const send = vi.fn().mockResolvedValue({ accepted: ['jackgun9@gmail.com'] });
  const h = createApiHarness(baseData(), undefined, send);
  const body = { requestId: 'test-manual-123456789', recipient: 'ignored@example.test' };
  expect(await h.request('POST', 'daily-summary/send', body)).toMatchObject({ status: 'success', data: { status: 'sent', recipient: 'jackgun9@gmail.com' } });
  await h.request('POST', 'daily-summary/send', body);
  expect(send).toHaveBeenCalledOnce();
  const mail = send.mock.calls[0][0];
  expect(mail.to).toBe('jackgun9@gmail.com'); expect(mail.attachments[0].content.subarray(0, 5).toString()).toBe('%PDF-');
  expect(h.calls.filter(c => c.operation === 'insert').every(c => c.table === 'COS_Activity')).toBe(true);
});
it('rejects a missing request identifier before sending', async () => {
  const send = vi.fn(); const h = createApiHarness(baseData(), undefined, send);
  expect(await h.request('POST', 'daily-summary/send', {})).toMatchObject({ status: 'error' });
  expect(send).not.toHaveBeenCalled();
});
it('never sends mail from the server mock environment', async () => {
  vi.stubEnv('CAPITALOS_MOCK', 'true');
  const send = vi.fn(); const h = createApiHarness(baseData(), undefined, send);
  expect(await h.request('POST', 'daily-summary/send', { requestId: 'test-manual-123456789' })).toMatchObject({ data: { status: 'mock' } });
  expect(send).not.toHaveBeenCalled(); expect(h.calls).toEqual([]);
});
it('downloads a valid PDF without email, reservations, or financial writes, including repeat downloads', async () => {
  const send = vi.fn(); const h = createApiHarness(baseData(), undefined, send);
  for (let i = 0; i < 2; i++) {
    const result = await h.request('POST', 'daily-summary/download', {});
    expect(result).toMatchObject({ status: 'success', data: { status: 'ready', filename: expect.stringMatching(/^CapitalOS-Daily-Summary-\d{4}-\d{2}-\d{2}\.pdf$/) } });
    expect(Buffer.from(result.data.contentBase64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
  }
  expect(send).not.toHaveBeenCalled();
  expect(h.calls.every(c => c.operation === 'page')).toBe(true);
});
it('fails a download if source data cannot be loaded and does not email', async () => {
  const send = vi.fn(); const h = createApiHarness(baseData(), name => name === 'COS_Profits', send);
  expect(await h.request('POST', 'daily-summary/download', {})).toMatchObject({ status: 'error' });
  expect(send).not.toHaveBeenCalled();
  expect(h.calls.every(c => c.operation === 'page')).toBe(true);
});
