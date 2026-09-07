# CapitalOS Stage 7 — Financial Calculations

## Result

Stage 7 implements the deterministic financial calculation layer and connects live ledger-derived KPIs to the CFO Dashboard. All 37 new calculation tests pass alongside the existing 33 tests — 70 total, zero TypeScript errors, clean production build.

---

## What was built

### `shared/src/financial/calculations.ts` — Pure calculation functions

| Function | Description |
|---|---|
| `calculatePartnerPosition` | Derives total capital contributed, principal returned, principal outstanding, profit paid, and profit pending for one Partner from the full ledger. Never touches stored balance columns. |
| `calculateCEOPosition` | Derives total capital provided, principal returned, principal outstanding, and profit received for one CEO from the full ledger. |
| `calculateOutstandingPrincipal` | `provided - returned`; returns 0 (not negative) on overpayment; overpayment must be checked separately. |
| `calculateOutstandingProfit` | `expected - paid`; returns 0 on overpayment. |
| `calculateScheduleStatus` | Given a schedule record and today's date, returns `{ principalPending, profitPending, totalPending, status, overpaymentDetected }`. Status derives from: paid → PAID; partial payment → PARTIALLY_PAID; past due → OVERDUE; due today → DUE; future → UPCOMING. |
| `calculateTotalPending` | `principalOutstanding + profitPending`. |
| `calculateLedgerTotals` | Aggregates all six transaction types across all parties: totalCapitalIn, totalCapitalOut, totalPrincipalFromCEOs, totalProfitFromCEOs, totalPrincipalToCEOs, totalPrincipalToPartners, totalProfitToPartners. |

All functions are pure, stateless, `bigint`-based (integer paise), and independently unit-testable.

### `tests/financial-calculations.test.ts` — 37 unit tests

Test coverage:

| Area | Tests |
|---|---|
| `calculateOutstandingPrincipal` | 4 — normal, zero returned, fully repaid, overpayment → 0 |
| `calculateOutstandingProfit` | 3 — normal, fully paid, overpayment → 0 |
| `calculateTotalPending` | 2 — sum, zero |
| `calculateScheduleStatus` | 8 — PAID, PARTIALLY_PAID (profit), PARTIALLY_PAID (principal), OVERDUE, DUE, UPCOMING, principal overpayment, profit overpayment |
| `calculatePartnerPosition` | 6 — no returns, partial return, profit pending, multi-partner isolation, overpayment detection, multiple contributions |
| `calculateCEOPosition` | 5 — no repayments, principal received, profit received, multi-CEO isolation, overpayment detection, full repayment |
| `calculateLedgerTotals` | 2 — all types, empty ledger |
| **Spec Scenario 1** (Section 39) | 4 — CEO position, Partner position, ledger totals, CFO net retained |
| Position isolation | 2 — Partner A ≠ Partner B, CEO A ≠ CEO B |

**Spec Scenario 1 validated:**

```
Partner contributes   ₹10,00,000  →  Partner capital = ₹10,00,000
CEO receives          ₹10,00,000  →  CEO capital provided = ₹10,00,000
CEO returns principal ₹2,00,000   →  CEO outstanding = ₹8,00,000
CEO pays profit       ₹50,000     →  CEO profit received = ₹50,000
Partner receives principal ₹1,00,000 → Partner outstanding = ₹9,00,000
Partner receives profit   ₹30,000   → Partner profit pending = 0
CFO net retained              ₹20,000 (₹50,000 - ₹30,000)
```

All assertions match expected values.

### `client/src/mocks/dashboardHooks.ts` — Live KPI hook

`useCFODashboard()` derives every dashboard value from `MOCK_TRANSACTIONS` and `MOCK_SCHEDULES` using the shared calculation functions. No stored balances are used.

Returns:
- `ledgerTotals` (all 7 aggregate fields)
- `partnerPositions[]` (one per partner, ledger-derived)
- `ceoPositions[]` (one per CEO, ledger-derived)
- Aggregate sums: `totalPartnerCapital`, `totalPartnerPrincipalOutstanding`, `totalPartnerProfitPending`, `totalCEOCapitalDeployed`, `totalCEOPrincipalOutstanding`, `totalCEOProfitReceived`
- `nextPaymentDate`, `overdueScheduleCount`, `upcomingScheduleCount`

### Updated `client/src/pages/DashboardPage.tsx`

The CFO Dashboard now shows live data in three sections:

**KPI strip (8 cards):**
1. Total partner capital
2. Capital deployed to CEOs
3. Principal received from CEOs
4. Profit received from CEOs
5. Principal returned to partners
6. Profit paid to partners
7. Partner principal outstanding
8. Partner profit pending

**CEO outstanding table** — one row per CEO with outstanding principal. Links to CEO detail pages.

**Partner positions table** — one row per partner showing capital, principal returned, profit paid. Links to partner detail pages.

**Payment obligations section** — shows overdue, partially paid, and upcoming schedule entries with party links.

**Recent transactions section** — 8 most recent ledger entries with TransactionTypeBadge, party links, and separated principal/profit/total columns.

Banner adapts: shows "attention" (red) when overdue obligations exist, "Protected" (green) otherwise.

---

## Validation

```
client:typecheck  — 0 errors
npm test          — 70 tests pass (5 test files)
client:build      — 2283 modules, 500 kB JS / 40 kB CSS, built in 1.44 s
```

---

## Assumptions and limitations

- Earned profit per partner is derived from the sum of `expectedProfit` across schedule entries for that partner. This is a simplification; production will derive it from the agreement terms and period logic implemented in the calculation layer.
- `calculateScheduleStatus` uses today's date (`new Date().toISOString().slice(0, 10)`) by default; all tests supply an explicit `today` parameter for determinism.
- Overpayments return `0n` for the affected field and set `overpaymentDetected: true`. The CFO Dashboard does not currently surface individual overpayment warnings — that UI alert will be added in Stage 8.

---

## Next stage

Stage 8 — CFO Dashboard: full KPI command center with selective trend charts, outstanding tables with drill-down, overdue payment alerts, and final dashboard polish.
