# CFO sharing and combined latest release — 8 October 2026

Target: existing business-use **Development**, organization `60088793510`, project `71834000000017016`.

This release combines every pending local change with the previously deployed October 8 profit consistency, PDF download, no-payment closure and closure-confirmation updates. It adds CFO Share navigation and a filterable transaction view, combined partner/CFO payment previews and confirmation, adjusted rate/direct partner amount/no-split options, and consistent individual/grouped payment persistence. Historical payments are not backfilled. Split metadata uses existing notes; no schema migration is required.

## Backup and rollback

Restricted archive outside Git: `/Users/jaswanth-6838/CapitalOS-backups/20261008T125918Z-cfo-share`.

Fresh live backup includes **19 tables / 743 raw records**, deleted records/history, schema and permissions export, frontend, all three functions, private runtime/configuration, schedules/job pools and empty file-storage inventory. Two complete paginated snapshots matched and **57 checksums** and archives passed verification.

The reusable **CapitalOS-Cards-Check** recovery project `71834000000073259` was freshly backed up and its records/artifacts compared with the prior verified isolated recovery state before reset. All 743 records were restored with custom fields and remapped references verified, followed by a complete matching second read. Outbound email and schedules remain disabled. The restored recovery project was freshly backed up before the previous live application was redeployed there.

Exact rollback commands and triggers were recorded in private `release-procedure.md` before deployment. Before rollback, capture and verify a fresh live data/application snapshot and preserve subsequent payments, closures and confirmation outcomes. Then verify archived artifact checksums, Node24/runtime configuration and compatible schema and run:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261008T125918Z-cfo-share/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Check all 12 API views, raw records, frontend/function files, runtime/authentication and unchanged schedules against the fresh baseline. Rollback triggers include broken loading/payments, incorrect splits or unexpected data/configuration drift. Previous code preserves notes but does not expose CFO split metadata; stop editing split payments until a corrected release is available. Code rollback does not restore data; any recovery must reconcile transactions after backup.

## Validation

`npm run validate` passed under Node 24.21.0: **916 tests across 56 files**, schema and backend checks, TypeScript and production build. The payment-form closure regression was updated for its combined-amount label. Candidate daily-summary output matches the previous application on the backed-up live snapshot. Synthetic CFO split/metadata and closure-confirmation checks pass. Every candidate tracked backend source and frontend file matches the combined release checkout. No test email or financial write to live is required.

## Hosted verification

API, daily-summary worker, month-end worker and frontend deployed successfully after the final gate verified live data/schema/artifacts/configuration/schedules still matched the fresh backup. The isolated previous-build rehearsal passed all 12 API views, 47 frontend assets and 743 restored raw records.

Live verification passed **12 API views, 49 frontend assets and 743 unchanged raw records**. All deployed function files match the frozen candidate: API **1,159**, daily worker **1,146**, monthly worker **262**. Node24, memory, environment variables, authentication and schedules/job pools were verified. PDF download returned a valid PDF, and an unconfirmed closure was rejected without financial writes or email. The downloaded hosted API handler passed synthetic create/read/edit/no-split CFO tests against an in-memory datastore.

Browser verification confirmed CFO Share in the unlocked CFO navigation, its live page, filters and readable empty state. Existing historical payments have no split metadata and remain unchanged; new split payments populate this view.

Private evidence includes `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `validation.json`, `candidate-source-verification.json`, `candidate-behavior-verification.json`, `target-deployment-gate.json`, `live-verification.json`, `hosted-endpoint-verification.json`, `hosted-cfo-behavior.json` and `browser-verification.json`. Backups, runtime secrets and financial PDFs remain outside Git.
