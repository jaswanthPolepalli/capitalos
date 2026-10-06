# First monthly card transaction cashback release — 6 October 2026

Deployed and verified in **Development**, organization `60088793510`, project `71834000000017016`, the existing business-use environment.

[Open Profits](https://capitalos-60088793510.development.catalystserverless.in/app/index.html#/pending-profits).

Only the first original transaction per card and calendar month qualifies for cashback. Date, original creation time and stable record ID determine order. Repeat transactions resolve to **Not first transaction**, stay hidden from normal cashback views and daily email/PDF follow-up, and appear under their dedicated filter. The API rejects their settlement before writing data or sending email. Eligibility is calculated without rewriting stored payments; ledger, statements, reports, portal and totals retain money already recorded as paid. Edits, backdating, deletion and restoration recalculate eligibility.

## Backup and rollback gates

Restricted backup root outside the repository (0700): `/Users/jaswanth-6838/CapitalOS-backups/20261006T133044Z-cashback-monthly`.

- Fresh target backup: **19 tables / 603 raw records**, including deleted records and Activity, schema/permissions export, all three deployed function archives, frontend, private runtime configuration, schedules/job pools and storage inventory. No stored-file folders exist. All **57 checksums** and ZIP integrity checks passed; two complete paginated raw snapshots matched.
- Reused recovery project **71834000000073259**, `CapitalOS-Cards-Check`, Development. Its existing **600 records and deployed app** were freshly backed up and verified, including 57 checksums. Exact comparison with the preceding isolated restoration established that there were no unique business transactions. No new project was created.
- All **603 records** restored into that project, with every custom field and remapped reference verified. Original IDs/system metadata remain in the source backup and private ID map. A fresh backup of the restored environment passed before application deployment there.
- The actual previous hosted frontend and all three functions were redeployed in isolation: **12 API views, 47 frontend assets, 603 unchanged records**, Node 24 and runtime configuration verified. Email flags remain disabled and no schedules exist. The recovery project remains on this verified previous live build.
- Final live gate confirmed raw data, schema, deployed artifacts/configuration, frontend and schedules still matched the fresh backup. Exact rollback commands and smoke checks were recorded in `release-procedure.md` before deployment.

Catalyst initially refused the recovery export while the live export was running; the recovery capture was retried after completion and passed. No reset or deployment occurred before its verification.

## Validation and hosted checks

- `npm run validate` passed on **Node 24.21.0**: **828 tests across 50 files**, schema/backend checks, TypeScript and production build.
- Candidate API/daily worker verified against the live snapshot: **16 repeat transactions**, cashback follow-up reduced from **21 to 13**, financial rows/activity unchanged, and API/worker calculations identical.
- API, daily-summary worker and frontend deployed successfully. No live schema migration or data backfill. Monthly worker and schedule configuration retained.
- Hosted verification: **12 API views**, **47 frontend assets**, **1,154 API files**, **1,145 daily-worker files**, and the unchanged **261 monthly-worker files** matched the intended artifacts. Runtime, memory, environment and authentication settings verified.
- All **603 raw records remained unchanged**. An invalid-status smoke request to a repeat transaction returned the first-transaction error without creating a payment or sending email. Monthly eligibility was independently recalculated from the hosted API.
- Both cron inventories and job pools remain unchanged. Daily summary is still scheduled for **11 PM Asia/Kolkata**. No test email was sent; inbox delivery is not claimed.
- Browser smoke: default cashback view excludes repeats; dedicated filter shows all 16 with no settlement action; desktop and 390px mobile layout checked. Reports and ledger load with financial history intact. Browser verification used CEO read-only access; CFO controls are covered by UI/API tests.

Evidence: `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `candidate-behavior-verification.json`, `target-deployment-gate.json`, `live-verification.json`, `hosted-behavior-verification.json`, and `browser-verification.json` in the restricted root.

## Exact rollback

Capture and verify a **new complete target backup and API baseline** first, preserving all transactions recorded after this release. Verify `rollback-checksums.json`, runtime configuration and current schema compatibility, then:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261006T133044Z-cashback-monthly/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api,functions:capitalos-daily-summary,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Verify archived frontend/function files, Node 24/runtime configuration, all 12 API views and raw data against the fresh baseline, and preserved schedules. Smoke-check dashboard, profits/cashback, reports and ledger. Roll back for incorrect eligibility, unavailable pages/reports, runtime or schedule drift, or unexpected data changes. Code rollback does not restore data; any data repair must reconcile later transactions.
