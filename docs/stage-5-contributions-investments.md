# CapitalOS Stage 5 — Contributions and Investments

## Result

Stage 5 delivers fully functional Capital Contributions and CEO Investments list pages. Both screens show party- and method-filtered views with running totals, linked cross-references to partners/businesses/agreements, and consistent loading and empty states. TypeScript, tests, and the production build pass clean.

---

## What was built

### Mock data extended

#### Partner Contributions — 7 records

| Code | Partner | Agreement | Amount | Method |
|---|---|---|---|---|
| CONT-001 | Ramesh Nair | AGR-001 | ₹15,00,000 | RTGS |
| CONT-002 | Ramesh Nair | AGR-001 | ₹10,00,000 | NEFT |
| CONT-003 | Kavitha Subramaniam | AGR-002 | ₹10,00,000 | RTGS |
| CONT-004 | Suresh Mehta | AGR-005 | ₹15,00,000 | RTGS |
| CONT-005 | Anitha Krishnan | AGR-006 | ₹30,00,000 | RTGS |
| CONT-006 | Anitha Krishnan | AGR-006 | ₹20,00,000 | RTGS |
| CONT-007 | Vinod Patel | AGR-009 | ₹8,00,000 | NEFT |

Total capital in mock data: ₹1,08,00,000

#### CEO Investments — 6 records

| Code | Business | Agreement | Principal | Status |
|---|---|---|---|---|
| INV-001 | Sharma Agro Exports | AGR-003 | ₹15,00,000 | ACTIVE |
| INV-002 | Nambiar Textiles | AGR-004 | ₹8,00,000 | PARTIALLY_REPAID |
| INV-003 | Bhat Infrastructure | AGR-007 | ₹15,00,000 | ACTIVE (M1) |
| INV-004 | Bhat Infrastructure | AGR-007 | ₹10,00,000 | ACTIVE (M2) |
| INV-005 | Bhat Infrastructure | AGR-007 | ₹5,00,000 | ACTIVE (M3) |
| INV-006 | Kerala Spice Trading | AGR-008 | ₹5,00,000 | ACTIVE |

Total deployed in mock data: ₹58,00,000

### New hooks (`client/src/mocks/contributionHooks.ts`)

- `useContributions(filters)` — filters by search, partnerId, paymentMethod
- `useContribution(id)` — single contribution by ID
- `useInvestments(filters)` — filters by search, ceoId, status, paymentMethod
- `useInvestment(id)` — single investment by ID

### `/capital-contributions` — Capital Contributions list page

- Search by code, reference number, notes
- Filter by partner (individual partner dropdown)
- Filter by payment method (RTGS / NEFT / UPI / Cheque)
- **Running total** of filtered contributions displayed in filter bar trailing slot
- Data table columns: Code (with icon) / Partner (linked) / Agreement (linked) / Date / Amount (INR, green) / Method / Reference / Notes
- Empty state with clear-filters action

### `/ceo-investments` — CEO Investments list page

- Search by code, purpose, reference number
- Filter by business (individual CEO dropdown populated from mock)
- Filter by status (Active / Partially repaid / Fully repaid / Written off)
- Filter by payment method
- **Total deployed** running total in filter bar trailing slot
- Data table: Code / Business+CEO avatar link / Agreement link / Date / Principal (INR, amber) / Purpose / Method / Status badge
- Empty state with clear-filters action

### New CSS classes

- `.ledger-code-cell` — icon + monospace code inline pair
- `.entity-link` — accent-coloured cross-reference links
- `.entity-link--muted` — muted cross-reference links (agreement codes)
- `.filter-trailing-stats` — flex container for record count + running total
- `.filter-total-amount` — compact amount label in filter bar

### Routing

Two new routes in `App.tsx`:

```
/capital-contributions  → CapitalContributionsPage
/ceo-investments        → CEOInvestmentsPage
```

---

## Validation

```
client:typecheck  — 0 errors
npm test          — 33 tests pass (4 test files)
client:build      — 2278 modules, 475 kB JS / 38 kB CSS, built in 1.40 s
```

---

## Assumptions and limitations

- Contribution and investment records link to their `ledger_transaction_id` in the mock data. The relationship to the authoritative ledger transaction is established structurally; Stage 6 will implement the transaction ledger page that drill-through links will resolve to.
- No create/record form is implemented — the "Record Contribution" and "Record Investment" buttons are rendered but non-functional, consistent with Stage 5 scope.
- Payment method filter options are hard-coded (RTGS / NEFT / UPI / Cheque). Production will derive available methods from actual data.
- Purpose text in the investments table is truncated via CSS at 220 px; full text is visible in the CEO detail Investments tab (Stage 3).

---

## Next stage

Stage 6 — Transaction Ledger: authoritative ledger list page, full filtering by type/direction/party/agreement/date, transaction type badges, reversal foundation.
