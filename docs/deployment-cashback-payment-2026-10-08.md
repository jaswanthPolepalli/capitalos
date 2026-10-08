# Direct cashback payments — 8 October 2026

Target: existing business-use Development, organization `60088793510`, project `71834000000017016`.

Release adds Pay cashback directly from the list, combined cashback with the usual 5/7 partner and 2/7 CFO split, No CFO share and custom partner percentage/amount controls, a split preview, optional payment account/method, and cashback entries in CFO Share. Historical payments retain their recorded partner amounts. Principal and regular profit remain independent. No schema migration or data backfill.

## Backup and rollback

Restricted archive outside Git: `/Users/jaswanth-6838/CapitalOS-backups/20261008T132458Z-cashback-payment`.

Fresh live backup: 19 tables, 747 raw records, full pagination including deleted/history records, schema/permissions export, frontend, all three functions, private runtime configuration and schedules/job pools. File storage inventory is empty. Two complete snapshots matched; 57 checksums and archive integrity checks passed.

The recovery project `CapitalOS-Cards-Check`, Development `71834000000073259`, was freshly backed up (743 records, 57 checksums) and compared with the previously verified recovery state before resetting. It contains no unique business transactions. All 747 live records were restored and verified with remapped references and a complete matching second read. Outbound email and schedules remain disabled.

Exact deployment/rollback commands, triggers and smoke checks were recorded in private `release-procedure.md` before deployment. Before rollback, capture another fresh verified live data/application snapshot and preserve/reconcile subsequent transactions. Verify archive checksums and Node24/runtime/configuration, then run:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261008T132458Z-cashback-payment/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

After rollback, verify all 12 API views, raw data, frontend/function assets, runtime/authentication/configuration and schedules against the fresh baseline and archived application. Trigger rollback for broken loading/payment flows, incorrect splits or unexpected data/configuration drift. The previous build can display partner cashback but cannot manage its CFO split: stop editing split cashback payments until fixed, because the previous editor can discard split metadata. Code rollback does not restore data; never overwrite later transactions with the old backup.

## Validation

`npm run validate` passed under Node 24.21.0: 919 tests across 56 files, schema/backend checks, TypeScript and production build. Frozen candidate sources and frontend match the validated checkout. Daily-summary results on the live snapshot match the previous application. Synthetic combined, no-CFO, percentage and amount cashback splits survive repeated server validation.

The restored recovery project was backed up again before rehearsal. The previous live application redeployed successfully there: 12 API views, 49 frontend assets, all three functions and runtime configuration verified; all 747 restored records remained unchanged.

## Hosted verification

API, daily-summary worker, month-end worker and frontend deployed successfully after the final live gate confirmed data, schema, prior artifacts/configuration and schedules still matched the fresh backup.

Hosted verification passed: 12 API views, 49 frontend assets, and 747 unchanged raw records. All function files matched the frozen candidate: API 1,159, daily worker 1,146, monthly worker 262. Node24, memory, environment variables, authentication, job pools and schedules verified. The downloaded deployed API handler passed synthetic cashback create/read/edit, no-CFO, custom percentage/amount and invalid-amount rejection checks using an in-memory datastore. Regular profit and principal remained unchanged; no synthetic financial writes or emails were sent to live.

Browser automation was unavailable in this session, so no browser visual check is claimed. UI behavior is covered by the passing automated UI tests and exact hosted frontend asset verification.

Private evidence: `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `validation.json`, `candidate-source-verification.json`, `candidate-behavior-verification.json`, `target-deployment-gate.json`, `live-verification.json` and `hosted-cashback-behavior.json`. Backups and runtime secrets remain outside Git.
