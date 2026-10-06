# Card transaction popup release — 6 October 2026

Deployed and verified in **Development**, organization `60088793510`, project `71834000000017016`.

[Open Cards](https://capitalos-60088793510.development.catalystserverless.in/app/index.html#/credit-cards).

Clicking a card opens a compact transaction table with **Date, Transaction type, Amount, Notes and %** (monthly profit rate). Includes card-linked capital contributions, capital returns, profit payments and cashback. Sorts by transaction date descending, then creation time for same-day entries. Date range, transaction type and search filters combine; clearing filters restores all rows. Unknown cashback amounts remain explicitly unrecorded.

## Backup and rollback gates

Restricted backup root outside the repository: `/Users/jaswanth-6838/CapitalOS-backups/20261006T072802Z-card-transactions` (directory permissions 0700).

- Fresh complete backup: **19 tables / 600 raw records**, including deleted rows and Activity, schema/permissions export, all three hosted function archives, frontend and private runtime configuration, file-storage inventory and schedules. No stored-file folders were present. All **57 checksums** and ZIP integrity checks passed; two complete paginated raw-data snapshots matched.
- All **600 records** restored into new isolated project `71834000000073259` (`CapitalOS-Cards-Check`), with every custom field and remapped reference verified. Source system metadata is preserved in the original backup and ID map.
- Actual previous hosted application redeployed in isolation: **12 API views, 46 frontend assets and all three functions** verified with Node 24/runtime configuration. Restored records stayed unchanged; email flags disabled and no schedules created.
- Immediately before deployment, live raw data, schema, function archives/configuration, frontend version and schedules still matched the backup. Exact rollback commands, triggers and smoke checks were recorded before deployment in `release-procedure.md`.

## Validation and hosted verification

- `npm run validate` under Node 24.21.0 passed: **820 tests across 49 files**, schema/backend checks, TypeScript and production build.
- Frontend-only deployment succeeded; active frontend history ID: `71834000000034440`.
- All **47 hosted frontend assets**, **12 API views** and **600 unchanged raw records** verified. All three backend artifacts/runtime/configuration, both scheduler inventories and job pools stayed unchanged. No schema migration.
- Browser smoke passed: card popup opens, all five columns display, dates sort newest-first, combined date/type/search filters produce the expected row, clearing restores the list, and Escape closes the popup. No business records changed or test messages sent.

Evidence: `target/backup-verification.json`, `isolation/restore-verification.json`, `rollback-isolation-verification.json`, `target-deployment-gate.json`, `live-verification.json`, `browser-verification.json` and `release-complete.json` in the restricted backup root.

## Exact rollback

Capture and verify a **new full backup and API baseline** before rollback, preserving every transaction recorded since this release. Verify `rollback-checksums.json` and schema/runtime compatibility, then run:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261006T072802Z-card-transactions/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Compare the previous frontend's assets, all 12 API views against the fresh baseline, all raw records, backend artifacts/configuration and schedules. Smoke-check Cards and existing ledger balances. Rollback triggers include failed loading, missing/wrong card transactions, broken filters, or unexpected API/data changes. No old data snapshot is restored by code rollback; any data repair must reconcile later transactions.
