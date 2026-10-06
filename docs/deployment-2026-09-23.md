# Frontend release — 23 September 2026

Target: Catalyst **Development**, organization `60088793510`, project `71834000000017016`, India DC.

App: https://capitalos-60088793510.development.catalystserverless.in/app/index.html

Scope: prevent repeated ledger deep-link scrolling, allow profit recording after capital return, add credit-card search/partner/utilisation filters, and show profit funding sources beside partner names on phones.

Client-only release. The hosted backend matches the local backend source and package files exactly; no backend, runtime, schema or data migration is needed.

## Backup and release gates

User confirmed data entry paused before backup. Restricted backup storage outside the repository:

`/Users/jaswanth-6838/CapitalOS-backups/20260923T100350Z`

The target backup contains all **19 tables and 217 raw records**, including deleted records and operational history. Two complete paginated reads matched. All 50 original backup-file checksums passed. Current frontend/backend archives, Node 24 configuration, schema/constraints and full project export are preserved. No filestore folders exist.

The isolated rehearsal project `71834000000021001` has a separate verified backup of 19 tables and 144 records. Its prior frontend matches the target's archived frontend and the exact September 21 build previously hosted and verified in both projects. Its schema and backend remain unchanged.

`npm run validate` under Node **24.21.0** passed: **657 tests across 33 files**, schema check, backend syntax checks, TypeScript and frontend build. The candidate is frozen under `candidate/client/dist` in the backup directory.

Status: **deployed successfully to Catalyst Development**. The archived frontend was redeployed to the isolated project before the target release: all **44 served files**, **12 API views**, and **144 unchanged raw records** passed verification.

After the target deployment, all **44 live frontend files** matched the frozen candidate, all **12 API views** matched their predeployment responses, and all **217 raw records** matched the backup. The downloaded deployed frontend archive also matches the candidate, and the backend configuration is unchanged. Machine-readable evidence is in `deployment-gate.json`, `rollback-rehearsal-smoke.json`, `live-smoke.json` and `released/verification.json` within the restricted backup folder. Data entry may resume.

Catalyst retained frontend history ID `71834000000034440` when updating the client version. Use the separately captured archive and its checksum for rollback; the history ID alone no longer identifies the old bytes.

## Rollback

The previous frontend history ID is `71834000000034440`. Exact commands, triggers, data-recovery considerations and smoke checks are recorded in the restricted `release-procedure.md` before deployment.

If startup, loading, ledger scrolling, profit entry, card filters or mobile controls regress, pause edits and capture current data before code rollback. Verify the archived frontend checksum, then:

```bash
cd /Users/jaswanth-6838/CapitalOS-backups/20260923T100350Z/target/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Check every served frontend file against the archive, the five core APIs and their deleted-record views, activity/reminder APIs, and raw table snapshots. The previous client remains compatible with the unchanged Node 24 backend and schema. Code rollback retains current records; do not restore the old data snapshot over later transactions. Data recovery must reconcile post-backup writes separately.
