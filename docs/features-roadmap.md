# CapitalOS — Confirmed Feature Roadmap

> Approved by CFO on 2026-06-09.  
> These 9 features are prioritised and scoped for implementation.

---

## Feature Index

| # | Feature | Priority | Effort | Stage Target |
|---|---|---|---|---|
| F1 | Bulk Payment Recording | 🔴 Critical | Medium | Stage 8 |
| F2 | In-App Notifications / Alerts | 🔴 High | Medium | Stage 8 |
| F3 | Quick-Pay from Dashboard | 🔴 High | Low | Stage 8 |
| F4 | Document Upload & Attachment | 🔴 High | Medium | Stage 9 |
| F5 | CEO Overdue Escalation Tracking | 🟡 Medium | Low | Stage 8 |
| F6 | Financial Summary Reports | 🟡 Medium | Medium | Stage 10 |
| F7 | Credit Card Bill Alerts (In-App) | 🟡 Medium | Low | Stage 8 |
| F8 | Global Search | 🟢 Medium | Low | Stage 9 |
| F9 | Soft-Delete Recovery UI | 🟢 Low | Low | Stage 9 |

---

## F1 — Bulk Payment Recording ("Pay All Pending" flow)

### Problem
The CFO pays multiple partners in one sitting (monthly/quarterly cycle). Recording each payment one-by-one across the profit schedule is slow and error-prone.

### Solution
A multi-step bulk payment workflow:

1. **Select** — CFO sees all partners/CEOs with pending profit or due principal in a checklist table.
2. **Review** — Shows total amount to be paid, per-party breakdown, and flags overdue items.
3. **Confirm** — One "Post all payments" action creates individual `LedgerTransaction` rows for each party and marks their `ProfitSchedule` entries as `PAID`.

### UI Location
- New button **"Run Payment Cycle"** on `DashboardPage` and `ProfitSchedulePage`.
- Opens a full-screen modal or a dedicated `/payment-cycle` page.

### Data Changes
- No new schema tables needed.
- Creates `N` `LedgerTransaction` rows (type: `PARTNER_PROFIT_PAID` or `PARTNER_PRINCIPAL_PAID`).
- Updates corresponding `ProfitSchedule` rows: `paidProfit += amount`, `status → PAID`.

### Acceptance Criteria
- [ ] CFO can select any subset of pending items (not forced to pay all).
- [ ] Each payment has an optional reference number and notes field.
- [ ] Summary shows total payout before confirmation.
- [ ] After posting, all selected schedule entries are marked PAID and ledger entries appear.
- [ ] Cannot post zero-amount payments.

---

## F2 — In-App Notifications / Alerts

### Problem
Overdue items are shown on the dashboard but only if the CFO opens the app and looks. There is no proactive system to surface urgent items.

### Solution
A persistent **notification bell** in the TopBar that shows a badge count for unread alerts. Alerts are generated from business rules evaluated at page load / on a schedule.

### Alert Types

| Alert | Trigger | Severity |
|---|---|---|
| Profit payment overdue | `ProfitSchedule.status === OVERDUE` | 🔴 Critical |
| Principal return due in 7 days | `returnDate - today <= 7` | 🟡 Warning |
| CEO has not paid in 60+ days | No `CEO_PROFIT_RECEIVED` or `CEO_PRINCIPAL_RECEIVED` in 60 days | 🟡 Warning |
| Credit card bill due in 5 days | `card.nextDueDate - today <= 5` | 🟡 Warning |
| Agreement expiring in 30 days | `agreement.endDate - today <= 30` | 🟢 Info |
| Overpayment detected | `calculateScheduleStatus` returns `overpaymentDetected: true` | 🔴 Critical |

### UI Components
- **Bell icon** in `TopBar` with unread count badge.
- **Notification panel** (slide-in drawer) listing alerts grouped by severity.
- Each alert is a clickable row that navigates to the relevant entity.
- Alerts can be **marked as read** (dismissed until the next trigger).

