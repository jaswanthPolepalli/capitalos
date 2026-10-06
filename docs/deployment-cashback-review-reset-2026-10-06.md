# Cashback Needs review reset — 6 October 2026

Deployed and verified in **Development**, organization `60088793510`, project `71834000000017016`.

Choosing **Needs review** on an excluded transaction clears the unpaid cashback selection for its card/calendar month. Automatically excluded peers return to review, while manually excluded entries remain Not applicable. Recorded paid cashback blocks the reset with an explanation and a link to the selected payment. Timestamp ordering also handles ISO timestamps with different fractional-second precision.

## Backup and rollback

Restricted backup root (outside Git, mode 0700): `/Users/jaswanth-6838/CapitalOS-backups/20261006T173721Z-cashback-review-reset`.

Fresh complete live backup: **19 tables / 623 raw records**, including deleted rows and Activity; schema/permissions export, all three deployed functions, frontend, private runtime configuration, schedules/job pools and empty storage inventory. **58 checksums** and archive integrity verified, with two matching paginated raw snapshots.

Recovery project: **CapitalOS-Cards-Check**, Development `71834000000073259`. Its previous **611 records and deployed application** were freshly backed up with **57 verified checksums**. Exact comparison with the prior isolated restore/build/runtime confirmed no unique business data before reset. All **623 records** were then restored from the live snapshot; every custom field, remapped reference, and second complete read passed verification. Outbound email and schedules remain disabled.

The restored recovery environment received a fresh verified backup before redeployment. The actual prior live build was then redeployed successfully: **12 API views, 47 frontend assets, all three functions and runtime settings, and 623 unchanged raw records** verified. This proves rollback readiness with the existing schema. Exact commands and checks were documented before deployment in the restricted `release-procedure.md` and `recovery-rollback-procedure.md`.

## Validation

`npm run validate` passed on Node 24.21.0: **841 tests across 50 files**, schema/backend checks, TypeScript, and production build. Regressions cover excluded-peer review saves, reload/filter persistence, paid-payment rejection without writes, selection ordering, independent card/month groups, manually excluded entries, and daily email/PDF follow-up.

Candidate checks against the fresh private snapshot passed: API and daily worker agree; financial rows, activity, payment totals, and all 12 existing follow-ups are unchanged. The real API handler successfully selected cashback and reset it from an excluded peer against an in-memory snapshot, without live writes or emails.

## Hosted verification

- Final release gate passed with live data, schema, deployed artifacts/configuration and schedules unchanged from backup. API, daily-summary worker and frontend deployed successfully; no schema migration or data backfill.
- **12 API views, 47 frontend assets, 1,154 API files and 1,145 daily-worker files** verified against the frozen candidate; the **261 monthly-worker files** are unchanged. Node24, memory, environment and authentication settings match.
- All **623 raw records remained unchanged**. Independent checks verified **22 selected card/months, 12 linked excluded peers and 2 review entries**. Both the existing payment guard and new paid-peer review guard returned the expected errors using independently invalid payloads, without writing data or sending email.
- Cron inventories and job pools remain unchanged. No test email was sent; inbox delivery is not claimed.
- Browser smoke checks passed in CEO read-only mode: cashback filters, excluded transaction links across months, selected transaction display, Needs review filter, Reports and Ledger. CFO save/reload/error flows are covered by API/UI tests; live financial records were not edited for testing.

Private evidence includes `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `candidate-behavior-verification.json`, `target-deployment-gate.json`, `live-verification.json`, `hosted-behavior-verification.json`, and `browser-verification.json`.

## Rollback commands and checks

First capture and verify a **new full live backup and API baseline**, preserving all later transactions. Verify `rollback-checksums.json`, private runtime configuration, and compatible schema. Then:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261006T173721Z-cashback-review-reset/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api,functions:capitalos-daily-summary,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Verify prior frontend/function artifacts, Node24/runtime/authentication, all 12 API views and raw records against the new baseline, and unchanged monthly worker/schedules. Check Profits, cashback filters/links, Reports and Ledger. Rollback triggers: failed loading, incorrect cashback status or links, changed financial totals, or unexpected data/configuration drift. The prior build supports existing selection metadata; rollback restores its previous peer-review limitation. Code rollback does not restore data. Any data repair must reconcile all transactions recorded after backup.
