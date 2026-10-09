# CFO Share filters and independent cashback statuses — 10 October 2026

Development, organization `60088793510`, project `71834000000017016`.

CFO Share hides transactions whose CFO share is zero and filters by payment month, inclusive date range and partner. Cashback is now recorded independently for each card contribution. When another cashback decision/payment exists for the same card and month, the app warns and asks for confirmation; confirming leaves the earlier transaction’s status unchanged. No schema migration or data backfill.

## Backup and rollback

Fresh verified live backup: `/Users/jaswanth-6838/CapitalOS-backups/20261010Tmanual-001/target`, 19 tables / 818 rows, complete pagination including deleted/history rows, schema, permissions, frontend, all three functions, runtime/configuration, schedules, job pools and project export. Two complete paginated reads matched; 57 checksums and ZIP integrity passed.

Before recovery reset, its fresh backup contained 19 tables / 747 rows and 57 checksums. It exactly matched the previously accepted recovery data/application baseline and contained no unique business records. The live snapshot was restored to the reusable recovery project with all 818 rows, custom fields and remapped references verified, then backed up again. The previous live frontend, API, daily worker and month-end worker were redeployed and rehearsed there. Verification passed for all 12 API views, 49 frontend assets, all three function archives/runtime settings, schedules and all 818 unchanged rows. Recovery schedules remain absent and worker email flags remain disabled.

The exact rollback source, runtime configuration, commands and checks are preserved in the private release archive. Before rollback, capture a new complete live backup and API baseline, preserve later transactions, and verify the archived checksums and schema/runtime compatibility. Then run:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261010Tmanual-001/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

After rollback, compare all 12 API views and raw rows with the new baseline, verify all 49 frontend assets, all three functions/runtime/authentication, and schedules/job pools. The previous app predates independent multiple-cashback statuses and can hide or misrepresent additional same-month cashbacks. Pause cashback edits until a corrected version is deployed. Code rollback does not restore data; reconcile all post-backup transactions.

## Validation and hosted verification

`npm run validate` passed on Node 24.21.0: 941 tests across 57 files, schema/backend checks, TypeScript and production build. Candidate client and all three functions match the validated local checkout. Coverage includes zero-share filtering, combined month/date filtering, confirmation for an additional cashback, unchanged peer statuses, and visibility after reload.

The hosted release passed 12 API views, 49 frontend assets, API/daily/month-end function files (1,159 / 1,146 / 262) and runtime configuration against the frozen candidate. All 818 raw rows were unchanged. Stored API data matched the baseline; the allocation endpoint’s derived cashback selection fields changed as intended for independent transaction statuses. Schedules and job pools were unchanged.

Read-only hosted behavior checks found 32 card/month groups, including two with multiple paid entries. Peer links and stored statuses were verified. A second-payment request without confirmation was rejected; the confirmed request with an invalid amount was also rejected before writing. A final raw-data check confirmed all 818 rows were unchanged and no email was sent. Browser verification confirmed the CFO Share table contains no zero-share entries, date filters work, and month plus date filters combine correctly.

Private evidence and complete backups are stored outside Git at `/Users/jaswanth-6838/CapitalOS-backups/20261010Tmanual-001`. No credentials or business data are included in this release record.
