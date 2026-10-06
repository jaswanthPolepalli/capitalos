# Approved improvements — 18 September 2026

Implemented and deployed to Catalyst Development following your selection; see [release and rollback evidence](deployment-2026-09-18.md). F2 is limited to **partners and capital contributions**, as requested. Application deployment completed on 18 September 2026 after backup and isolated rollback verification. On your follow-up request, the three additive tables were created and verified in Catalyst Development using the documented connection; existing business records were not changed. No reminders or emails were sent during validation.

| Selection | Delivered behavior | Important boundary |
|---|---|---|
| S3 — Complete records | Backend walks every Catalyst page; invalid or repeated cursors fail explicitly instead of returning a partial success. | Complete retrieval uses more memory/time as data grows; server-side query pagination can follow when needed. |
| S5 — History and recovery | Deleted lists return recoverable records; restoring reloads balances/history. Parent deletion logically hides descendants, including cards, without partially updating every child. Change history preserves before/after snapshots and distinguishes confirmed from uncertain writes. | Historical edits cannot be reconstructed. Caller identity is labelled unverified because authentication was not included in this selection. Application append-only history is not a tamper-proof database. |
| S6 — Clear status and recovery | Visible loading/error/stale states, last successful refresh, read-only retry, refresh on focus/reconnect and every minute while visible. Bulk selection waits for data and reconciles later changes. | Refresh is polling, not instantaneous synchronization or protection against concurrent server writes. |
| S8 — Web/mobile usability | Statements and portal tables become labelled records on phones. Dialogs trap/restore keyboard focus, support Escape and constrain scrolling. CSV exports neutralize formula-like text while retaining numeric values. | Physical-device, pixel-layout and screen-reader acceptance remain outstanding; computer access was unavailable. |
| F1 — Better statements | Date ranges, opening and closing principal, running principal balance, separate profit payments, April–March financial-year preset, matching CSV/print output. Reports also support financial years. | Statements reflect currently recorded transactions and corrections; save a PDF for an immutable issued copy. Profit does not reduce principal. |
| F2 — Onboarding and CSV import | Setup links, partner/contribution templates, header mapping, review preview, duplicate detection, rejected-row reasons, result export and per-row outcomes. Server revalidates and reserves import fingerprints durably. | Up to 500 rows / 2 MB per file. Contributions require existing partners; import partners first. Whole rupees only, fractions rejected rather than rounded. Possible duplicates are skipped; intentional repeats can be reviewed and entered manually. |
| F4 — Due calendar/reminders | Monthly calendar, date filters, principal obligations, optional profit estimates, batch review, copyable drafts, manual sent/prepared/note/follow-up history. | No automatic sending or scheduler. “Sent” records the operator's confirmation. Follow-up dates are recorded in history; they do not themselves dispatch messages. |
| F7 — Liability planning | Cumulative upcoming 7/30/90-day commitments, overdue and undated amounts separately, partner and card/cash concentration, CSV export. | Profit forecasts are labelled estimates based on current rates, not a reconstructed unpaid-period ledger. S2 recurrence/partial-payment correctness remains outside this selection. |
| Node 24 | Root/backend engines, version files, Catalyst stack and CI aligned to Node 24; npm pinned in CI, both lockfiles installed. | Local validation ran with Node 24. Hosted runtime changes take effect only after deployment. |

New workspace routes: **Due calendar**, **Liability planning**, **CSV import** and **Change history**. Recovery stays in Settings, and statement controls remain within each partner's statement.

## S4 — Reliable recording: details for your decision

These are distinct failure modes and need more than disabling a button:

- **Concurrent combinations:** two sessions can both read the same ₹1,000 + ₹2,000 sources before either writes, then each create ₹3,000 combined capital. Concurrent returns can similarly exceed available principal. Enforce a durable per-source reservation/version check around the complete operation and validate the final balance under that protection.
- **Repeat submissions:** a timeout does not prove a save failed. Retrying can create a second payment. Give each user intent a durable idempotency key, store its request fingerprint and result, and return the original result on retry. Reusing a key with different input must fail.
- **Reinvestment:** the payment and return-date change currently use separate writes. If the second fails, the saved state is incomplete. Move the whole operation behind one server endpoint, using a datastore transaction where supported or an explicit resumable state machine with recovery/compensation. Do not assume Catalyst provides multi-table atomicity without validating its capabilities.
- **Bulk outcomes:** the existing bulk payment flow can show completion despite failures. Track success, failure and uncertain outcome per item; show a truthful summary and retry only confirmed failures with their original idempotency keys.

