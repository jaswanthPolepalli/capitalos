# Cashback sharing

Cashback is additional money shared with a partner on an original card contribution. It never settles regular profit or reduces principal. Each contribution holds at most one cashback settlement; edits replace its value and its derived `l-cb-<allocationId>` ledger entry. The existing append-only activity history captures before and after values.

Statuses: `review`, `unpaid`, `paid`, `not_applicable`. Existing card contributions with no cashback field display Needs review without changing stored data. New card contributions start unpaid. Imported historical contributions require review. Combined contributions have no new cashback entitlement: settle each original card contribution, including after combination or capital return.

Pending and review entries remain visible regardless of the month selector. Paid entries use their payment date; not applicable entries appear only when explicitly filtered. A compact responsive list shows the reason for visibility. Profit and cashback have independent status filters, with a view selector for either or both. The form defaults to today's India date, allows historical dates between contribution and today, and accepts positive whole rupees (the app's existing payment precision). For contributions received before today, the amount may be blank when marking historical cashback paid: it is stored as null and displayed as Amount not recorded. It remains in the paid list and ledger with an explicit unknown-amount marker; monetary totals exclude it until corrected. Incomplete payment confirmations are not sent. Changes from paid to another status remove the derived payment while retaining its audit history. Email is opt-in, especially for historical corrections; WhatsApp is shared manually after saving.

## Schema and deployment

This implementation requires the additive nullable TEXT column `COS_Allocations.cashback_data` described in `infrastructure/cashback-column.json`. The legacy IaC schema does not define the five existing COS core tables; do not import the full legacy template into this project. Add only this column, with no default and no backfill. Check its name/type/length and function read/write access in the target environment before deploying application code.

Deployed to the active Development project on 6 October 2026; see [release evidence and rollback](deployment-cashback-2026-10-06.md). Before applying this schema or deploying to another environment, satisfy both gates in DEPLOYMENT.md: fresh verified complete data backup and independently verified redeployment of the previous hosted application with its runtime/configuration. Capture exact environment-specific rollback commands and smoke checks in the release record. Local tests and build artifacts do not establish these gates.

Rollback keeps the additive column and the cashback data: the previous application ignores it. If rollback occurs after cashback transactions, retain/export and reconcile those transactions before using the older application operationally. Never restore the pre-release database over later transactions. A return to the new application restores visibility of retained cashback data.

## Release smoke checks

1. Old card contribution shows Needs review; cash and combined entries are excluded.
2. New card contribution starts Not paid. Mark one Not applicable and verify exclusion from Cashback not paid.
3. Fully returned old contribution remains pending across month navigation and displays why.
4. Record cashback; reload and confirm exactly one ledger entry, plus independent profit and principal balances.
5. Edit amount/date; reload and confirm the same ledger ID and audited previous value.
6. Confirm original combined sources can settle cashback without changing their financial combination history.
7. Check payment form, status filters, and ledger links at 320px/390px and desktop widths.
8. Explicitly request a cashback email to an approved test recipient; verify Cashback Sharing wording. Preview WhatsApp without sending.
9. Verify contribution/partner deletion hides the cashback payment and restoration restores it.

## Earnings totals

Allocation, partner, and portfolio summaries expose regular profit paid, cashback paid, and total profits received (the sum of the first two). Dashboard, partner views, portal, ledger, reports, statements, exports, and monthly statement emails keep these separate. Pending regular profit continues to use the existing expected-profit/cycle settlement rules and regular profit payments only; cashback never reduces it. Unknown cashback counts identify incomplete monetary totals. Change history decodes cashback into readable status, amount, date, and notes changes while hiding internal timestamps.
