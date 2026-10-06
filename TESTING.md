# CapitalOS — Testing Policy & Guide

> **QA Rule: No deployment without a green test suite.**
> Every feature, fix, or deletion must be accompanied by corresponding test changes before `npm run validate` is run.

---

## The Non-Negotiable Rule

```
Feature added   → Write tests for it
Feature changed → Update tests to match the new behaviour
Feature deleted → Delete the tests that covered it
Bug fixed       → Add a regression test so it never returns

Deploy only if: npm test → ALL PASS
```

This is not optional. The `npm run validate` script enforces this automatically — it runs the full test suite and blocks the build if any test fails.

---

## Running Tests

```bash
# Run the full test suite once (CI mode)
npm test

# Run in watch mode during development
npm run test:watch

# Run full validation gate (tests + typecheck + build)
npm run validate
```

All commands must be run from the project root.

---

## September release coverage

Run under Node 24 from `.nvmrc` with npm 11.17.0. The authoritative count is the output of `npm run validate`, not a manually maintained per-file total.

Latest S6 validation: **636 tests across 27 files** passed under Node 24, with type checks, schema checks and production build.

New suites cover:

- `store-loading.test.jsx`: failed initial load versus empty success, full snapshot retention, required endpoint failure, stalled-request timeout, shared refresh and save/refresh races.
- `freshness-ui.test.jsx`: retry/error/stale display, portal failure, shared listeners, focus/reconnect refresh and visible-only polling.
- `bulk-loading.test.jsx`: cold-load selection, preserving deselections/edited amounts, reviewing new/changed rows and blocking stale submissions.

- `api-records.test.jsx`: actual API handler pagination beyond 200 rows, logical cascading deletion, restoration, immutable mutation snapshots, and audit failure behavior.
- `api-imports-reminders.test.jsx`: actual handler validation, concurrent import duplicate reservations, uncertain outcomes, and manual reminder history without external delivery.
- `operations-domain.test.jsx`: reconciled statement periods, India dates, CSV parsing/formula safety, duplicate previews, and liability horizons.
- `operations-ui.test.jsx`: statement controls, CSV mapping/review/import results, batch reminder history, recoverable history errors, and keyboard dialog focus.
- `recovery-store.test.jsx`: restored records re-enter the store and ledger after reload.
- `mobile-layout.test.ts`: responsive CSS cascade at 320/390/767 pixels. JSDOM does not perform pixel layout; these are regression checks, not device acceptance.

Existing financial, schema, navigation, combination and UI suites remain in the full gate. API tests execute the real handler against an isolated fake Catalyst SDK; they do not prove hosted SDK permissions, schema availability, network delivery or production concurrency correctness.

Before release, verify the additive schema with `npm run schema:operations -- --check` in Development, smoke-test the staged API on Node 24, and check web/mobile layout, keyboard and screen-reader behavior. Browser automation was unavailable during this implementation because computer access remained pending. No live deployment or device pass is claimed.

---

## Test File Ownership — What to Test Where

### When you change `shared/src/financial/calculations.ts`
→ **Update:** `tests/financial-calculations.test.ts`
→ **Also check:** `tests/calculation-integration.test.ts` (pipeline tests)

### When you change `shared/src/validation/common.ts`
→ **Update:** `tests/common-validation.test.ts`
→ **Also check:** `tests/validation.test.ts` (entity schemas that depend on common schemas)

### When you change `shared/src/validation/entities.ts`
→ **Update:** `tests/validation.test.ts`
→ **Also check:** `tests/calculation-integration.test.ts`

### When you change `infrastructure/datastore/schema.ts`
→ **Update:** `tests/schema-contract.test.ts`

### When you change `functions/capitalos-api/index.js`
→ **Update:** `tests/soft-delete.test.ts` if the soft-delete helpers change
→ **Add new tests** for any new route logic or helper function extracted into pure functions

### When you change `client/src/lib/format.ts`
→ **Update:** `tests/format-utils.test.ts`
→ **Also check:** `tests/calculation-integration.test.ts` (format pipeline tests)

