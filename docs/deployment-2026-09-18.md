# Catalyst release — 18 September 2026

## Target and current state

Target: **CapitalOS Development**, project `40997000000254001`, organisation `60070830470`, India DC. This is the existing daily-use application, not an isolated stage.

**Status: deployed successfully to Catalyst Development on 18 September 2026, approximately 15:45 IST.** The user instructed proceeding after the data-entry pause request. Final backup and rollback gates passed before deployment.

Live app: https://capitalos-60070830470.development.catalystserverless.in/app/index.html

Post-deployment checks confirmed Node 24, unchanged responses from all five core record APIs, working activity/reminder endpoints, correct deleted-record lists and exact checksums for all 37 frontend assets. No test writes were made to the daily-use project; write/recovery/import checks were performed in the isolated stage.

## Backup evidence

Restricted backup directory (outside Git): `/Users/jaswanth-6838/CapitalOS-backups/20260918T101416Z`.

- All 19 tables exported through paginated reads, including deleted rows: 130 total rows.
- Counts: COS_Partners 14, COS_Allocations 54, COS_Returns 8, COS_Profits 34, COS_CreditCards 20; other tables empty.
- Table metadata, columns, constraints and exported access rules captured.
- No File Store folders were present.
- Deployed frontend version `40997000000262003` and the `capitalos-api` Node 18 artifact downloaded independently, with ZIP integrity checks.
- Full Catalyst project export captured as `export_40997000000311001_2171069417958916.zip`.
- `checksums.json`, `row-counts.json`, `data-verification.json` and `backup-verification.json` contain machine-readable verification evidence. Backup files contain confidential data/configuration and must not be committed or shared publicly.
- A fresh backup and second complete source read were captured in the agreed quiet window immediately before deployment. All 19 table snapshots matched. This is a quiescent export, not a database-provided transactional snapshot.
- `deployment-gate.json`, `deployment.log`, `deployed-version.json` and `live-smoke.json` record the release and verification results. Catalyst reused the existing client history slot, so use the archived bytes and checksums—not the history ID alone—for rollback.
- Original rehearsal evidence remains under `/Users/jaswanth-6838/CapitalOS-backups/20260918T100435Z` and is referenced by the final backup.

## Isolated validation and rollback rehearsal

Isolated project: `CapitalOS-Rollback-20260918`, ID `40997000000311002`.

1. Restored the exported table schemas, access rules, old frontend and old Node 18 backend into the isolated project. Mail configuration, scheduled jobs and event listeners were excluded from the rehearsal import.
2. Checked the frontend and all five core read APIs.
3. Deployed the candidate frontend and Node 24 backend there.
4. Passed 16 hosted API checks using synthetic records: create/edit, audit history, linked deletion and restoration, reminder history including paise, and repeated CSV import detection. Test partners had no email addresses; no external notification was sent.
5. Backed up the synthetic stage data and candidate artifacts, then **redeployed the archived old frontend and Node 18 backend over the new version**.
6. Verified that the old frontend and all five read APIs worked and staging records remained intact. This verifies an actual hosted build rollback, not just the presence of an archive.

The isolated project currently retains the old build and synthetic verification records. No real business records were copied into it.

Local release validation: 638 tests, schema/template check, backend syntax, TypeScript and production build passed under Node 24. Physical-device/browser visual acceptance is not claimed.

Permissions inspection: exported rules grant App User SELECT and App Administrator SELECT/INSERT/UPDATE/DELETE for the new tables. Server-side writes worked in staging. History is append-only through the application API; privileged datastore administrators retain direct mutation rights. No claim of database-enforced tamper-proof history is made.

## Rollback procedure

Trigger rollback review if core loading, financial recording, recovery or application startup fails after release. Pause writes first and capture the latest data; never discard post-release transactions by restoring the old snapshot automatically.

The exact previous build is extracted at:

`/Users/jaswanth-6838/CapitalOS-backups/20260918T101416Z/rollback`

After verifying backup checksums and the compatibility checks below, run from that directory:

```bash
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 40997000000254001 --dc in --org 60070830470 -ni
```

The archived function's configuration selects its original Node 18 hosted runtime. The local CLI may run on Node 24. Keep the three additive tables and their rows; the old build does not consume them.

Verify the deployed function stack, frontend assets, five core API responses, partner/contribution counts and balances after rollback. Do not restore datastore rows merely to change application versions.

### Compatibility checks before a later rollback

- The old backend retrieves only the first 200 rows per table. If a table grows beyond that after release, exact old-build rollback would reintroduce truncation; use a reviewed compatibility fix instead.
- The new backend hides children of deleted parents logically, whereas the old build does not apply the same rule. Review deletes/restores recorded since deployment. Reconcile child visibility with an audited, backed-up compatibility migration before reverting if needed; do not blindly redeploy the old backend after such changes.
- Preserve reminder, import and audit history even though old screens do not display it.
- Reverting code does not undo payments, imports or edits. Data recovery is a separate controlled operation, with ID/reference reconciliation where necessary.

These checks mean rollback capability is verified, but rollback is not a guarantee that every later data state is compatible with the older application.
