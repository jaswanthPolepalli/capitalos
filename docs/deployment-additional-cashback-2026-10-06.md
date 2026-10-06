# Additional cashback payments — 6 October 2026

Deployed and verified in **Development**, organization `60088793510`, project `71834000000017016`.

A transaction can now be marked Paid even when another cashback payment exists for the same card/contribution month. The form links to existing payments and requires explicit confirmation. The server checks the current paid transaction IDs against that confirmation before saving. The selected transaction alone changes; other raw and displayed statuses remain unchanged. Every paid cashback stays visible and counts in totals. Additional payments use server-generated `individualStatus` metadata in the existing JSON field; no schema migration or backfill is required.

## Backup and rollback

Restricted backup root outside Git (0700): `/Users/jaswanth-6838/CapitalOS-backups/20261006T175407Z-additional-cashback`.

Fresh live backup: **19 tables / 627 raw records**, including deleted rows and Activity, schema/permissions export, all three deployed functions, frontend, private runtime configuration, schedules/job pools and empty file-storage inventory. **57 checksums** and archive integrity verified; two complete paginated raw snapshots matched. All 12 API views were also captured.

Recovery project: **CapitalOS-Cards-Check**, Development `71834000000073259`. Its previous **623 records and deployed application** were freshly backed up with **57 verified checksums**. Exact comparison with the prior verified recovery state confirmed no unique business transactions. All **627 live records** were then restored, with every custom field, remapped reference and second complete read verified. Outbound email and schedules remain disabled.

A fresh backup of the restored recovery environment passed before its deployment. The actual previous live build was redeployed and verified: **12 API views, 47 frontend assets, all three functions and runtime settings, and 627 unchanged records**. Exact deployment/rollback commands and smoke checks were documented in the private `release-procedure.md` and `recovery-rollback-procedure.md` before deployment.

## Validation

`npm run validate` passed on **Node 24.21.0**, with **847 tests across 50 files**, schema/backend checks, TypeScript and production build. Coverage includes confirmation/rejection, stale confirmation, untouched peer statuses, visibility after reload, legacy multiple payments, independent corrections, ledger/statement totals and daily-summary follow-up.

The candidate also passed against a private copy of the current live snapshot: existing financial rows, activity and follow-ups are unchanged, and the API/daily worker agree. The actual API handler rejected an unconfirmed additional payment, accepted confirmation, preserved all other raw/displayed statuses and increased payment totals by exactly the additional amount. These checks wrote no live records and sent no emails.

## Hosted verification

- Final gate confirmed live data, schema, artifacts/configuration and schedules still matched the backup. API, daily-summary worker and frontend deployed successfully. No hosted schema/data migration or backfill.
- **12 API views, 47 frontend assets, 1,154 API files and 1,145 daily-worker files** matched the frozen candidate; the **261 monthly-worker files** remain unchanged. Node24, memory, environment and authentication settings verified.
- All **627 raw records remained unchanged**. Independent checks confirmed **14 recorded paid entries are visible** and existing-payment IDs/links are correct. An unconfirmed payment was rejected by the new confirmation guard. Supplying the current confirmation passed that guard and reached amount validation. Both requests used an independently invalid amount/date, so no payment or email could be created.
- All cron inventories and job pools remain unchanged. No test email was sent; inbox delivery is not claimed.
- Browser checks passed in CEO read-only mode: updated cashback wording and filters, 10 excluded-transaction links, selected transaction navigation across months, Reports and Ledger. CFO confirmation/save/reload flows are covered by API/UI tests; no live business records were edited for testing.

Private evidence: `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `candidate-behavior-verification.json`, `target-deployment-gate.json`, `live-verification.json`, `hosted-behavior-verification.json`, and `browser-verification.json`.

## Exact rollback

First capture and verify a **new complete live backup and API baseline**, preserving later transactions and Activity. Verify archived rollback checksums, required runtime configuration and schema compatibility. Then:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261006T175407Z-additional-cashback/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api,functions:capitalos-daily-summary,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Verify previous frontend/function artifacts, Node24/runtime/authentication, all 12 API views and raw records against the new baseline, monthly worker and schedules. Check Profits, cashback links, Reports and Ledger. Rollback triggers include failed loading, incorrect confirmation/statuses, changed financial totals or unexpected data/configuration drift.

The previous build retains additional payments and their financial totals but may hide them behind its single-selection status rule. Preserve `individualStatus` metadata and reconcile these entries before operating the older build. Code rollback does not restore data; any recovery must reconcile transactions recorded after backup.
