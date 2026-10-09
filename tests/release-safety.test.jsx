import { afterEach, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';

afterEach(() => vi.restoreAllMocks());

it.each(['CAPITALOS_MAINTENANCE', 'CAPITALOS_RECOVERY'])('blocks every mutation before reading data or sending email in %s', async flag => {
  const send = vi.fn();
  const h = createApiHarness(baseData(), undefined, send, { [flag]: 'true' });
  const before = structuredClone(h.db);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const route of ['partners', 'allocations/a', 'payment-groups', 'profit-records/close', 'daily-summary/send', 'imports']) {
      const result = await h.request(method, route, {});
      expect(result.httpStatus).toBe(503);
      expect(result.message).toContain('No changes were saved');
    }
  }
  expect(h.calls).toEqual([]);
  expect(h.db).toEqual(before);
  expect(send).not.toHaveBeenCalled();
});

it('allows read-only smoke checks and reveals no runtime secrets', async () => {
  const h = createApiHarness(baseData(), undefined, undefined, { CAPITALOS_MAINTENANCE: 'true' });
  expect((await h.request('GET', 'partners')).status).toBe('success');
  const result = await h.request('GET', 'release-status');
  expect(result.data).toEqual({ version: 1, maintenance: true, recovery: false, writesBlocked: true, emailEnabled: false, smtpConfigured: true });
  expect(JSON.stringify(result)).not.toContain('sender@example.test');
  expect(JSON.stringify(result)).not.toContain('password');
});

it.each([{ SMTP_APP_PASSWORD: '' }, { SMTP_USER: '' }, { CAPITALOS_EMAILS_ENABLED: 'false' }])('does not initialize or send SMTP when runtime mail configuration is unavailable: %j', async env => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const seed = baseData(); seed.COS_Partners[0].email = 'partner@example.test';
  const send = vi.fn();
  const h = createApiHarness(seed, undefined, send, env);
  const result = await h.request('POST', 'allocations', { partnerId: 'p', amountRupees: 1000, profitPercent: '2', receivedDate: '2026-10-09', returnDate: '2026-11-09' });
  expect(result.httpStatus).toBe(201);
  expect(send).not.toHaveBeenCalled();
});
