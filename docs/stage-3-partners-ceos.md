# CapitalOS Stage 3 — Partners and CEOs

## Result

Stage 3 introduces fully functional Partner and CEO/Business list and detail pages, backed by realistic mock data. All existing tests continue to pass and the production build is clean.

---

## What was built

### Shared infrastructure

| File | Purpose |
|---|---|
| `client/src/types/api.ts` | Typed API response envelopes (`ApiResponse`, `PaginatedResponse`, `ApiError`) shared by every future Catalyst Function client |
| `client/src/types/domain.ts` | Client-side view models for all domain entities (Partner, CEO, Agreement, PartnerContribution, CEOInvestment, LedgerTransaction, ProfitSchedule, PortalAccess) with `bigint` paise storage |
| `client/src/lib/format.ts` | `formatINR`, `formatINRFull`, `formatINRCompact`, `formatDate`, `formatDateTime`, `formatRelativeTime` — all monetary values formatted using the Indian number system (`₹10,00,000`) |
| `client/src/mocks/data.ts` | 5 Partners, 5 CEOs, 4 Agreements, 3 Contributions, 2 Investments, 6 Transactions, 4 Profit Schedules, 3 Portal Access records — all with realistic Indian names, business names, INR amounts, RTGS/NEFT/UPI references, and varied statuses (active, inactive, overdue, partially paid) |
| `client/src/mocks/hooks.ts` | Mock hooks mirroring the TanStack Query return shape `{ data, isLoading, error, total }` with 120 ms artificial delay for loading-state testing. Includes `usePartners`, `usePartner`, `usePartnerSummary`, `usePartnerAgreements`, `usePartnerContributions`, `usePartnerTransactions`, `usePartnerSchedules`, `usePartnerPortalAccess`, and equivalent CEO hooks |

### Reusable components

| Component | Description |
|---|---|
| `StatusBadge` | Pill badge with semantic colour: active (green), inactive (neutral), overdue (red), upcoming/due (amber), partial (amber-light), warning, neutral |
| `MoneyDisplay` | Renders INR paise as formatted rupees with optional `tone` (positive/negative/pending/neutral), `compact` (`₹10L`, `₹1.5Cr`), and `prominent` (`<strong>`) variants |
| `SearchInput` | Accessible search field with icon and inline clear button |
| `SelectFilter` / `FilterBar` | Composable filter bar with trailing record count slot |
| `LoadingRows` / `LoadingCards` | Skeleton table rows and card stacks with CSS sweep animation |

### Pages

#### `/partners` — Partners list

- Search by name, code, or email (client-side via mock hook)
- Status filter (All / Active / Inactive / Suspended)
- Record count badge
- Sortable data table with per-row financial summary (capital contributed, principal outstanding, total pending)
- Staggered row entrance animation (respects `prefers-reduced-motion`)
- Empty state with clear-filters action
- Row avatar initials + code sub-label
- Click-through to partner detail

#### `/partners/:id` — Partner detail

Six-tab detail view:

| Tab | Content |
|---|---|
| Overview | 6 financial KPI cards: capital contributed, principal returned, principal outstanding, profit earned, profit paid, profit pending. Next-payment banner |
| Contributions | Table of capital contributions with code, date, amount, method, reference |
| Transactions | Ledger transactions with type, direction, separated principal/profit/total |
| Schedule | Profit schedule with expected vs paid vs pending, status badge |
| Agreements | Expanded agreement cards showing profit type, rate/fixed amount, repayment terms, profit terms |
| Portal Access | Portal link status, last access date, copy/regenerate/revoke actions |

Profile strip above tabs: avatar initial, email (mailto link), phone, address, status badge, creation date.

#### `/businesses` — CEOs/Businesses list

Mirror of Partners list with business-specific columns (Business name + CEO sub-label, capital provided, principal outstanding, total outstanding).

#### `/businesses/:id` — CEO detail

Mirror of Partner detail with business-specific tabs (Investments instead of Contributions, business portal).

---

## Routing changes

`App.tsx` now routes four dedicated paths before falling through to `ModulePage`:

```
/partners         → PartnersPage
/partners/:id     → PartnerDetailPage
/businesses       → CEOsPage
/businesses/:id   → CEODetailPage
```

All other navigation paths (Agreements, Capital Contributions, CEO Investments, Transactions, Profit Schedule, Portal Links, Documents, Reports) remain on `ModulePage` placeholders pending their respective stages.

---

## Mock data coverage (edge cases exercised)

- Partners with fully outstanding, partially returned, and fully repaid principal
- Partners with profit fully paid vs profit pending
- CEOs with active, partially repaid investments
- Overdue profit schedule entry
- Partially paid profit schedule entry
- Upcoming profit schedule entry
- Paid profit schedule entry
- Portal access active (with last-access date)
- Portal access revoked (with revoked date)
- Portal access not yet generated

---

## CSS added to `styles.css`

- `.status-badge` with 7 semantic variants
- `.money-display` with 4 tone variants
- `.search-input` with focus ring
- `.select-filter` with custom chevron
- `.filter-bar` / `.record-count`
- `.table-wrapper`, `.data-table`, `.table-th`, `.table-row`, `.table-cell` family
- `.table-name-link` with avatar variant for businesses
- `.skeleton` with keyframe sweep animation; `.skeleton--block`, `.skeleton--title`, `.skeleton--line`
- `.table-empty` / `.loading-cards`
- `.button--secondary`, `.button--danger`
- `.profile-strip` with business avatar variant
- `.detail-tabs` / `.detail-tab`
- `.detail-section` / `.fin-card` / `.fin-cards-grid`
- `.next-payment-banner`
- `.agreement-card`
- `.portal-card`
- `.detail-notes`
- Responsive breakpoints for all new patterns at 900 px, 767 px, and 420 px

---

## Validation

```
client:typecheck  — 0 errors
npm test          — 33 tests pass (4 test files)
client:build      — 2272 modules, 444 kB JS / 33 kB CSS, built in 1.33 s
```

---

## Assumptions and limitations

- Status codes accepted are `ACTIVE`, `INACTIVE`, `SUSPENDED`. The product blueprint does not enumerate exact lifecycle status values; these were chosen as the minimal sensible set and are documented as application constraints.
- Partner/CEO financial summaries are returned as pre-computed objects from the server. In Stage 7 these will be derived deterministically from the transaction ledger; the mock shape already matches what that calculation layer will produce.
- Monetary amounts in mock data are correct bigint paise and exercise both large (₹50 lakh) and small (₹20,000) values.
- No form/create workflow is implemented. `Add Partner` and `Edit partner` buttons are rendered but non-functional, consistent with Stage 3 scope.
- Mock data `nextId()` counter is module-scoped; it will produce different IDs on each hot-reload in development. Production IDs will come from Catalyst `ROWID`.

---

## Next stage

Stage 4 — Agreement CRUD: agreement creation form, edit, ownership validation, profit configuration (FIXED / PERCENTAGE / CUSTOM), party ownership enforcement.
