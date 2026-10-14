# Cashback sharing timestamp correction — 14 October 2026

Target: CapitalOS Development, organization `60088793510`, project `71834000000017016` (India). The `capitalos-api` function was deployed through the manual Catalyst workflow. No schema migration or data backfill was performed.

## Change

Paid cashback records retain the timestamp when the current settlement was recorded. Editing an already-paid settlement preserves that timestamp. If cashback leaves the paid state and is later recorded as paid again, the new settlement gets a fresh timestamp. The ledger and daily summary prefer this payment timestamp over the allocation's later `updatedAt` value.

## Backup, rollback and verification

Private release evidence and complete backups are stored outside Git at `/Users/jaswanth-6838/CapitalOS-backups/20261014T-cashback-time-manual-release/`.

- Fresh Development backup: 19 tables, 962 rows, 57 checksums; complete paginated reads matched. It includes schema and permissions, all function archives/configuration, frontend assets, schedules, pools and project export.
- The recovery project was backed up and verified against its accepted baseline before reset. All 962 live rows were restored with references remapped and verified. The previously deployed app was rehearsed in recovery with email disabled and no schedules.
- Rollback rehearsal passed: 12 API views, 48 frontend assets, all 962 rows, all three function archives and runtime configuration matched; recovery schedules were absent.
- The final Development drift check matched all 19 tables, schemas, 12 API views, function archives/configuration, frontend asset contents, schedules and pools with the fresh backup.
- `npm run validate` passed on Node 24.21.0: 945 tests across 57 files, schema/backend checks, TypeScript and production client build.
- Hosted verification passed for 12 API views, all 962 raw rows, schemas and permissions, schedules, all three function archives and runtime configuration. The deployed API archive matched the frozen candidate. No business records changed.

## Rollback

Before rollback, capture and verify a fresh complete Development backup, API baseline, schemas, runtime/configuration, deployed function artifacts, frontend and schedules. Preserve and reconcile all transactions recorded since that capture. Then deploy the verified previous API build:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261014T-cashback-time-manual-release/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api --project 71834000000017016 --dc in --org 60088793510 -ni
```

After rollback, compare all 12 API views and raw rows against the fresh pre-rollback baseline, verify the API archive/runtime/configuration, all frontend assets, other functions, schema, schedules and pools. Code rollback does not restore data; preserve or reconcile later transactions.
