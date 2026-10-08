import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = new URL('../functions/capitalos-api/', import.meta.url);
const target = new URL('../functions/capitalos-month-end/shared/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['month-end-statements.js', 'persistence.js', 'records.mjs', 'payment-groups.mjs', 'profit-sharing.mjs', 'combinations.mjs', 'profit-cycles.mjs']) {
  await copyFile(new URL(name, source), new URL(name, target));
}
console.log(`Prepared monthly statement function: ${fileURLToPath(target)}`);
