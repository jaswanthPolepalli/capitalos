import { copyFile, mkdir } from 'node:fs/promises';
const source = new URL('../functions/capitalos-api/', import.meta.url);
const target = new URL('../functions/capitalos-daily-summary/shared/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['daily-summary.js', 'daily-summary-pdf.js', 'group-payment-email.js', 'persistence.js', 'records.mjs', 'payment-groups.mjs', 'combinations.mjs', 'profit-cycles.mjs', 'cashback.mjs']) {
  await copyFile(new URL(name, source), new URL(name, target));
}
console.log('Prepared daily summary job modules.');
