# Profit confirmation release — 18 September 2026

Target: CapitalOS Development, project `40997000000254001`, India DC. Scope: matching profit email details and removal of the monthly suffix from the WhatsApp rate. No schema changes.

Status: frontend and backend deployed successfully to Catalyst Development on 18 September 2026; live asset and API checks passed.

Backup location: `/Users/jaswanth-6838/CapitalOS-backups/20260918T102522Z` (restricted, outside Git). User confirmed data entry is paused. All 19 tables, including deleted rows and operational history, were exported and matched a second complete paginated read: 130 rows. Deployed Node 24 backend and frontend archives, runtime configuration, table metadata and full project export are preserved. No stored-file folders exist.

The isolated rehearsal project `40997000000311002` has its own fresh backup in `isolated-backup`. Its current artifacts match the exact old build successfully redeployed in the earlier release rehearsal. Its data also matched a second complete read. Rehearsal does not copy business data or send partner emails.

## Rollback

If application startup, core loading or profit recording fails, pause writes and capture the newest data before rollback. From `/Users/jaswanth-6838/CapitalOS-backups/20260918T102522Z/rollback`, run:

```bash
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 40997000000254001 --dc in --org 60070830470 -ni
```

The previous application uses Node 24 and the same schema; no data migration is part of this release. Verify the archived checksums before deploying. After rollback, verify frontend asset checksums, five core record APIs, activity/reminder APIs and deleted-record lists. Reconcile balances and any transactions recorded after the backup. Do not restore old rows as part of code rollback.

For the isolated project's own rollback, use the same command from `isolated-backup/rollback`, substituting project `40997000000311002`. Its previous Node 18 runtime configuration is preserved; that exact build was already successfully restored in the earlier hosted rehearsal. Its synthetic tables remain below the old build's pagination limit.

Validation: `npm run validate` passed under Node 24, including the full test suite, schema checks, syntax checks, TypeScript and production build. Profit email tests capture messages using a fake transporter; no actual email is sent during validation.

Rollback verification: the exact archived Node 24 backend and frontend were redeployed to the isolated project before the live deployment. Core APIs, activity/reminder APIs, deleted-record lists and all 37 frontend asset checksums passed. A complete paginated reread confirmed all isolated data remained identical to its pre-rehearsal backup. Machine-readable gate, checksums, deployment logs and smoke results are stored in the backup directory.

Live checks: all 37 frontend assets exactly match the validated build; all five core API responses are unchanged. Activity/reminder endpoints and deleted-record lists passed. No business writes or actual partner emails were sent during deployment verification.

Final verification: the hosted Node 24 backend files exactly match the validated candidate, and all 19 raw datastore snapshots still match the backup after deployment. Data entry may resume.
