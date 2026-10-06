# Editing audit

Reviewed the active routes in `client/src/App.tsx`, their input forms, store mutations, and API PATCH handlers. Unrouted legacy business/agreement/transaction pages are not part of the active app.

| Record | Editable values | Entry points |
| --- | --- | --- |
| Partner | Name, phone, email, notes | Partner detail |
| Contribution | Amount, monthly profit rate (including zero), date given, payment source/card, return date, notes | Contributions, Ledger, partner detail |
| Profit payment | Amount, paid date, partial status, remaining rupees or percentage, recurring status, notes/reference text | Profits payment history, Ledger, partner payment history |
| Capital return | Amount, returned date, notes | Ledger, partner return history |
| Credit card | Name, limit, available limit, bill date, due date, notes | Credit Cards |
| Return obligation | Return date (including clearing it) | Return Obligations, contribution editor |

Dashboard, reports, statements and public portals display these records or calculated totals. Bulk and quick payments produce records editable through the same payment editors. Portal URLs are generated rather than entered. Settings exposes preferences and restore actions rather than another financial record type.

Record IDs, creation timestamps, partner/allocation ownership relationships, and computed balances remain managed by the application. Original records captured by a capital combination retain their existing history protection; the combined entry's amount, effective date and funding source are fixed by that history. The existing combination revert flow is needed before correcting protected source records.

The shared editors preserve the existing API and notes-tag storage format. Percentage-based remaining profit survives an unrelated edit, workflow checkboxes can be turned on or off, confirmation tags are preserved, and clearing notes updates the Ledger immediately. Failed saves leave the editor open with an error. Return edits reject amounts greater than available capital.

Validation: `npm run validate`, including interaction tests in `tests/edit-records-ui.test.jsx` for persisted partial/recurring edits, percentage preservation, flag removal, save failures, zero-rate contribution edits and excessive returns.

Grouped payments are available from partner detail, Profits, and Contributions. Select entries belonging to one partner, then choose **Record selected profit** or **Return selected capital**. The review form accepts one date/reference and editable amounts for each row. Smaller profit payments automatically store the remaining balance; capital returns leave profit obligations intact. The completion screen offers one WhatsApp message with the recorded total and entry breakdown, without internal entry IDs. Profit rows show the actual amount paid as a percentage of the listed original contribution (not a monthly rate). Remaining amounts are explicitly scoped to each listed entry as of that payment. Live grouped actions send one consolidated email to the partner’s saved email address after all selected entries are confirmed. The email uses the same per-entry amounts, actual profit percentages, and scoped remaining balances as WhatsApp, without internal entry IDs. Local mock mode sends no emails and explicitly reports that email is disabled.

Each payment remains individually editable and carries a persistent `paymentGroupId`. Group metadata is stored alongside the existing notes format, stripped from displayed notes, and preserved by edits, deletion, and restore. No hosted schema change is required.

The API validates the whole selection against current balances before starting. A unique, append-only activity intent reserves the group, so double submission or checking a lost response cannot create a second copy. Datastore writes are sequential, not transactional: if a write or its audit confirmation fails, later rows are not attempted. The result identifies recorded, unconfirmed, and unattempted rows; only confirmed rows appear in the share message. Unconfirmed writes require inspection of payment history and Activity before recording another payment. The existing older Bulk Payment page remains separate.

Validation includes `tests/grouped-payments-api.test.jsx` and `tests/grouped-payments-ui.test.jsx`: five-row settlement, automatic partial balances, capital/profit separation, mixed-partner and stale-balance rejection, preserved group metadata, repeated/concurrent submissions, interrupted writes, lost-response recovery, selection from all three pages, and consolidated WhatsApp contents.

Grouped email delivery has its own unique, append-only Activity reservation. Repeated requests and concurrent copies do not submit another email after a sending attempt has been reserved. Missing addresses and incomplete groups skip email; SMTP/audit failures leave financial records intact and return an unconfirmed email status. An interrupted attempt is not retried automatically because SMTP may have accepted it before the response was lost. Payment completion shows sent, skipped, unconfirmed, or mock-disabled email status. No schema migration is required. Tests use a stub mail transport; no actual partner emails are sent during validation.


Monthly partner statements are implemented as the private `capitalos-month-end` Job Function, configured for 10 AM IST on the last calendar day. They consolidate the month's contributions, returns and paid profit, with opening/closing capital and recorded unpaid profit at the displayed cutoff (including older dues). Each partner/month snapshot and send attempt is preserved in Activity. Mock/disabled runs exit before touching datastore or SMTP. The job and cron remain disabled until deployment and activation; see [month-end statement setup and recovery](month-end-statements.md).
