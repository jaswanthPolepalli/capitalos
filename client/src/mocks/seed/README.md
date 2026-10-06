# Local Seed Data

This directory contains **real production data snapshots** used for local frontend development in mock mode.

> ⚠️ **All `*.json` files in this directory are gitignored** — they contain real partner/financial data and must NEVER be committed.

## How to populate this directory

Run the seed script from the project root, providing your deployed Catalyst API URL:

```bash
CATALYST_API_URL=https://your-app.catalystserverless.com/server/capitalos-api npm run seed:local
```

This will create:
- `partners.json`
- `allocations.json`
- `capital-returns.json`
- `profit-records.json`
- `credit-cards.json`
- `_meta.json` (seed timestamp + source URL)

## How to use

After seeding, start the dev server in mock mode:

```bash
npm run client:dev:mock
# or equivalently:
VITE_USE_MOCK=true npm run client:dev
```

The browser console will show:
```
[CapitalOS Mock Mode] 🧪 Mock fetch installed. All API calls are intercepted — no live data will be read or written.
[CapitalOS Mock Mode] Seed: partners: 5, allocations: 8, ...
```

## What mock mode does

- All `/server/capitalos-api/*` fetch calls are **intercepted in the browser** — no network requests reach Catalyst
- GET → returns rows from your seed JSON (in memory)
- POST/PATCH/DELETE → mutates the **in-memory copy only**, resets on page refresh
- **Your production database is completely untouched**

## Re-seeding

Re-run `npm run seed:local` any time you want a fresh snapshot of production data.
