# Manual monthly cashback selection — 6 October 2026

Deployed and verified in **Development**, organization `60088793510`, project `71834000000017016`, the existing business-use app.

[Open Profits](https://capitalos-60088793510.development.catalystserverless.in/app/index.html#/pending-profits).

Each card/calendar month has one manually selected cashback transaction. Unselected transactions start **Needs review**; marking any transaction **Unpaid/Paid** selects it and makes its peers **Not applicable**. Peer rows link directly to the selected transaction across month and status filters. Unpaid choices can be moved or cleared. Recorded paid cashback must be corrected before selecting a different transaction. Prior financial history is preserved. The first-transaction filter is removed, and the shared manual-selection rule drives daily email/PDF follow-up.

## Backup and rollback gates

Restricted backup root outside the repository (0700): `/Users/jaswanth-6838/CapitalOS-backups/20261006T152945Z-manual-cashback`.

- Fresh live backup: **19 tables / 611 raw records**, including deleted records and Activity, schema/permissions export, all three deployed functions, frontend, private runtime configuration, schedules/job pools and storage inventory. No stored-file folders were present. **58 checksums** (including the API baseline) and archive integrity verified. Two complete paginated raw snapshots matched.
- Reused **CapitalOS-Cards-Check**, Development project `71834000000073259`. Its existing **603 records and deployed application** were freshly backed up with **57 verified checksums**. Exact comparison with the preceding isolated restore/build/runtime established that it had no unique business transactions before reset.
- All **611 live records** restored into recovery. Every custom field and remapped reference verified; original IDs/system timestamps remain preserved in the source backup and private restoration map. A fresh backup of the restored environment passed before its application deployment.
- Actual previous live build redeployed in recovery: **12 API views, 47 frontend assets, all three functions, runtime settings and 611 unchanged records** verified. Email flags remain disabled, no schedules exist, and recovery remains on the verified previous live build.
- Exact release/rollback commands and smoke checks recorded in `release-procedure.md` before deployment. Final live gate confirmed raw data, schema, artifacts/configuration, frontend and schedules still matched the backup.

## Validation and hosted verification

- `npm run validate` passed on **Node 24.21.0**: **834 tests across 50 files**, schema/backend checks, TypeScript and production build.
- Candidate verified against the current snapshot: **22 selected card/months, 12 automatically excluded peers, 2 review entries**. Follow-up rows changed from **13 to 12**; all financial rows, activity and payment totals remained identical. API and daily worker agree. Selection and clearing were exercised through the real API handler against an in-memory snapshot, without live writes or emails.
- API, daily worker and frontend deployed successfully. No live schema change or data backfill. Existing monthly worker retained.
- Hosted files match the candidate: **47 frontend assets, 1,154 API files, 1,145 daily-worker files**; the **261 monthly-worker files** remain unchanged. Node24, memory, environment and authentication settings verified.
- All **12 API views** matched the baseline except the intended derived selection/eligibility metadata. All **611 raw records remained unchanged**. Manual choices and peer links were independently checked against hosted data. A deliberately invalid payment request to a peer of a paid selection returned the paid-selection error without writing data or sending email.
- Both cron inventories and job pools remain unchanged. Daily email remains scheduled for **11 PM Asia/Kolkata**. No test email was sent; inbox delivery is not claimed.
- Browser checks passed in CEO read-only mode: revised filters; Not applicable peer links; a link opened the selected later transaction across the month/filter boundary; Back returned to the filtered list; desktop and 390px mobile rows/links rendered correctly; Reports and Ledger loaded. CFO selection controls are covered by UI/API tests.

Evidence in the restricted root: `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `candidate-behavior-verification.json`, `target-deployment-gate.json`, `live-verification.json`, `hosted-behavior-verification.json`, and `browser-verification.json`.

## Exact rollback

Capture and verify a **new complete live backup and API baseline** first, preserving all transactions and activity recorded after release. Verify `rollback-checksums.json`, runtime configuration and current schema compatibility, then:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261006T152945Z-manual-cashback/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api,functions:capitalos-daily-summary,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Verify archived frontend/function files, runtime/configuration, 12 API views and raw records against the fresh baseline, and preserved monthly worker/schedules. Smoke-check original first-transaction behavior plus dashboard, profits, reports and ledger. Rollback triggers include failed loading, incorrect selection/links/follow-up, lost payment history, changed balances or unexpected data/configuration drift. Code rollback retains new selection metadata and payments; it does not restore data. Any data repair must reconcile all later transactions.
