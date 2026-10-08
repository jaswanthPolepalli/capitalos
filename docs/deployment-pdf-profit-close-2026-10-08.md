# PDF download, cashback ordering and zero-payment profit closure — 8 October 2026

Deployed and verified in **Development**, organization `60088793510`, project `71834000000017016`.

## Behavior

Reports now offers **Download PDF** alongside **Send summary email**. Both use the same complete current-position report; downloading does not email anyone or create an Activity send reservation. Cashback follow-up is sorted by amount-given date ascending, with partner/card tie-breakers.

The regular profit form, partner-detail profit form and profit Quick Pay offer **Close profit without payment** for a pending balance. A separate warning names the balance being waived, explains that no money is paid and principal is unchanged, and requires **Accept and close profit**. No amount entry is required. Cancellation writes nothing. Regular profit entry remains positive-amount only.

The server checks confirmation, contribution/partner, current pending balance, future-dated records and recurrence eligibility. It records an audited ₹0 closure dated today in IST, preserving previous payments and the waived balance in its notes. It sends no payment email. Stale balances and already-settled entries are rejected. Closures cannot be edited into payments; deleting a closure through existing recoverable history reopens the applicable balance. History/rate displays identify closure, and daily PDFs show **Profit closed** when appropriate.

Recurrence is off by default. Eligible regular forms allow explicitly starting next month's configured profit cycle; returned principal and combined-source balances cannot recur. Quick Pay closes without starting recurrence. Shared calculations are deployed to API, daily worker and monthly worker, so partial balances and zero-payment closures remain consistent after reload and month rollover. Principal and previously paid totals remain unchanged.

## Validation and scope

Built from remote main in an isolated worktree; unrelated uncommitted CFO-sharing work was excluded and preserved.

`npm exec --yes --package=node@24.21.0 -- npm run validate` passed: **879 tests across 53 files**, schema/backend checks, TypeScript and build. Tests cover blank-amount UI closure, explicit confirmation/cancellation, duplicate-click blocking, stale balance rejection, API persistence/audit without email, partial balances, returned/combined capital, recurrence on/off and store reload/rollover. Download tests check PDF content, no email or writes, retries and uncertain email outcomes. Synthetic PDF rendering verified the closed label and cashback order.

## Backup and rollback gate

Restricted external archive: `/Users/jaswanth-6838/CapitalOS-backups/20261008T102731Z-pdf-profit-close`.

Fresh live backup: **19 tables / 743 raw records / 57 checksums**, including soft-deleted rows/history, schema/permission export, all application artifacts, private runtime configuration, schedules/job pools and empty file inventory. Complete paginated raw snapshots matched and archive checksums passed.

The reusable recovery project **CapitalOS-Cards-Check**, Development `71834000000073259`, was separately backed up (743 records, 57 checksums), verified against its previous recovery state with no unique business transactions, and refreshed. All 743 records/custom fields and remapped references were verified through a matching second read. A fresh backup of the restored recovery project passed before the prior live application was redeployed there. **12 API views, 47 assets, 743 records, all function files and runtime/configuration** passed. Recovery schedules and email jobs remain disabled.

Exact commands, triggers, reconciliation requirements and smoke checks were recorded in private `release-procedure.md` before deployment. Final live gate confirmed unchanged source data, schema, artifacts, runtime configuration and schedules.

## Hosted verification

All functions and frontend deployed successfully. **12 API views, 47 assets and all 743 raw records** passed comparison after hosted endpoint checks. The downloaded **1,155 API files, 1,145 daily-worker files and 261 monthly-worker files** match the frozen candidate. Node24, memory, environment/authentication and existing schedules/job pools passed verification.

A real download returned a valid **3-page PDF**, with **14 cashback dates in ascending order**; rendered pages were inspected. An unconfirmed closure returned HTTP 400. No real profit was closed and no email requested during verification. All raw records, including Activity, remained unchanged. Browser automation was unavailable; UI behavior was checked by automated component tests, with hosted API/asset verification rather than a claimed manual browser smoke.

Evidence: `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `validation.log`, `target-deployment-gate.json`, `live-verification.json`, `hosted-endpoint-verification.json`, `hosted-pdf-verification.json`, and frozen source/artifact checksums. Generated business PDFs remain private outside Git.

## Exact rollback and subsequent transactions

Capture and verify a **new complete live backup and API baseline** first. Verify archived checksums, runtime configuration and unchanged schema. Do not restore old data automatically.

Inventory any post-release closure records first. The previous calculation predates zero-payment closure support: a blind revert could show waived profit as owed. Preserve those records and their recurrence choices; reconcile waived balances with a closure-compatible correction before reverting calculations. Do not replace waivers with fictitious payments or discard newer transactions. Keep the working closure-aware release until reconciliation is verified.

When the previous build is compatible with current data:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261008T102731Z-pdf-profit-close/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Compare 12 API views and all raw rows with the new baseline; compare frontend/function files with rollback artifacts; verify Node24, memory, environment/authentication and schedules. Check pending balances, recurrence and retained waiver history, not only row counts. Rollback triggers include incorrect amounts, broken PDF generation or unexpected data/configuration drift. Code rollback and data reconciliation are separate operations.