### State
- Notification state lives in `store.ts` as a computed list derived from existing data.
- No backend required for MVP — all derived in-memory from current app state.
- Read/dismissed state stored in `localStorage` (keyed by alert ID).

### Acceptance Criteria
- [ ] Bell shows correct unread count on load.
- [ ] Clicking an alert navigates to the relevant page/entity.
- [ ] Alerts can be dismissed individually or all-at-once.
- [ ] Critical alerts use red styling, warnings use amber, info uses blue.
- [ ] Count re-evaluates when store data changes (reactive).

---

## F3 — Quick-Pay from Dashboard

### Problem
Clicking an overdue item on the dashboard navigates away to a list page. The CFO needs to record a quick payment without losing the overview context.

### Solution
An inline **Quick-Pay modal** triggered directly from:
- Overdue rows in the dashboard's capital/profit obligation tables.
- The quick actions bar ("Pay X pending profits").

### Modal Contents
- Party name (locked, read-only).
- Payment type: Principal / Profit (pre-selected based on context).
- Amount (pre-filled with the pending amount, editable).
- Amount in words (auto-generated using `amountToWords`).
- Payment date (defaults to today).
- Payment method (dropdown: NEFT, RTGS, IMPS, Cash, UPI).
- Reference number (optional).
- Notes (optional).
- **Post Payment** button.

### Data Changes
- Creates one `LedgerTransaction` row.
- Updates the matching `ProfitSchedule` row.

### Acceptance Criteria
- [ ] Modal opens without navigating away from dashboard.
- [ ] Amount field shows live "amount in words" as CFO types.
- [ ] Posting clears the pending entry from the dashboard table immediately (optimistic update).
- [ ] Error state if amount exceeds outstanding balance.

---

## F4 — Document Upload & Attachment

### Problem
`documentId` exists on Agreements, Contributions, Investments, and Transactions — but is always `null`. Financial records without document proof are not audit-ready.

### Solution
Allow the CFO to upload and attach documents (PDFs, images) to any financial record.

### Supported Record Types
- Agreement → signed agreement PDF
- Partner Contribution → bank transfer screenshot / receipt
- CEO Investment → disbursement receipt
- Ledger Transaction → payment confirmation / bank statement line

### Storage
- Catalyst **File Store** bucket for document blobs.
- `DocumentMetadata` table (already in domain model) stores: `fileName`, `fileType`, `sizeBytes`, `storageReference`, `uploadedBy`, `createdAt`.
- Each linked record's `documentId` foreign key is updated on upload.

### UI Components
- **Attach Document** button on each detail page and record row.
- Upload zone: drag-and-drop or file picker (PDF, PNG, JPG; max 10 MB).
- Attached documents shown as a **document chip** with: file icon, file name, upload date, download link.
- **View** opens document in a new tab. **Remove** soft-deletes the association (does not delete the file immediately).

### Acceptance Criteria
- [ ] Can upload and view a document against an Agreement.
- [ ] Can upload and view a document against a Contribution or Transaction.
- [ ] File name and size shown on the chip.
- [ ] Upload progress indicator shown during upload.
- [ ] 10 MB file size limit enforced client-side.
- [ ] Removing association does not delete the physical file.

---

## F5 — CEO Overdue Escalation Tracking

### Problem
There is no way to track whether a CEO is in good standing, delayed, or in default. The CFO manages risk across multiple CEO relationships and needs at-a-glance health status.

### Solution
A derived **payment health status** per CEO, surfaced on the CEO list and detail page.

### CEO Payment Health States

| Status | Definition |
|---|---|
| `GOOD_STANDING` | No overdue schedule entries; last payment within the expected frequency window. |
| `DELAYED` | 1–30 days past a due schedule entry; no payment received. |
| `OVERDUE` | 30+ days past a due schedule entry without payment. |
| `DEFAULT` | 90+ days with no payment and outstanding balance > ₹0. |
| `CONCLUDED` | CEO status is INACTIVE and all principal/profit settled. |

