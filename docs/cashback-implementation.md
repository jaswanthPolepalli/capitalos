# Cashback sharing

Cashback is additional money shared with a partner on an original card contribution. It never settles regular profit or reduces principal. Each contribution holds at most one cashback settlement; edits replace its value and its derived `l-cb-<allocationId>` ledger entry. The existing append-only activity history captures before and after values.

Statuses: `review`, `unpaid`, `paid`, `not_applicable`. Cashback normally uses one selected original transaction per card and calendar month, with confirmed additional payments allowed; transaction order does not decide eligibility. New and imported transactions start Needs review. Legacy automatic unpaid defaults (without a cashback update timestamp) also display Needs review without rewriting stored records. Explicitly saved unpaid choices and historical payments are retained. Cash and combined contributions have no new entitlement.

Marking a transaction unpaid, or recording the first paid cashback without an existing selection, selects it. Its peers automatically display Not applicable and link to the selected transaction. The Not applicable filter exposes these peers; the selected-transaction link opens that exact record regardless of the active month, status, search or partner filter. The first-transaction status/filter is removed. Selecting a different unpaid transaction moves the selection. Choosing Needs review on the selected transaction or any excluded peer clears an unpaid selection for that card/month and returns its automatically excluded peers to review; manually marked Not applicable entries keep that status. A paid selection must be corrected before moving the default selection to unpaid or returning its automatically excluded peers to Needs review. The form rejects a peer review reset while payment is recorded and links to the selected transaction. Existing historical payment amounts remain in financial history, even if multiple old payments exist for a card/month; they are not silently erased to enforce eligibility.

An additional transaction may be marked Paid without changing any other raw or displayed status. If another payment exists for the same card and contribution calendar month, the form lists links to those payments and requires an explicit confirmation checkbox. The server independently checks the current list of other paid transaction IDs against the confirmed list, rejecting missing or stale confirmation before any write or email. Editing an already-paid amount/date does not require another confirmation. Payment amount/date validation and opt-in email rules still apply.

Additional payments use server-generated `individualStatus` metadata in the existing cashback JSON. They are excluded from the default monthly selection decisions, and later corrections to these entries remain independent. When an unpaid selection already exists, recording a different transaction as Paid retains that unpaid selection. Every recorded paid transaction, including legacy multiple payments, displays Paid and remains visible in the paid filter, ledger, totals, reports and statements. No migration or backfill is needed.

Selection decisions use a server-generated timestamp in the existing cashback JSON, with a stable ID tie-breaker. A new decision supersedes previous unpaid choices, including when a selection is cleared. Each save uses one audited allocation write; derived peer statuses do not require a multi-row update. The shared rule drives the API, frontend, mock preview and daily PDF/email follow-up. Default paid selections take precedence over unpaid choices; independently recorded payments do not move that selection and cannot be hidden by it. No new schema or hosted backfill is needed for this rule change.

Eligible unpaid and review entries remain visible across months and capital returns. Paid entries use their payment date; the linked transaction view overrides this date filter. Profit and cashback have independent filters. The form defaults to today's India date and accepts historical payment dates between contribution and today. Amounts are positive whole rupees. For historical contributions, a paid amount may be blank: it remains in financial history as Amount not recorded and contributes to totals only when corrected. Incomplete payment confirmations are not sent. Correcting a paid status removes its derived ledger payment with prior values retained in activity history. Email is opt-in; WhatsApp sharing is manual.

The additional-payment confirmation revision is deployed; see [release verification and rollback](deployment-additional-cashback-2026-10-06.md). The peer review reset fix is deployed; see [reset release verification](deployment-cashback-review-reset-2026-10-06.md). The manual-selection revision is deployed to the active Development app. See [release verification and rollback](deployment-manual-cashback-2026-10-06.md).

## Schema and deployment

This implementation requires the additive nullable TEXT column `COS_Allocations.cashback_data` described in `infrastructure/cashback-column.json`. The legacy IaC schema does not define the five existing COS core tables; do not import the full legacy template into this project. Add only this column, with no default and no backfill. Check its name/type/length and function read/write access in the target environment before deploying application code.

Deployed to the active Development project on 6 October 2026; see [release evidence and rollback](deployment-cashback-2026-10-06.md). Before applying this schema or deploying to another environment, satisfy both gates in DEPLOYMENT.md: fresh verified complete data backup and independently verified redeployment of the previous hosted application with its runtime/configuration. Capture exact environment-specific rollback commands and smoke checks in the release record. Local tests and build artifacts do not establish these gates.

Rollback keeps the additive column and the cashback data: the previous application ignores it. If rollback occurs after cashback transactions, retain/export and reconcile those transactions before using the older application operationally. Never restore the pre-release database over later transactions. A return to the new application restores visibility of retained cashback data.

## Release smoke checks

1. All unselected original card contributions show Needs review; cash and combined entries are excluded.
2. Select a later transaction as unpaid and verify its peers become Not applicable with a working link. Switch the unpaid choice and clear it; verify peers recalculate. Other cards and calendar months remain independent. A further payment requires confirmation when another paid cashback exists. Verify all other statuses stay unchanged, both payments remain visible after reload, totals include both, and an unconfirmed save sends no email.
3. Fully returned old contribution remains pending across month navigation and displays why.
4. Record cashback; reload and confirm exactly one ledger entry, plus independent profit and principal balances.
5. Edit amount/date; reload and confirm the same ledger ID and audited previous value.
6. Confirm eligible original combined sources can settle cashback without changing their financial combination history.
7. Check payment form, status filters, and ledger links at 320px/390px and desktop widths.
8. Explicitly request a cashback email to an approved test recipient; verify Cashback Sharing wording. Preview WhatsApp without sending.
9. Verify contribution/partner deletion hides the cashback payment and restoration restores it.

## Earnings totals

Allocation, partner, and portfolio summaries expose regular profit paid, cashback paid, and total profits received (the sum of the first two). Dashboard, partner views, portal, ledger, reports, statements, exports, and monthly statement emails keep these separate. Pending regular profit continues to use the existing expected-profit/cycle settlement rules and regular profit payments only; cashback never reduces it. Unknown cashback counts identify incomplete monetary totals. Change history decodes cashback into readable status, amount, date, and notes changes while hiding internal timestamps.

The manual monthly selection rule preserves already-recorded payments in ledger, portal, reports, totals, exports and monthly statement emails, even when a later correction changes eligibility. Eligibility controls new settlement and follow-up, not the accounting record of money already paid.

## Direct payments and CFO split (released 8 October 2026)

The cashback list offers Pay cashback, which opens the paid form directly. New amounts are combined partner + CFO cashback, using the same 5/7 partner and 2/7 CFO default as profit payments. No cashback rate is configured, so the combined amount is entered explicitly. No CFO share sends the full amount to the partner and disables the adjustment checkbox. Change cashback % or amount overrides the partner share for this payment; percentages use invested capital, with the remainder assigned to the CFO. The form previews both shares before recording, and accepts an optional payment account/method.

The API recomputes the split, stores its metadata in the existing cashback JSON, and ignores submitted CFO totals. Partner ledger, statements, totals and sharing use only the partner amount. CFO Share includes separately identified cashback transactions. Historical payments without split metadata keep their original partner amounts and open with No CFO share selected. Unknown historical amounts remain supported. No schema migration is required. Deployed to Development after verified backup and rollback gates; see [release verification](deployment-cashback-payment-2026-10-08.md).
