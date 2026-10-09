# Cashback sharing

Cashback is additional money shared with a partner on an original card contribution. It never settles regular profit or reduces principal. Each contribution holds at most one cashback settlement; edits replace its value and its derived `l-cb-<allocationId>` ledger entry. The existing append-only activity history captures before and after values.

Statuses: `review`, `unpaid`, `paid`, `not_applicable`. Every transaction displays exactly the status saved on it; no status is ever derived from, or changed by, another transaction. New and imported card transactions start Needs review. Legacy automatic unpaid defaults (without a cashback update timestamp) also display Needs review without rewriting stored records. Explicitly saved unpaid choices and historical payments are retained. Cash and combined contributions are Not applicable and have no entitlement.

One cashback per card and contribution calendar month remains the normal case, but the rule is advisory only. Changing a transaction from Needs review (or Not applicable) to **Cashback unpaid** or **Paid to partner** while another transaction in the same card/month already holds a recorded cashback shows a warning that lists those transactions with links, plus an explicit confirmation checkbox. On confirmation both are kept: the earlier transaction is not touched, its status is not rewritten, and both appear in the cashback list, follow-up, ledger, totals, reports and statements. Cancelling writes nothing. A recorded cashback (unpaid or paid) means the decision is already made there, so a legacy automatic unpaid default does not trigger the warning.

The server independently recomputes the current list of other recorded transaction IDs for that card/month and compares it with the confirmed list, rejecting a missing, incomplete or stale confirmation before any write or email. Correcting a transaction that already holds a recorded cashback — editing an amount, date or notes, or returning it to Needs review — never requires confirmation. Choosing Needs review or Not applicable never requires confirmation, because neither records a new cashback. Payment amount/date validation and opt-in email rules still apply.

Peer links are informational: a transaction without its own recorded cashback links to each cashback already recorded for that card and month, and the link opens that exact record regardless of the active month, status, search or partner filter. Clearing a transaction back to Needs review removes it from the warning list for its peers. Every recorded paid transaction, including legacy multiple payments for one card/month, displays Paid and remains visible in the paid filter, ledger, totals, reports and statements.

Each save is one audited allocation write; no peer rows are updated. The shared rule drives the API, frontend, mock preview and daily PDF/email follow-up, where every transaction in `review` or `unpaid` is followed up on its own status. No new schema, migration or hosted backfill is needed for this rule change. Earlier builds stored `selectionUpdatedAt` and `individualStatus` in the cashback JSON; both are ignored and harmless, and no cleanup is required.

Eligible unpaid and review entries remain visible across months and capital returns. Paid entries use their payment date; the linked transaction view overrides this date filter. Profit and cashback have independent filters. The form defaults to today's India date and accepts historical payment dates between contribution and today. Amounts are positive whole rupees. For historical contributions, a paid amount may be blank: it remains in financial history as Amount not recorded and contributes to totals only when corrected. Incomplete payment confirmations are not sent. Correcting a paid status removes its derived ledger payment with prior values retained in activity history. Email is opt-in; WhatsApp sharing is manual.

The warn-only monthly rule described above replaces the earlier automatic single-selection behaviour and is **not yet deployed**; it requires both release gates in DEPLOYMENT.md. Previously deployed revisions: [additional-payment confirmation](deployment-additional-cashback-2026-10-06.md), [peer review reset fix](deployment-cashback-review-reset-2026-10-06.md) and [manual selection](deployment-manual-cashback-2026-10-06.md).

## Schema and deployment

This implementation requires the additive nullable TEXT column `COS_Allocations.cashback_data` described in `infrastructure/cashback-column.json`. The legacy IaC schema does not define the five existing COS core tables; do not import the full legacy template into this project. Add only this column, with no default and no backfill. Check its name/type/length and function read/write access in the target environment before deploying application code.

Deployed to the active Development project on 6 October 2026; see [release evidence and rollback](deployment-cashback-2026-10-06.md). Before applying this schema or deploying to another environment, satisfy both gates in DEPLOYMENT.md: fresh verified complete data backup and independently verified redeployment of the previous hosted application with its runtime/configuration. Capture exact environment-specific rollback commands and smoke checks in the release record. Local tests and build artifacts do not establish these gates.

Rollback keeps the additive column and the cashback data: the previous application ignores it. If rollback occurs after cashback transactions, retain/export and reconcile those transactions before using the older application operationally. Never restore the pre-release database over later transactions. A return to the new application restores visibility of retained cashback data.

## Release smoke checks

1. A newly created card contribution shows Needs review; cash and combined entries show Not applicable.
2. Mark one transaction Cashback unpaid, then change a second transaction in the same card/month from Needs review to unpaid. Verify the warning lists the first transaction with a working link, that cancelling saves nothing, and that after confirming both show Cashback unpaid with the first one unchanged. Repeat for a second payment and verify both payments remain visible after reload, totals include both, and an unconfirmed save sends no email. Verify returning a transaction to Needs review or Not applicable asks for no confirmation and changes no peer. Other cards and calendar months remain independent.
3. Fully returned old contribution remains pending across month navigation and displays why.
4. Record cashback; reload and confirm exactly one ledger entry, plus independent profit and principal balances.
5. Edit amount/date; reload and confirm the same ledger ID and audited previous value.
6. Confirm eligible original combined sources can settle cashback without changing their financial combination history.
7. Check payment form, status filters, and ledger links at 320px/390px and desktop widths.
8. Explicitly request a cashback email to an approved test recipient; verify Cashback Sharing wording. Preview WhatsApp without sending.
9. Verify contribution/partner deletion hides the cashback payment and restoration restores it.

## Earnings totals

Allocation, partner, and portfolio summaries expose regular profit paid, cashback paid, and total profits received (the sum of the first two). Dashboard, partner views, portal, ledger, reports, statements, exports, and monthly statement emails keep these separate. Pending regular profit continues to use the existing expected-profit/cycle settlement rules and regular profit payments only; cashback never reduces it. Unknown cashback counts identify incomplete monetary totals. Change history decodes cashback into readable status, amount, date, and notes changes while hiding internal timestamps.

Recorded payments always appear in ledger, portal, reports, totals, exports and monthly statement emails. The monthly rule only warns before a new cashback decision; it never hides or changes the accounting record of money already paid.

## Direct payments and CFO split (released 8 October 2026)

The cashback list offers Pay cashback, which opens the paid form directly. New amounts are combined partner + CFO cashback, using the same 5/7 partner and 2/7 CFO default as profit payments. No cashback rate is configured, so the combined amount is entered explicitly. No CFO share sends the full amount to the partner and disables the adjustment checkbox. Change cashback % or amount overrides the partner share for this payment; percentages use invested capital, with the remainder assigned to the CFO. The form previews both shares before recording, and accepts an optional payment account/method.

The API recomputes the split, stores its metadata in the existing cashback JSON, and ignores submitted CFO totals. Partner ledger, statements, totals and sharing use only the partner amount. CFO Share includes separately identified cashback transactions. Historical payments without split metadata keep their original partner amounts and open with No CFO share selected. Unknown historical amounts remain supported. No schema migration is required. Deployed to Development after verified backup and rollback gates; see [release verification](deployment-cashback-payment-2026-10-08.md).
