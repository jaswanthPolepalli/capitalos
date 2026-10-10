# Partner email updates — 10 October 2026

Deployed the partner email improvements from commit `13129d2` to CapitalOS Development, organization `60088793510`, project `71834000000017016`. The scope was `functions:capitalos-api` only. The UPI frontend deployed earlier remains available and unchanged.

## What changed

- New contribution emails identify the funding source as cash or the named credit card and describe the monthly profit rate as estimated.
- Capital return emails show outstanding capital for the same contribution source. For credit card contributions, outstanding balances are grouped as **Bill generated** or **Bill not generated**, using the confirmed bill status.
- Existing partner-facing email delivery remains asynchronous; the API response does not wait for SMTP.

## Release evidence

Private release archive: `/Users/jaswanth-6838/CapitalOS-backups/20261010T053450Z-partner-emails-manual/`.

- Fresh live application/data backups were captured at `target/` and `target-final/`. The final predeploy backup verified 19 tables and 835 rows, with 57 checksummed files, valid project/function/frontend archives and a complete second paginated read. Data and schema matched the earlier snapshot exactly.
- The recovery project `71834000000073259` was backed up before reset. Its 832 rows matched its accepted previous isolated restoration and contained no unique records. It was restored from the live snapshot, including all 835 rows, schema and remapped references.
- The previous live API build was redeployed to recovery and rehearsed with recovery-only runtime settings. All 12 API views matched after normalizing recovery-specific IDs and timestamps; all 835 restored raw rows remained unchanged. Recovery has no SMTP credentials and no schedules.
- `npm run validate` passed: 31 deployment-runner tests, schema/backend checks, TypeScript checks, 944 tests across 57 files and the production client build.
- Hosted read-only verification passed for all 12 API views, 48 frontend assets and all 835 raw rows. The deployed API source matches the validated candidate; live runtime variables, both worker archives, schedules and job pools remained unchanged.
- No live financial mutation or real email was used for smoke testing. Email behavior was covered by mocked-recipient tests.

Evidence files include `target-final/backup-verification.json`, `target-final-deployment-gate.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `rollback-isolation-verification.json`, `candidate-deploy.log` and `hosted-verification.json`. The archives and runtime configuration contain private material and are kept outside Git.

## Rollback

The previous live API archive and its captured runtime configuration are preserved in the private `rollback-live/` workspace. Before rollback, capture a new live data/application/configuration backup and API baseline. Verify the rollback archive and runtime settings. Do not automatically restore old data; preserve or reconcile transactions recorded since the backup.

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261010T053450Z-partner-emails-manual/rollback-live
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api --project 71834000000017016 --dc in --org 60088793510 -ni
```

After rollback, run read-only GET checks for `partners`, `allocations`, `capital-returns`, `profit-records`, `credit-cards`, each of those with `?deleted=true`, `activity` and `reminder-events`. Compare all 12 API views and raw table contents with the new backup, accounting for legitimate transactions since capture. Verify the API runs on Node 24 with 256 MB and the captured runtime variables; confirm worker archives, the two job schedules and job pools are unchanged. Code rollback does not restore data.

## Git sync

The deployed API source is in `13129d2`; the previously deployed UPI frontend source remains in `efb595f`. This release adds the deployment evidence and rollback procedure to `main` after hosted verification.
