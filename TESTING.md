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

## Test Suite — Current Coverage

| Test File | Tests | What It Guards |
|---|---|---|
| `tests/financial-calculations.test.ts` | 81 | Core BigInt financial math — partner/CEO position, ledger totals, schedule status |
| `tests/validation.test.ts` | 120 | Zod entity schemas — all input validation for agreements, transactions, schedules, portal |
| `tests/schema-contract.test.ts` | 45 | Catalyst datastore schema structure, FK rules, PII marking, security rules |
| `tests/format-utils.test.ts` | 37 | INR formatting (Indian lakh/crore), date & relative time formatting |
| `tests/soft-delete.test.ts` | 32 | Sentinel-based soft-delete (`markDeleted`/`isDeleted`/restore) — financial data safety |
| `tests/status-badge.test.ts` | 37 | Status → CSS class mapping, label formatting for all financial screens |
| `tests/navigation.test.ts` | 36 | Route matching, sub-path resolution, mobile nav completeness |
| `tests/common-validation.test.ts` | 99 | Primitive schema edge cases: ROWID format, decimal precision, date boundaries |
| `tests/calculation-integration.test.ts` | 27 | End-to-end: validate → calculate → format pipeline; portal auth guard |
| **Total** | **514** | |

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