**Suggested next package:** durable financial-operation/idempotency records, source conflict protection, server-owned reinvestment, and per-item bulk results. Acceptance tests should cover simultaneous requests, response loss after save, interrupted multi-write operations, retries and process restarts. This package is **not implemented yet**. The new CSV import reservation protects imports only; new audit history improves diagnosis but does not make financial writes atomic.

## S6 — Implemented after your follow-up approval

- Shared store distinguishes initial/loading/ready/error state. Failed reads keep the last complete successful snapshot, including cards, instead of treating failure as empty data. A first-load failure hides empty-state screens until retry succeeds.
- Workspace and public portal show a loading/error/stale warning with read-only retry when needed. Healthy loads show one dismissible three-second success notification per tab session; routine background refreshes and navigation do not show a persistent banner. Last successful refresh time remains in the stale/error warning. A 20-second deadline ends stalled loads. A failed load never resolves a portal token against an empty cache.
- Focus, returning to a visible tab and reconnect trigger refresh; visible sessions also poll every minute. Listeners and in-flight reads are shared across components and removed when unused. No background polling occurs while hidden.
- A local save during an in-flight refresh prevents that older snapshot from replacing the saved cache; a visible stale/error state requests another refresh. Refresh failures after a saved recovery/import remain explicit.
- Bulk selection initializes only after successful loading. Later refreshes preserve existing deselections and edited fields, leave new/changed obligations unselected, remove unavailable rows, and return a changed review to selection. Loading, stale or failed data blocks bulk review/submission until refreshed.
- Retry and automatic refresh issue reads only. They never replay a financial write. Server-side version checks, idempotency, reinvestment atomicity and truthful partial bulk-write outcomes remain the separate S4 work; this change does not claim to solve concurrent financial writes.

Validated with timeout/offline/malformed response tests, complete-snapshot preservation, overlapping refresh deduplication, local-save versus refresh races, focus/reconnect/visibility polling, portal errors and bulk cold-load/review reconciliation. Physical-device acceptance remains outstanding. Development deployment and hosted smoke checks subsequently passed; see the release evidence.

## Release and verification

**Local result:** Node 24.21.0 full validation passed: 636 tests across 27 files, schema/template consistency, backend syntax, TypeScript and production build. Both lockfiles passed `npm ci --dry-run`, and the real backend module loaded on Node 24. No live services were called by these checks.

Run `npm run validate` under the Node version in `.nvmrc`. It checks schema/template consistency, backend syntax, TypeScript, the full regression suite and the production frontend build. GitHub Actions performs the same gate on pushes and pull requests, caches dependency downloads, uses `npm ci` for both packages, and cancels superseded runs. It does not deploy automatically.

Regression coverage includes actual handler execution against isolated Catalyst fixtures: more than 200 rows, failed pagination, deleted-parent visibility, restore balance checks, durable mutation snapshots, audit failure handling, concurrent duplicate imports and manual reminder recording. Component/domain coverage includes CSV mapping and review, statement reconciliation, planning, keyboard focus and responsive CSS. See [TESTING.md](../TESTING.md). These tests do not make releases foolproof or replace staged integration checks.

Before deployment, follow [DEPLOYMENT.md](../DEPLOYMENT.md): provision and verify **COS_Activity**, **COS_Reminders** and **COS_Imports**, enforce their unique constraints and permissions, then deploy the Node 24 backend and matching client. The additive migration script defaults to a read-only offline plan; the Development migration was subsequently run and verified on 18 September 2026; see the recorded IDs in DEPLOYMENT.md. A missing activity table intentionally prevents business writes.

Recovery preserves independently deleted children. Legacy deletions that previously marked every child separately must be restored individually after the parent; the old data does not reliably identify which children were deleted independently. Restores validate parent availability and returned principal. Existing inconsistent records may need correction before restoration.

No change was made to the unselected S1/S2 security and accounting work, S4 financial-write guarantees, automatic notification delivery, or native/offline mobile support. The original review remains the decision record for those items.
