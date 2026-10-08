# Profit closure confirmations — 8 October 2026

Deployed and verified in Development, organization `60088793510`, project `71834000000017016`.

## Behavior

Closing profit without payment now emails a **Profit Closure Confirmation** when the partner has an email address and offers a user-controlled WhatsApp draft. Both channels use the same server-generated transaction snapshot: current profit (₹0), earlier partial payments when present, paid cashback when present, total profit received and total return against original contribution capital to two decimals. Earlier completed recurring-cycle payments have a separate row and contribute to the total. Unknown historical cashback amounts are disclosed; an exact return percentage is withheld rather than invented. Unrelated contributions and deleted payments are excluded.

The warning explains the closure email. Delivery failure leaves the successful closure intact and shows an unconfirmed-email status. WhatsApp is never automatically sent. No schema or financial calculation changes. Rolling back to the prior build retains closure/recurrence support but removes closure confirmations; do not replay previously sent messages.

## Validation

`npm exec --yes --package=node@24.21.0 -- npm run validate` passed: **886 tests across 54 files**, schema/backend checks, TypeScript and production build. Tests cover the approved ₹5,000 + ₹1,000 = ₹6,000 / 4.00% example, transaction isolation, conditional rows, previous recurring payments, unknown cashback, HTML escaping, duplicate closure rejection, SMTP failure and the user-controlled WhatsApp draft. Email tests use synthetic recipients and mocked SMTP.

## Backup and rollback procedure

Private archive: `/Users/jaswanth-6838/CapitalOS-backups/20261008T112410Z-closure-messages`. No business data, credentials or generated reports are included in Git. The live and recovery backups each verified **19 tables, 743 raw records and 57 checksums**, including deleted rows/history, schema/permissions export, deployed artifacts, private runtime configuration and schedules. Complete paginated snapshots matched. An overlapping export was rejected during recovery capture; deployment remained paused until a fresh retry completed and verified.

Before rollback, capture and verify a NEW live data/application/configuration backup and API baseline. Verify archived checksums, unchanged schema and Node24 configuration availability. Preserve all transactions recorded since the backup; do not automatically restore old rows or resend confirmations.

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261008T112410Z-closure-messages/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Rollback triggers: broken closure, incorrect confirmation totals or unexpected data/configuration drift. Compare 12 API views and every raw row with the fresh rollback baseline; compare frontend/function files with archived rollback; verify runtime, authentication, schedules, pending balances and recurrence. Data recovery is separate and must reconcile later transactions.

## Verified release gates

The existing recovery project `71834000000073259` was backed up and checked against its prior independently rehearsed state, with no unique business records. All 743 live-snapshot records/custom fields and remapped references were restored and verified. A further fresh recovery backup passed before redeploying the previous live build there. Rollback rehearsal verified **12 API views, 47 frontend assets, 743 raw records**, all function files and Node24/runtime configuration. Recovery schedules remain absent and email jobs disabled.

The final live gate confirmed unchanged rows, schema, prior artifacts, runtime/authentication configuration and schedules. Exact commands and reconciliation requirements were recorded in private `release-procedure.md` before deployment.

Evidence: `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `validation.json`, `candidate-behavior-verification.json`, `source-checksums.json`, and `target-deployment-gate.json`.

## Hosted verification and Git scope

All functions and frontend deployed successfully. Hosted checks verified **12 API views, 47 assets and all 743 raw records unchanged** after endpoint checks. Downloaded function artifacts matched the frozen candidate: API 1,156 files, daily worker 1,145 files and monthly worker 261 files. Node24, memory, environment/authentication and existing schedules/job pools remained correct. PDF download returned a valid PDF and unconfirmed closure returned HTTP 400. No real profit was closed or email sent for smoke testing. UI behavior and email delivery branches were covered by automated tests; no manual browser or real-recipient email smoke is claimed. Evidence: `candidate-deploy-result.json`, `live-verification.json`, `hosted-endpoint-verification.json` and artifact comparisons.

The deployed source, tests and release documentation are committed for remote `main`; unrelated CFO-sharing edits in the original workspace are preserved and excluded.
