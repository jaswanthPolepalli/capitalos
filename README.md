# CapitalOS

CapitalOS is an INR-first capital operations system — a personal CFO workspace for tracking partners, CEO investments, agreements, capital contributions, transactions, and profit schedules.

Deployed on **Zoho Catalyst** as a static web client with no authentication required.

## Testing Policy

> **No deployment without a green test suite.**
> See [TESTING.md](./TESTING.md) for the full guide.

### The Rule

```
Feature added   → Write tests for it
Feature changed → Update tests to match the new behaviour
Feature deleted → Delete the tests that covered it
Bug fixed       → Add a regression test so it never returns

Deploy only if: npm test → ALL PASS
```

### Running Tests

```bash
# Run full suite
npm test

# Watch mode during development
npm run test:watch

# Full pre-deploy gate (tests + typecheck + build)
npm run validate
```

### Current Test Coverage

| File | Tests | Guards |
|---|---|---|
| `tests/financial-calculations.test.ts` | 81 | BigInt financial math |
| `tests/validation.test.ts` | 120 | All Zod entity schemas |
| `tests/schema-contract.test.ts` | 45 | Datastore schema structure & security |
| `tests/format-utils.test.ts` | 37 | INR & date formatting |
| `tests/soft-delete.test.ts` | 32 | Soft-delete data safety |
| `tests/status-badge.test.ts` | 37 | UI status → CSS class mapping |
| `tests/navigation.test.ts` | 36 | Route matching & mobile nav |
| `tests/common-validation.test.ts` | 99 | Primitive schema edge cases |
| `tests/calculation-integration.test.ts` | 27 | validate → calculate → format pipeline |
| **Total** | **514** | |

---

## Deployment (Zoho Catalyst)

### Prerequisites

- Node.js ≥ 20
- Zoho Catalyst CLI installed and logged in:
  ```bash
  npm install -g @zohocorp/catalyst-cli
  catalyst login
  ```

### Build

```bash
npm install
npm run client:build
```

This produces a production build in `client/dist/`.

### Deploy to Catalyst

```bash
catalyst deploy
```

The `catalyst.json` at the project root points the client source to `client/dist/`. Catalyst CLI will upload it to Web Client Hosting automatically.

### Local Development

```bash
npm run client:dev
```

Starts Vite dev server at `http://localhost:5173`.

### Preview Production Build

```bash
npm run client:preview
```

## Architecture

- **Frontend only** — React + TypeScript + Vite, deployed via Catalyst Web Client Hosting
- **No authentication** — personal app, accessed directly by the CFO
- **Public portal** — external read-only views shared with partners/CEOs via `/p/:token` links
- **Mock data** — all pages use local mock data; backend integration is a future stage

## Key Files

| File | Purpose |
|---|---|
| `client/src/App.tsx` | Route definitions |
| `client/src/pages/` | All page components |
| `client/src/mocks/` | Mock data hooks for all modules |
| `client/src/layout/` | AppShell, Sidebar, TopBar, MobileNavigation |
| `client/src/styles.css` | Global design system styles |
| `catalyst.json` | Catalyst deployment config |
| `infrastructure/datastore/schema.ts` | Catalyst Data Store schema |

## Pages

| Route | Page |
|---|---|
| `/` | Dashboard |
| `/partners` | Partners list |
| `/partners/:id` | Partner detail |
| `/businesses` | CEO / Businesses list |
| `/businesses/:id` | CEO detail |
| `/agreements` | Agreements list |
| `/agreements/:id` | Agreement detail |
| `/capital-contributions` | Capital contributions ledger |
| `/ceo-investments` | CEO investments ledger |
| `/transactions` | Transaction ledger |
| `/profit-schedule` | Profit schedule |
| `/portal-links` | Manage external portal links |
| `/settings` | Workspace settings |
| `/p/:token` | Public read-only portal (shared externally) |
