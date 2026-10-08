# Compact cashback actions — 8 October 2026

Target: existing Development app, organization `60088793510`, project `71834000000017016`.

Frontend-only release: cashback actions use short Pay, Manage, Review and Edit labels, compact padding and a single horizontal row. Desktop buttons are 32px high; mobile retains 44px touch targets. Full accessible names remain available. No payment logic, schema, API or data changes.

## Backup and rollback

Restricted archive outside Git: `/Users/jaswanth-6838/CapitalOS-backups/20261008T134212Z-compact-cashback`.

Fresh live backup includes 19 tables and 747 raw records, full pagination with deleted/history records, schema and permissions, deployed frontend and all three functions, private runtime configuration, schedules/job pools and empty file-storage inventory. Two complete snapshots matched and 57 checksums plus ZIP integrity checks passed.

The reusable recovery project, Development `71834000000073259` (CapitalOS-Cards-Check), was freshly backed up (747 records, 57 checksums) and matched its previously verified data/application/configuration. No unique business records were present. All 747 live records were restored with verified custom fields and remapped references, followed by a matching complete second read. Recovery emails and schedules remain disabled.

Rollback commands and smoke checks were recorded in private `release-procedure.md` before any deployment. Before rollback, capture and verify a fresh live backup and preserve/reconcile subsequent transactions. Verify artifact checksums and compatible runtime/configuration/schema, then:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261008T134212Z-compact-cashback/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Rollback triggers: broken loading/actions, incorrect layout, unexpected data or configuration drift. Verify all 12 API views, raw records, frontend assets, unchanged function artifacts/configuration and schedules against the fresh baseline. Code rollback never restores old data or discards later transactions.

## Validation

`npm run validate` passed under Node 24.21.0: 919 tests across 56 files, schema/backend checks, TypeScript and production build. Existing cashback UI tests retain full accessible button names and verify payment actions. Frozen frontend matches the validated build; all backend files match the archived live application byte-for-byte.

## Release verification

The restored recovery project was freshly backed up before the previous live application was redeployed there. Rollback rehearsal passed: 12 API views, 49 frontend assets, all three function artifacts and runtime configuration, with all 747 restored records unchanged.

The final live gate verified data, schema, deployed artifacts/configuration and schedules still matched the fresh backup. Only the frontend was then deployed.

Hosted verification passed: 12 API views, all 49 frontend assets matched the validated candidate, and all 747 raw live records remained unchanged. All backend files and runtime/configuration remained unchanged: API 1,159 files, daily worker 1,146, monthly worker 262. Schedules/job pools were unchanged. Compact labels/styles and accessible names were checked in source/build; browser automation was unavailable, so no browser visual verification is claimed.

Private evidence includes `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `validation.json`, `candidate-source-verification.json`, `candidate-behavior-verification.json`, `target-deployment-gate.json` and `live-verification.json`. Backups, business records and runtime secrets remain outside Git.
