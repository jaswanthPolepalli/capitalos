#!/usr/bin/env tsx
/**
 * seed-local.ts — Fetch real data from deployed Catalyst API and save it
 * as a local seed snapshot used for offline frontend development.
 *
 * Usage:
 *   CATALYST_API_URL=https://your-app.catalystserverless.com/server/capitalos-api \
 *   npm run seed:local
 *
 * Output:
 *   client/src/mocks/seed/partners.json
 *   client/src/mocks/seed/allocations.json
 *   client/src/mocks/seed/capital-returns.json
 *   client/src/mocks/seed/profit-records.json
 *   client/src/mocks/seed/credit-cards.json
 *
 * After seeding, run the dev server in mock mode:
 *   VITE_USE_MOCK=true npm run client:dev
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API_URL = process.env.CATALYST_API_URL;

if (!API_URL) {
  console.error(
    "\n❌  CATALYST_API_URL is not set.\n\n" +
    "    Usage:\n" +
    "    CATALYST_API_URL=https://your-app.catalystserverless.com/server/capitalos-api npm run seed:local\n",
  );
  process.exit(1);
}

const SEED_DIR = join(process.cwd(), "client/src/mocks/seed");

const TABLES = [
  "partners",
  "allocations",
  "capital-returns",
  "profit-records",
  "credit-cards",
] as const;

// Ensure seed directory exists
if (!existsSync(SEED_DIR)) {
  mkdirSync(SEED_DIR, { recursive: true });
  console.log(`📁  Created ${SEED_DIR}`);
}

console.log(`\n🌱  Seeding local mock data from: ${API_URL}\n`);

let allOk = true;

for (const table of TABLES) {
  const url = `${API_URL.replace(/\/$/, "")}/${table}`;
  process.stdout.write(`   Fetching ${table}... `);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const json = await res.json() as { status: string; data: unknown[] };

    if (json.status !== "success") {
      throw new Error(`API returned status: ${json.status}`);
    }

    const rows = json.data || [];
    const filename = `${table}.json`;
    const filepath = join(SEED_DIR, filename);

    // Write as indented JSON for readability + easy diffing in git
    writeFileSync(filepath, JSON.stringify(rows, null, 2) + "\n", "utf8");
    console.log(`✅  ${rows.length} rows → ${filename}`);
  } catch (err) {
    console.log(`❌  FAILED`);
    console.error(`       Error: ${(err as Error).message}`);
    allOk = false;
  }
}

// Write a metadata file with the seed timestamp
const metaPath = join(SEED_DIR, "_meta.json");
writeFileSync(
  metaPath,
  JSON.stringify({
    seededAt: new Date().toISOString(),
    sourceUrl: API_URL,
    tables: TABLES,
  }, null, 2) + "\n",
  "utf8",
);

if (allOk) {
  console.log(`\n✅  Seed complete! Metadata written to _meta.json`);
  console.log(`\n   Run the dev server in mock mode:\n`);
  console.log(`   VITE_USE_MOCK=true npm run client:dev\n`);
} else {
  console.log(`\n⚠️  Some tables failed to seed. Check the errors above.\n`);
  process.exit(1);
}
