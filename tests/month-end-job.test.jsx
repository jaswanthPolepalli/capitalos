import Module, { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';

function jobHarness(fail) {
  const seed = baseData(); seed.COS_Partners[0].email = 'partner@example.test';
  const api = createApiHarness(seed, fail);
  const initialize = vi.fn(() => ({ datastore: () => ({ table: api.table }) }));
  const sendMail = vi.fn().mockResolvedValue({ accepted: ['partner@example.test'] });
  const close = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail, close }));
  const filename = resolve('functions/capitalos-month-end/index.js');
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(dirname(filename));
  const actual = createRequire(filename);
  mod.require = name => name === 'zcatalyst-sdk-node' ? { initialize } : name === 'nodemailer' ? { createTransport } : actual(name);
  mod._compile(readFileSync(filename, 'utf8'), filename);
  const context = { closeWithSuccess: vi.fn(), closeWithFailure: vi.fn(), getRemainingExecutionTimeMs: () => 600000 };
  return { ...api, run: () => mod.exports({}, context), context, initialize, createTransport, sendMail, close };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-30T04:30:00Z'));
  vi.stubEnv('MONTH_END_EMAILS_ENABLED', 'true'); vi.stubEnv('VITE_USE_MOCK', 'false'); vi.stubEnv('CAPITALOS_MOCK', 'false');
  vi.stubEnv('SMTP_USER', 'synthetic@example.test'); vi.stubEnv('SMTP_APP_PASSWORD', 'synthetic-test-only'); vi.stubEnv('APP_BASE_URL', 'https://example.test/app');
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it.each(['disabled', 'VITE_USE_MOCK', 'CAPITALOS_MOCK', 'wrong-day', 'CAPITALOS_MAINTENANCE', 'CAPITALOS_RECOVERY'])('does not initialize datastore or SMTP for %s', async condition => {
  if (condition === 'disabled') vi.stubEnv('MONTH_END_EMAILS_ENABLED', 'false');
  else if (condition === 'wrong-day') vi.setSystemTime(new Date('2026-09-29T04:30:00Z'));
  else vi.stubEnv(condition, 'true');
  const h = jobHarness(); await h.run();
  expect(h.context.closeWithSuccess).toHaveBeenCalledOnce();
  expect(h.initialize).not.toHaveBeenCalled(); expect(h.createTransport).not.toHaveBeenCalled(); expect(h.sendMail).not.toHaveBeenCalled();
});
it('fails closed without configured mail credentials', async () => {
  vi.stubEnv('SMTP_APP_PASSWORD', ''); const h = jobHarness(); await h.run();
  expect(h.context.closeWithFailure).toHaveBeenCalledOnce(); expect(h.sendMail).not.toHaveBeenCalled();
});
it('runs the private job against the full datastore and sends one statement without financial writes', async () => {
  const h = jobHarness(); await h.run();
  expect(h.context.closeWithSuccess).toHaveBeenCalledOnce(); expect(h.sendMail).toHaveBeenCalledOnce();
  const mail = h.sendMail.mock.calls[0][0];
  expect(mail.to).toBe('partner@example.test'); expect(mail.subject).toContain('September 2026'); expect(mail.html).toContain('Profit remaining at cutoff');
  expect(h.calls.filter(c => c.operation === 'insert').every(c => c.table === 'COS_Activity')).toBe(true);
  expect(h.close).toHaveBeenCalledOnce(); await h.run(); expect(h.sendMail).toHaveBeenCalledOnce();
});
it('does not email a partial dataset when a later datastore page fails', async () => {
  const h = jobHarness((table, action, options) => table === 'COS_Allocations' && action === 'page' && options.nextToken === '200');
  h.db.COS_Allocations.push(...Array.from({ length: 201 }, (_, n) => ({ ...h.db.COS_Allocations[0], ROWID: String(n + 100) })));
  await h.run(); expect(h.context.closeWithFailure).toHaveBeenCalledOnce(); expect(h.sendMail).not.toHaveBeenCalled();
});
it('reports uncertain/rejected SMTP attempts without retrying them', async () => {
  const h = jobHarness(); h.sendMail.mockResolvedValue({ accepted: [], rejected: ['partner@example.test'] });
  await h.run(); expect(h.context.closeWithFailure).toHaveBeenCalledOnce();
  await h.run(); expect(h.sendMail).toHaveBeenCalledOnce();
});
it('checks in an inactive cron at 10 AM IST with bounded retry and a private function target', () => {
  const cron = JSON.parse(readFileSync('infrastructure/month-end-cron.json', 'utf8'));
  expect(cron).toMatchObject({ cron_status: false, cron_expression: '0 10 28-31 * *', cron_detail: { timezone: 'Asia/Kolkata' }, job_meta: { target_type: 'Function', target_name: 'capitalos-month-end', job_config: { number_of_retries: 2, retry_interval: 300 } } });
  const config = JSON.parse(readFileSync('functions/capitalos-month-end/catalyst-config.json', 'utf8'));
  expect(config.deployment).toMatchObject({ type: 'job', stack: 'node24', env_variables: { MONTH_END_EMAILS_ENABLED: 'false' } });
});
