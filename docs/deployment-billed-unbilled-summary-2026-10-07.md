# Separate billed and unbilled PDF balances — 7 October 2026

Deployed and verified in **Development**, organization `60088793510`, project `71834000000017016`.

The daily PDF now groups each card's confirmed billed balance separately from unbilled contributions. Payments reduce only their associated contribution balances. Pending profit follows the same grouping, without changing per-card or report totals. Bill confirmation continues to use the saved WhatsApp confirmation and due date. The total counts distinct cards even when a card has two rows. The API and daily worker share this implementation; no schema migration is required.

## Backup and rollback

Restricted backup root outside Git: `/Users/jaswanth-6838/CapitalOS-backups/20261006T185550Z-billed-unbilled-summary`.

Fresh live backup: **19 tables / 653 raw records**, including deleted records and history, schema/permissions export, all three deployed functions, frontend and private runtime configuration, cron/job-pool inventories and empty file-storage inventory. **57 checksums** and archive integrity verified. Two full paginated snapshots matched.

Reusable recovery project: **CapitalOS-Cards-Check**, Development `71834000000073259`. Its previous **627 records and deployed application** were freshly backed up and checked against the prior verified recovery state, establishing no unique business transactions. All **653 live records** were restored with custom fields and remapped references verified and a complete second read matched. Email and schedules remain disabled in recovery.

A fresh backup of the restored recovery environment passed before rehearsal. The actual previous live build was redeployed there and verified: **12 API views, 47 frontend assets, all three functions/runtime settings and 653 unchanged raw records**. The recovery project previously ran an older cashback build; its expected derived cashback differences were reconciled exactly against the archived live-build calculation, with financial fields unchanged.

Exact deployment/rollback commands and smoke checks were recorded before deployment in private `release-procedure.md` and `recovery-rollback-procedure.md`.

## Validation

`npm run validate` passed on Node 24.21.0: **848 tests across 50 files**, schema/backend checks, TypeScript and production build. Regression coverage includes partially paid billed capital with new unbilled spending, per-group pending profit, full repayment, missing confirmations/dates and combined capital without double-counting.

Checks against the live snapshot confirmed five cards split into separate groups, all per-card capital/profit/contribution totals remained equal, activity and cashback follow-up stayed unchanged, and the API and daily worker agreed. All four PDF pages were rendered with PDFium and visually checked for layout and pagination. Private generated financial reports remain outside Git.

## Hosted verification

The final gate confirmed live data, schema, application artifacts/configuration and schedules still matched the backup. The API and daily-summary worker deployed successfully. No frontend, monthly-worker or schema deployment was needed.

All **12 API views, 47 frontend assets and 653 raw records** remained unchanged. Hosted **1,154 API files and 1,145 daily-worker files** match the frozen candidate; the **261 monthly-worker files** remain unchanged. Node24, memory, environment, authentication and cron/job-pool inventories were verified. Both downloaded hosted reporting modules produce exactly the validated split summary and generate valid PDFs. No test email was sent and no live business records were edited.

Private evidence includes `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `candidate-behavior-verification.json`, `pdf-verification.json`, `target-deployment-gate.json`, `live-verification.json` and `hosted-behavior-verification.json`.

## Exact rollback

Capture and verify a **new full live backup and API baseline** before rollback, preserving later transactions. Verify archived rollback checksums and required runtime configuration; the schema is unchanged and compatible. Then:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261006T185550Z-billed-unbilled-summary/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api,functions:capitalos-daily-summary --project 71834000000017016 --dc in --org 60088793510 -ni
```

Check all 12 API views, raw records against the fresh baseline, function file hashes, Node24/memory/environment/authentication, unchanged frontend/monthly worker and cron/job pools. Verify PDF generation and financial totals. Roll back for report generation failures, incorrect grouping/totals, failed API loading or unexpected data/configuration/scheduler drift.

Code rollback does not restore data. Any data recovery must reconcile every transaction recorded after backup.
