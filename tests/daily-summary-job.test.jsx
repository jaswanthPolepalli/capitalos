import Module, { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';
function harness() {
  const seed = baseData(); seed.COS_Profits[0].paid_date = '2026-10-06';
  const api = createApiHarness(seed);
  const initialize = vi.fn(() => ({ datastore: () => ({ table: api.table }) }));
  const sendMail = vi.fn().mockResolvedValue({ accepted: ['jackgun9@gmail.com'] });
  const close = vi.fn(), createTransport = vi.fn(() => ({ sendMail, close }));
  const filename = resolve('functions/capitalos-daily-summary/index.js');
  const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(dirname(filename));
  const actual = createRequire(filename);
  mod.require = name => name === 'zcatalyst-sdk-node' ? { initialize } : name === 'nodemailer' ? { createTransport } : actual(name);
  mod._compile(readFileSync(filename, 'utf8'), filename);
  const context = { closeWithSuccess: vi.fn(), closeWithFailure: vi.fn() };
  return { ...api, run: () => mod.exports({}, context), context, initialize, createTransport, sendMail, close };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-06T17:30:00Z'));
  vi.stubEnv('DAILY_SUMMARY_EMAILS_ENABLED', 'true'); vi.stubEnv('CAPITALOS_MOCK', 'false'); vi.stubEnv('VITE_USE_MOCK', 'false');
  vi.stubEnv('SMTP_USER', 'synthetic@example.test'); vi.stubEnv('SMTP_APP_PASSWORD', 'synthetic-test-only');
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it.each(['disabled', 'early', 'CAPITALOS_MOCK', 'VITE_USE_MOCK', 'CAPITALOS_MAINTENANCE', 'CAPITALOS_RECOVERY'])('does not initialize SMTP or the datastore for %s', async mode => {
  if (mode === 'disabled') vi.stubEnv('DAILY_SUMMARY_EMAILS_ENABLED', 'false');
  else if (mode === 'early') vi.setSystemTime(new Date('2026-10-06T17:29:59Z'));
  else vi.stubEnv(mode, 'true');
  const h = harness(); await h.run();
  expect(h.context.closeWithSuccess).toHaveBeenCalledOnce(); expect(h.initialize).not.toHaveBeenCalled(); expect(h.createTransport).not.toHaveBeenCalled();
});
it('sends a real attachment once through the private job and closes SMTP', async () => {
  const h = harness(); await h.run(); await h.run();
  expect(h.sendMail).toHaveBeenCalledOnce(); expect(h.close).toHaveBeenCalledTimes(2);
  expect(h.context.closeWithFailure).not.toHaveBeenCalled();
  expect(h.sendMail.mock.calls[0][0]).toMatchObject({ to: 'jackgun9@gmail.com', attachments: [{ contentType: 'application/pdf' }] });
});
it('skips a day without activity and reports rejected SMTP without retrying it', async () => {
  const h = harness(); h.db.COS_Profits[0].paid_date = '2026-09-01';
  await h.run(); expect(h.sendMail).not.toHaveBeenCalled();
  h.db.COS_Profits[0].paid_date = '2026-10-06'; h.sendMail.mockResolvedValue({ accepted: [], rejected: ['jackgun9@gmail.com'] });
  await h.run(); await h.run(); expect(h.sendMail).toHaveBeenCalledOnce(); expect(h.context.closeWithFailure).toHaveBeenCalledTimes(2);
});
it('fails closed without SMTP credentials', async () => {
  vi.stubEnv('SMTP_APP_PASSWORD', ''); const h = harness(); await h.run();
  expect(h.context.closeWithFailure).toHaveBeenCalledOnce(); expect(h.sendMail).not.toHaveBeenCalled();
});
it('defines an initially disabled 11 PM IST private cron', () => {
  const cron = JSON.parse(readFileSync('infrastructure/daily-summary-cron.json', 'utf8'));
  expect(cron).toMatchObject({ cron_status: false, cron_expression: '0 23 * * *', cron_detail: { timezone: 'Asia/Kolkata' }, job_meta: { target_type: 'Function', target_name: 'capitalos-daily-summary' } });
});
