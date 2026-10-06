import { describe, expect, it, vi } from 'vitest';
import { baseData, createApiHarness } from './helpers/api-harness.mjs';

describe('account migration compatibility', () => {
  it.each([false, true])('keeps original ledger dates with migrated timestamps: %s', async migrated => {
    const seed = baseData();
    const original = '2026-09-02T17:40:30.323Z';
    for (const rows of Object.values(seed)) for (const row of rows) {
      row.CREATEDTIME = migrated ? '2026-09-21T10:00:00.000Z' : original;
      if (migrated) row.source_created_time = original;
    }
    const h = createApiHarness(seed);
    for (const endpoint of ['allocations', 'capital-returns', 'profit-records']) {
      expect((await h.request('GET', endpoint)).data[0].createdAt).toBe(original);
    }
    for (const endpoint of ['partners', 'credit-cards']) {
      expect((await h.request('GET', endpoint)).data[0].createdAt).toBe('2026-09-02');
    }
  });

  it('uses the destination app URL in payment confirmation links', async () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = 'https://destination.example.test/app/';
    try {
      const seed = baseData();
      seed.COS_Partners[0].email = 'partner@example.test';
      const sendMail = vi.fn().mockResolvedValue({});
      const h = createApiHarness(seed, undefined, sendMail);
      await h.request('POST', 'profit-records', { partnerId: 'p', allocationId: 'a', amountRupees: 300, paidDate: '2026-09-21' });
      await vi.waitFor(() => expect(sendMail).toHaveBeenCalledOnce());
      expect(sendMail.mock.calls[0][0].html).toContain('https://destination.example.test/app/#/p/partner-p');
      expect(sendMail.mock.calls[0][0].html).not.toContain('capitalos-60070830470');
    } finally {
      if (previous === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = previous;
    }
  });
});
