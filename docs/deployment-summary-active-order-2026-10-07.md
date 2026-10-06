# Active card rows and oldest-first unbilled spending — 7 October 2026

Deployed and verified in **Development**, organization `60088793510`, project `71834000000017016`.

Daily PDFs omit rows with zero outstanding capital. Only outstanding contributions supply WhatsApp-confirmed due dates, so settled bills cannot leave stale dates on an active card row. Unbilled rows follow billed rows and sort oldest to newest by the latest outstanding spending date in each group. Returns, profit payments, cashback payments and fully settled contributions do not reorder them. The distinct-card count reflects only displayed cards. Underlying capital/profit records and the cashback follow-up are unchanged; a zero-capital profit-only position is omitted from this card table as requested.

## Backup and rollback

Restricted backup root outside Git: `/Users/jaswanth-6838/CapitalOS-backups/20261006T191009Z-summary-active-order`.

Fresh live backup: **19 tables / 655 raw records**, including deleted rows and history, schema/permissions export, all three functions, frontend, private runtime configuration, cron/job-pool inventories and empty file-storage inventory. **57 checksums**, archive integrity and matching complete paginated snapshots verified. The first capture hit Catalyst's concurrent project-export lock; it was retained separately, no deployment occurred, and a new complete capture passed after the other export finished.

Reusable recovery project: **CapitalOS-Cards-Check**, Development `71834000000073259`. Its previous **653 records and deployed application** were freshly backed up with 57 verified checksums and compared with the prior verified recovery state, confirming no unique business transactions. Outbound emails and schedules remain disabled. Exact deployment/rollback commands and smoke checks were documented in private `release-procedure.md` and `recovery-rollback-procedure.md` before deployment.

All **655 live records** were restored into recovery with every custom field and remapped reference verified, followed by a complete matching second read. A new backup of the restored project passed before redeployment. The actual previous live build was redeployed and verified: **12 API views, 47 frontend assets, all three functions/runtime settings and 655 unchanged records**.

## Validation

`npm run validate` passed on Node 24.21.0: **850 tests across 50 files**, schema/backend checks, TypeScript and production build. Regression tests cover omission of zero capital, confirmed dates only on outstanding contributions, missing confirmation/date, independent billing groups, combined capital and oldest-first unbilled spending unaffected by later payments or settled spending.

Checks against the live snapshot confirmed four zero-balance rows removed, only the active confirmed date on SBI, UNI before Kotak among unbilled cards, and unchanged amounts/profit for every displayed group. Activity and cashback follow-up match the previous report, and API/daily-worker calculations agree. All four PDF pages were rendered using PDFium and visually checked. Private financial reports remain outside Git.

## Hosted verification

Final gate verified live data, schema, artifacts/configuration and schedules still matched the fresh backup. API and daily worker deployed successfully; no frontend, monthly-worker or schema deployment was required.

All **12 API views, 47 frontend assets and 655 raw records** remained unchanged. Hosted **1,154 API files and 1,145 daily-worker files** match the frozen candidate; the **261 monthly-worker files** remain unchanged. Node24, memory, environment, authentication and cron/job-pool inventories passed verification. The downloaded hosted API and worker produce exactly the validated report and both render valid PDFs. No live test email or financial write was performed.

Private evidence: `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `candidate-behavior-verification.json`, `pdf-verification.json`, `target-deployment-gate.json`, `live-verification.json` and `hosted-behavior-verification.json`.

## Exact rollback

Capture and verify a **new complete live backup and API baseline** first, preserving later transactions. Verify archived checksums, runtime configuration and unchanged schema compatibility. Then:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261006T191009Z-summary-active-order/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api,functions:capitalos-daily-summary --project 71834000000017016 --dc in --org 60088793510 -ni
```

Verify all 12 API views and raw records against the fresh baseline, exact function files, Node24/memory/environment/authentication, unchanged frontend/monthly worker and cron/job-pool inventories. Generate a summary from the downloaded hosted modules and verify financial totals. Rollback triggers: incorrect dates/order/balances, broken reporting/API loading, unexpected data or configuration drift.

Code rollback does not restore data. Any data recovery must reconcile transactions recorded after the backup.
