# CapitalOS Stage 4 — Agreements

## Result

Stage 4 delivers fully functional Agreement list and detail pages covering all three profit types (PERCENTAGE, FIXED, CUSTOM), all profit frequencies, and both party types (PARTNER, CEO). TypeScript, tests, and the production build all pass clean.

---

## What was built

### Mock data extended

`client/src/mocks/data.ts` now contains **10 agreements** spanning:

| Code | Party | Profit type | Frequency | Status |
|---|---|---|---|---|
| AGR-001 | Partner (PTR-001) | PERCENTAGE 12% | QUARTERLY | ACTIVE |
| AGR-002 | Partner (PTR-002) | FIXED ₹50,000 | MONTHLY | ACTIVE |
| AGR-003 | CEO (CEO-001) | PERCENTAGE 15% | QUARTERLY | ACTIVE |
| AGR-004 | CEO (CEO-002) | PERCENTAGE 18% | MONTHLY | ACTIVE |
| AGR-005 | Partner (PTR-003) | FIXED ₹1,12,500 | QUARTERLY | ACTIVE |
| AGR-006 | Partner (PTR-004) | PERCENTAGE 14% | YEARLY | ACTIVE |
| AGR-007 | CEO (CEO-003) | CUSTOM | YEARLY | ACTIVE |
| AGR-008 | CEO (CEO-004) | FIXED ₹20,000 | MONTHLY | ACTIVE |
| AGR-009 | Partner (PTR-005) | PERCENTAGE 10% | YEARLY | COMPLETED |
| AGR-010 | CEO (CEO-004) | CUSTOM | CUSTOM | DRAFT |

Edge cases covered: CUSTOM profit terms, CUSTOM frequency terms, open-ended agreements, completed agreements, draft agreements.

### New hooks (`client/src/mocks/agreementHooks.ts`)

- `useAgreements(filters)` — filters by search text, partyType, profitCalculationType, status
- `useAgreement(id)` — single agreement by ID

Both follow the same `{ data, isLoading, error }` shape as Stage 3 hooks for zero-friction replacement with Catalyst API calls.

### `/agreements` — Agreement list page

- Search by code, repayment terms, notes
- Filter by party type (ALL / Partners / CEOs-Businesses)
- Filter by profit calculation type (ALL / Percentage / Fixed / Custom)
- Filter by status (ALL / Active / Completed / Cancelled / Draft)
- Record count badge
- Sortable data table:
  - Agreement code + party name sub-label
  - Party type chip (green for Partner, amber for CEO)
  - Capital amount (compact INR)
  - Profit type + rate/fixed-amount inline summary
  - Frequency
  - Start / End dates
  - Status badge
- Empty state with clear-filters action

### `/agreements/:id` — Agreement detail page

Sections:

| Section | Fields |
|---|---|
| Header strip | Party type label, linked party name, status badge |
| Capital and period | Capital amount, start date, end date |
| Profit structure | Profit calculation type, rate or fixed amount, frequency; CUSTOM and CUSTOM-FREQUENCY terms shown in amber callout blocks |
| Repayment and payment terms | Principal repayment terms, profit payment terms (two-column grid) |
| Supporting document | Document ID or "no document" with attach button |
| Notes | CFO notes (when present) |
| Audit timestamps | Created / Updated dates |

### CSS added to `styles.css`

- `.party-type-chip` with `--partner` (green) and `--ceo` (amber) variants
- `.profit-type-chip` and `.profit-rate-detail` inline label pair
- `.agreement-detail-layout`, `.agreement-header-strip` family
- `.agreement-section`, `.agreement-section__title`
- `.agreement-grid-3`, `.agreement-field`, `.agreement-field__value--prominent`
- `.agreement-custom-terms` amber callout block
- `.agreement-terms-grid`, `.agreement-terms-block`
- `.agreement-doc-ref`, `.agreement-no-doc`
- `.agreement-timestamps`
- Responsive breakpoints: 3-col → 2-col → 1-col at 900 px and 767 px

### Routing

Two new routes in `App.tsx`:

```
/agreements         → AgreementsPage
/agreements/:id     → AgreementDetailPage
```

---

## Validation

```
client:typecheck  — 0 errors
npm test          — 33 tests pass (4 test files)
client:build      — 2275 modules, 461 kB JS / 37 kB CSS, built in 1.41 s
```

---

## Assumptions and limitations

- Agreement ownership validation (party_id matching agreement party_type) is enforced in the existing `shared/src/validation/entities.ts` Zod schema. The pages display agreements from mock data; no create/edit form is implemented yet — `New Agreement` and `Edit agreement` buttons are rendered but non-functional, consistent with Stage 4 scope.
- The CUSTOM profit type is always rendered separately from PERCENTAGE and FIXED. No silent fallback occurs.
- Party names are resolved from mock arrays; production will resolve through server-joined responses.
- The `/agreements` path did not previously exist in the sidebar navigation items; the existing navigation entry (`/agreements`) now routes to `AgreementsPage` instead of `ModulePage`.

---

## Next stage

Stage 5 — Contributions and Investments: Partner capital contribution recording, CEO investment recording, supporting document hooks, validation.
