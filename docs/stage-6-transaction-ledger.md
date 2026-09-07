# CapitalOS Stage 6 — Transaction Ledger

## Result

Stage 6 delivers the authoritative Transaction Ledger page. All six transaction types are represented, principal and profit are always displayed separately, and the ledger can be filtered by party, type, direction, and date range with a live inflow/outflow summary strip. TypeScript, tests, and the production build pass clean.

---

## What was built

### Mock data — 16 transactions covering all 6 types

| Type | Transactions |
|---|---|
| PARTNER_CAPITAL_RECEIVED | TXN-001, TXN-002, TXN-003, TXN-004 |
| CEO_CAPITAL_PROVIDED | TXN-010, TXN-011, TXN-012 |
| CEO_PRINCIPAL_RECEIVED | TXN-020, TXN-022, TXN-023 |
| CEO_PROFIT_RECEIVED | TXN-021, TXN-024, TXN-025 |
| PARTNER_PRINCIPAL_PAID | TXN-031 |
| PARTNER_PROFIT_PAID | TXN-030, TXN-032, TXN-033 |

All transactions are sorted newest-first by default.

### New hook (`client/src/mocks/transactionHooks.ts`)

- `useTransactions(filters)` — filters by search text, partnerId, ceoId, agreementId, transactionType, direction, dateFrom, dateTo; returns newest-first
- `useTransaction(id)` — single transaction by ID

### `TransactionTypeBadge` component

Pill badge with coloured dot representing direction:
- **IN** (green): Capital received, Principal received, Profit received
- **OUT** (red): Capital provided, Principal paid, Profit paid

Human-readable labels replace the raw enum string.

### `/transactions` — Transaction Ledger page

**Filter bar:**
- Search (code, reference, type keyword)
- Filter by partner (dropdown)
- Filter by CEO/business (dropdown)
- Filter by transaction type (all 6 types)
- Filter by direction (IN / OUT)
- Date range inputs (from / to)
- Clear all filters button (appears only when a filter is active)

**Ledger summary strip** (appears above the table when data is present):
- Total inflow (sum of all IN transactions in current view)
- Total outflow (sum of all OUT transactions)
- Net position

**Data table columns:**
Code (with direction-coloured arrow icon) / Date / Type badge / Party (linked) / Agreement (linked) / Principal / Profit / Total (prominent, coloured) / Method / Reference

Zero values in Principal and Profit columns display as `—` to reduce visual noise.

**Empty state** with contextual message and clear-filters button.

### New CSS classes

- `.txn-type-badge`, `.txn-type-badge--in`, `.txn-type-badge--out`, `.txn-type-badge__dot`
- `.ledger-code-cell__icon--in`, `.ledger-code-cell__icon--out`
- `.txn-zero`
- `.date-range-bar`, `.date-range-label`, `.date-input`
- `.ledger-summary`, `.ledger-summary__item`, `.ledger-summary__divider`

### Routing

```
/transactions  → TransactionsPage
```

---

## Validation

```
client:typecheck  — 0 errors
npm test          — 33 tests pass (4 test files)
client:build      — 2281 modules, 488 kB JS / 40 kB CSS, built in 1.43 s
```

---

## Assumptions and limitations

- The ledger is read-only in the UI. The "reversal/correction workflow" referenced in the product spec will be added in a later stage alongside the financial calculation layer (Stage 7).
- Posted transactions are not editable or deletable from the UI, matching the product requirement that financial history is immutable.
- Agreement filter is available in the hook but not yet wired to a UI filter control, to keep the filter bar from becoming too wide. It is available for the detail-page transaction sub-tabs which already filter by agreementId internally.

---

## Next stage

Stage 7 — Financial Calculations: deterministic ledger-derived position calculations (calculatePartnerPosition, calculateCEOPosition, calculateProfit, calculateOutstandingPrincipal, scheduleStatus), comprehensive tests, and connecting the CFO Dashboard KPIs to live calculated values.