### Additional Fields (CEO Detail Page)
- **Days since last payment** (derived from latest `CEO_PRINCIPAL_RECEIVED` or `CEO_PROFIT_RECEIVED` in ledger).
- **Payment promise date** — a CFO-editable date field (e.g. "CEO promised to pay by 15 Jun").
- **Escalation notes** — a free-text field for CFO to log calls, reminders, decisions.
- **Overdue history** — a timeline of past overdue periods.

### UI Changes
- `CEOsPage` list: add a `Health` column with coloured status badge.
- `CEODetailPage`: new **Repayment Health** section showing status, days overdue, last payment date, promise date, and escalation notes.
- Dashboard: CEO outstanding table shows health badge per CEO.

### Acceptance Criteria
- [ ] Health status is computed from the ledger — not manually set (except `DEFAULT` which may need manual confirmation).
- [ ] Promise date and escalation notes are editable by CFO.
- [ ] CEO list can be filtered by health status.
- [ ] Dashboard surfaces any CEO in OVERDUE or DEFAULT status with a red alert.

---

## F6 — Financial Summary Reports (Monthly / Quarterly / Annual)

### Problem
There is no way to get a period-level summary of inflows, outflows, profit margin, and outstanding obligations. This is critical for the CFO's own accounting and tax preparation.

### Solution
A `/reports` page with configurable period summaries and one-click export.

### Report Types

#### 1. Profit & Loss Summary
| Line | Source |
|---|---|
| Profit received from CEOs | Sum of `CEO_PROFIT_RECEIVED` transactions |
| Profit paid to partners | Sum of `PARTNER_PROFIT_PAID` transactions |
| **CFO net margin** | CEO profit received − Partner profit paid |

#### 2. Capital Flow Summary
| Line | Source |
|---|---|
| Partner capital received | Sum of `PARTNER_CAPITAL_RECEIVED` |
| CEO capital deployed | Sum of `CEO_CAPITAL_PROVIDED` |
| CEO principal returned | Sum of `CEO_PRINCIPAL_RECEIVED` |
| Partner principal returned | Sum of `PARTNER_PRINCIPAL_PAID` |
| Net capital deployed | CEO deployed − CEO returned |

#### 3. Outstanding Obligations Summary
- Per-partner: capital outstanding + profit pending.
- Per-CEO: principal outstanding + profit outstanding.
- Total liability (what CFO owes partners).
- Total receivable (what CEOs owe CFO).

### Period Selection
- Monthly: select month + year.
- Quarterly: select Q1/Q2/Q3/Q4 + year.
- Annual: select year.
- Custom: from date → to date.

### Export
- **Download CSV** — raw numbers per category.
- **Print / Save as PDF** — formatted summary card.

### Acceptance Criteria
- [ ] All three report types available.
- [ ] Period selector works for all four period types.
- [ ] CFO net margin is calculated correctly.
- [ ] CSV export works in-browser (no server call needed for MVP).
- [ ] Numbers match the transaction ledger exactly.

---

## F7 — Credit Card Bill Alerts (In-App)

### Problem
Partner capital is funded via credit cards. If the CFO misses a credit card bill, it creates personal credit risk. There's no proactive warning in the app.

### Solution
In-app alerts (integrated with F2 Notifications system) specifically for credit card bills.

### Alert Logic
```
For each CreditCard:
  nextDueDate = computeNextDueDate(card, today)
  daysUntilDue = nextDueDate - today

  if daysUntilDue <= 3  → 🔴 URGENT: "{CardName} bill due in {N} days"
  if daysUntilDue <= 7  → 🟡 WARNING: "{CardName} bill due on {date}"
  if daysUntilDue <= 14 → 🟢 INFO: "{CardName} billing cycle upcoming"
```

### UI Components
- Alerts appear in the notification panel (F2).
- A dedicated **"Bills this week"** widget on the Credit Cards page header.
- Dashboard: credit card due alerts appear in the quick actions bar (red if ≤ 3 days).