### When you change `client/src/components/StatusBadge.tsx`
→ **Update:** `tests/status-badge.test.ts`

### When you change `client/src/navigation/navigation.ts`
→ **Update:** `tests/navigation.test.ts`

### When you add a **new shared utility, schema, or calculation**
→ **Create a new test file** in `tests/` following the naming convention: `tests/<module-name>.test.ts`

---

## Writing a New Test

### File template

```typescript
/**
 * CapitalOS — <Module> Tests
 *
 * <What this module does and why it matters to users>
 *
 * Covers:
 * - <behaviour 1>
 * - <behaviour 2>
 */

import { describe, expect, it } from "vitest";
import { myFunction } from "../path/to/module.js";

describe("myFunction — happy path", () => {
  it("does the thing correctly", () => {
    expect(myFunction(input)).toBe(expectedOutput);
  });
});

describe("myFunction — edge cases", () => {
  it("handles zero without throwing", () => {
    expect(myFunction(0n)).toBe(0n);
  });

  it("returns null for missing input", () => {
    expect(myFunction(null)).toBeNull();
  });
});
```

### Rules for test cases

1. **One assertion concept per `it()` block** — do not combine unrelated assertions
2. **Test description must state the expected outcome**, not just what it does:
   - ✅ `"returns 0n when both provided and returned are equal"`
   - ❌ `"tests calculateOutstandingPrincipal with equal values"`
3. **Cover the edges**: zero, null, empty string, max length, negative, overpayment
4. **Use realistic financial values** — INR paise amounts, real-looking IDs, ISO dates
5. **For BigInt money**: use `n` suffix literal notation — `100_000_00n` = ₹1,00,000

### Financial test amounts reference

| Notation | Paise value | INR value |
|---|---|---|
| `100n` | 100 | ₹1 |
| `100_00n` | 10,000 | ₹100 |
| `1_000_00n` | 1,00,000 | ₹1,000 |
| `1_00_000_00n` | 1,00,00,000 | ₹1,00,000 (1 Lakh) |
| `1_00_00_000_00n` | 1,00,00,00,000 | ₹1,00,00,000 (1 Crore) |

---

## Deleting a Feature

When a feature is removed:

1. Delete the feature code
2. **Search for all tests that reference it:**
   ```bash
   grep -r "myDeletedFunction" tests/
   ```
3. Delete those test cases or entire test files if the whole module is removed
4. Run `npm test` — must still be 100% green

Do **not** leave orphaned tests that import deleted modules — they will fail the build.

---

## Deployment Gate

The `npm run validate` command is the required pre-deployment gate. It runs in this order:

```bash
npm run validate
# Runs:
#   1. npm run schema:check   — Catalyst schema template matches schema.ts
#   2. npm run typecheck      — TypeScript across all workspaces
#   3. npm test               — All 514+ tests must pass
#   4. npm run client:build   — Production build must succeed
```

**If any step fails → do not deploy.**

The deploy commands in `DEPLOYMENT.md` must only be run after `npm run validate` exits with code 0.

---

## Test Categories

### Unit tests
Pure function tests with no I/O or DOM. These are the majority of the suite. Fast, deterministic, no mocking needed.

**Examples:** `financial-calculations.test.ts`, `format-utils.test.ts`, `soft-delete.test.ts`, `status-badge.test.ts`

### Integration tests
Tests that exercise multiple layers together (validate → calculate → format).

**Examples:** `calculation-integration.test.ts`

### Contract tests
Tests that verify a module's structure satisfies a declared contract (schema shape, required fields, naming rules).

**Examples:** `schema-contract.test.ts`, `navigation.test.ts`

---

## Security-Critical Tests — Never Delete

The following tests protect against data leakage and financial corruption. They must **never** be deleted or weakened:

| Test | Risk if removed |
|---|---|
| `agreementBelongsTo — portal authorization guard` | Partner A sees Partner B's financial data |
| `soft-delete round-trip` | Deleted partners reappear in the UI |
| `PortalAccess stores token_hash, never raw token` | Token theft via database read |
| `no financial table uses cascade delete` | One delete wipes transaction history |
| `partner position isolation` | Financial positions cross-contaminate |
| `totalAmount must equal principal + profit` | Silent financial discrepancies recorded |

