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