### Acceptance Criteria
- [ ] All active cards are scanned on app load.
- [ ] Alerts correctly reference the card name, partner name, and due date.
- [ ] Alert links navigate to the Credit Cards page.
- [ ] Cards with `pendingLimit === 0` (no utilisation) are excluded from urgent alerts.

---

## F8 — Global Search

### Problem
The `CommandPalette` component exists but only navigates to pages. With 10+ partners, 10+ CEOs, and hundreds of transactions, finding a specific record requires navigating to the right list and filtering manually.

### Solution
Extend the existing `CommandPalette` (triggered by `Cmd+K` / `Ctrl+K`) to search across all entity types.

### Search Scope

| Entity | Searchable Fields |
|---|---|
| Partners | `name`, `partnerCode`, `phone`, `email` |
| CEOs | `ceoName`, `businessName`, `ceoCode`, `phone` |
| Agreements | `agreementCode`, party name |
| Partner Contributions | `contributionCode`, `referenceNumber`, amount |
| CEO Investments | `investmentCode`, `referenceNumber`, purpose |
| Ledger Transactions | `transactionCode`, `referenceNumber`, notes |

### UX
- Results grouped by type: Partners / CEOs / Agreements / Transactions.
- Top 3 results per group shown, with a "Show more" option.
- Keyboard navigable (↑ ↓ Enter to select).
- Selecting a result navigates to the detail page for that record.
- Amount search: entering "50000" matches transactions/contributions with that amount.

### Acceptance Criteria
- [ ] `Cmd+K` opens the palette from anywhere in the app.
- [ ] Results appear within 100ms (in-memory search).
- [ ] All 6 entity types are searchable.
- [ ] Keyboard navigation works correctly.
- [ ] Selecting a result closes the palette and navigates to the entity.

---

## F9 — Soft-Delete Recovery UI

### Problem
The domain and tests have soft-delete logic but there is no UI to view or restore soft-deleted records. The CFO has no safety net if a record is accidentally deleted.

### Solution
A **"Deleted Records"** section in `SettingsPage` with view and restore capability.

### Behaviour
- Soft-deleted records have a `deletedAt` timestamp and a `deleted: true` flag (or equivalent in the Catalyst Data Store).
- The recovery UI fetches records where `deleted = true`.

### UI
- Located at `/settings` under a new **"Deleted Records"** tab.
- Table per entity type: Partners, CEOs, Agreements, Contributions, Transactions.
- Each row shows: record code, name/description, deleted date, **Restore** button.
- Restoring sets `deleted = false` and clears `deletedAt`.
- A **"Permanently delete"** option is available (requires confirmation modal).

### Safety Rules
- Restoring a `PartnerContribution` does NOT automatically restore its linked `LedgerTransaction` — CFO must restore each explicitly.
- Cannot restore a record whose parent is soft-deleted (e.g. cannot restore a contribution if the partner is deleted — must restore partner first).

### Acceptance Criteria
- [ ] Deleted records do not appear in any list or search result.
- [ ] `/settings` shows deleted records grouped by type.
- [ ] Restore works and record immediately reappears in its list.
- [ ] Permanent delete requires a typed confirmation.
- [ ] Parent-before-child restore rule is enforced with a clear error message.

---

## Implementation Order (Recommended)

```
Stage 8  →  F3 Quick-Pay  →  F7 CC Bill Alerts  →  F2 Notifications  →  F5 CEO Escalation  →  F1 Bulk Payment
Stage 9  →  F8 Global Search  →  F9 Soft-Delete Recovery  →  F4 Document Upload
Stage 10 →  F6 Financial Reports
```

**Rationale:**
- F3 and F7 are low-effort, high-impact daily-use features.
- F2 (notifications) depends on F7's alert logic being defined first.
- F1 (bulk payment) is the most complex and needs F3 (single payment modal) as a foundation.
- F4 (documents) needs the Catalyst File Store backend wired up — Stage 9+ only.
- F6 (reports) is pure calculation + UI — safe to defer until data is real (not mock).

---

*Document created: 2026-06-09 | Author: Sahaa AI (PM mode)*