---

## Continuous Integration

If a CI pipeline is added in the future, the required check command is:

```bash
npm run validate
```

Exit code 0 = deploy allowed. Any non-zero exit = block deployment.

---

## Local Frontend Development — Mock Mode

### The problem

The CapitalOS frontend talks to a Catalyst cloud function (`/server/capitalos-api/*`). In local development that endpoint doesn't exist unless you've deployed — running `npm run client:dev` against localhost results in API errors and an empty UI.

### The solution: `VITE_USE_MOCK=true`

A **browser-level fetch interceptor** catches all `/server/capitalos-api/*` calls before they ever leave the browser. The interceptor returns data from local seed JSON files (a snapshot of real production data) and swallows all writes (POST / PATCH / DELETE) silently.

**Nothing you do in mock mode can affect the live Catalyst database. It is physically impossible — no network request is made.**

---

### Step 1 — Seed local data (one-time setup)

```bash
CATALYST_API_URL=https://your-app.catalystserverless.com/server/capitalos-api npm run seed:local
```

This fetches all 5 tables from your deployed API and saves them as JSON files:

```
client/src/mocks/seed/
  partners.json
  allocations.json
  capital-returns.json
  profit-records.json
  credit-cards.json
  _meta.json       ← seed timestamp
```

> ⚠️ These files are **gitignored** — they contain real financial data and must never be committed.

Re-run `npm run seed:local` any time you want a fresh snapshot of production data.

---

### Step 2 — Start the dev server in mock mode

```bash
npm run client:dev:mock
# equivalent to: VITE_USE_MOCK=true npm run client:dev
```

The browser console confirms mock mode is active:

```
[CapitalOS Mock Mode] 🧪 All API calls are intercepted — no live data will be read or written.
[CapitalOS Mock Mode] Seed: partners: 5, allocations: 12, capital-returns: 3, ...
```

---

### What mock mode does

| Operation | What happens |
|---|---|
| GET `/server/capitalos-api/partners` | Returns your seeded `partners.json` rows |
| POST (add partner) | Adds to in-memory list with a fake ID — **resets on refresh** |
| PATCH (edit) | Updates in-memory row — **resets on refresh** |
| DELETE (soft-delete) | Removes from in-memory list — **resets on refresh** |
| Any non-API fetch (fonts, icons, etc.) | Passes through to real fetch normally |

### Safety guarantees

| Risk | Status |
|---|---|
| Accidentally saving test data to production | ✅ **Impossible** — no network request is made |
| Accidentally reading stale cached production data | ✅ **Impossible** — data comes from local seed files |
| Mock data persisting after page refresh | ✅ **Impossible** — in-memory only |
| Mock mode accidentally running in production build | ✅ **Impossible** — `__USE_MOCK__` is `false` in prod, code is tree-shaken out |

---

### Two-environment safety (even without mock mode)

Catalyst provides **environment isolation** out of the box:

| Environment | How to access | Database |
|---|---|---|
| **Development** | `catalyst serve` locally | Isolated dev datastore — mutations stay here |
| **Production** | `catalyst deploy` then visit live URL | Production datastore — only touched by deploy |

So even if you run `npm run client:dev` without mock mode, mutations go to the **dev datastore**, not production.

---

### Relevant files

| File | Purpose |
|---|---|
| `scripts/seed-local.ts` | Fetches all tables from the deployed Catalyst API and writes seed JSON files |
| `client/src/mocks/mockFetch.ts` | The fetch interceptor — installs on `window.fetch` in mock mode |
| `client/src/mocks/seed/` | Where seed JSON files live (gitignored) |
| `client/vite.config.ts` | Exposes `__USE_MOCK__` boolean from `VITE_USE_MOCK` env var |
| `client/src/main.tsx` | Installs mock fetch before React mounts when `__USE_MOCK__` is true |
