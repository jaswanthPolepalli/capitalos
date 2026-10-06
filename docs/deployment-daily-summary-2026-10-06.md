# Daily summary release — 6 October 2026

## Summary field correction — deployed 6 October 2026

The API and daily-summary worker now use only the due date checked and saved in **WhatsApp Summary**. Missing or unconfirmed dates display **Bill not generated**. Each card's pending-profit column displays **Profit paid** when its remaining profit is zero, otherwise its pending amount. Both manual and scheduled summary PDFs use this behavior.

Fresh restricted backup: `/Users/jaswanth-6838/CapitalOS-backups/20261006T055321Z-summary-fields`.

- **Data gate:** all 19 tables / 592 raw records, including deleted records and Activity, schema/permissions export, all three deployed function archives, frontend, runtime/private configuration and schedules captured. All 57 checksums and ZIP integrity passed; two complete paginated raw reads matched.
- **Restoration and rollback gate:** all 592 records restored and verified in new isolated project `71834000000034766` (`CapitalOS-Summary-Fields-Check`), including remapped references and every custom field. The actual previous hosted build was redeployed there with sending disabled and no schedules. Verification passed for 12 API views, 46 frontend assets, all three functions and runtime/configuration; all restored records remained unchanged. Exact rollback commands and smoke checks were recorded before live deployment.
- **Validation:** `npm run validate` passed on Node 24.21.0, including 816 tests across 48 files. The frozen candidate contains only the two changed summary modules in each of the API and daily worker; all other files come from the current hosted archives. A current-data four-page PDF was visually reviewed, and all financial amounts, activity and cashback matched the previous renderer's inputs.
- **Pre-deploy check:** raw data, schema, function archives/configuration, frontend version and schedules still matched the fresh backup immediately before deployment.
- **Hosted verification:** both function deployments succeeded. All 12 API views, 46 frontend assets, 1,154 API files, 1,145 daily-worker files and 261 unchanged monthly-worker files passed comparison. Node 24, memory, environment and authentication settings matched. All 592 records remained unchanged. Reports loaded successfully in the browser's CEO read-only view.
- The existing daily cron and worker remain enabled at **11 PM Asia/Kolkata**. Monthly scheduling remains unchanged. No test email was sent; inbox delivery was not part of this verification.

Evidence in the restricted backup root: `target/backup-verification.json`, `isolation/restore-verification.json`, `rollback-isolation-verification.json`, `candidate-changes.diff`, `candidate-report-verification.json`, `target-deployment-gate.json`, `live-verification.json`, `release-complete.json`, and `release-procedure.md`.

### Rollback for this correction

Capture and verify a **new** complete target backup and API baseline before rollback, retaining transactions and email Activity added after this release. Verify `rollback-checksums.json`, then run:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261006T055321Z-summary-fields/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api,functions:capitalos-daily-summary --project 71834000000017016 --dc in --org 60088793510 -ni
```

Compare 12 API views with the new baseline, both function archives with the rehearsed rollback files, runtime/configuration, all new raw records, frontend, monthly worker and schedules. Smoke-check Reports. No schema migration occurred. Do not restore the old data snapshot over later transactions. The full triggers and commands are in `release-procedure.md`.

## Initial daily-summary release

Deployed and activated in **Development**, organization `60088793510`, project `71834000000017016`, the existing business-use environment.

[Open Reports](https://capitalos-60088793510.development.catalystserverless.in/app/index.html#/reports). In the unlocked CFO workspace, **Send summary email** sends the full current card/cashback PDF to `jackgun9@gmail.com`, regardless of the Reports period filter or whether there were transactions today.

Automatic delivery is active at **11:00 PM Asia/Kolkata**, starting **6 October 2026**, conditional on financial activity. SMTP submission starts at the scheduled time; inbox arrival depends on the email provider. The approved PDF layout, outstanding-capital grouping, due-date ordering, cashback follow-up, and duplicate-send protection are deployed. See [behavior and recovery](daily-summary-email.md).

## Backup and rollback gates

Restricted backup root outside the repository:

`/Users/jaswanth-6838/CapitalOS-backups/20261006T050455Z-daily-summary`

- `target`: fresh complete backup of **19 tables / 510 raw records**, including deleted rows and Activity, schema/permissions export, both previously deployed function archives, frontend, private runtime/configuration, and scheduler inventory. All 55 checksums and archive integrity passed. Two complete paginated data reads matched; no user write pause was assumed.
- `isolation`: all 510 records restored into new project `71834000000052024` (`CapitalOS-Daily-Check`). Custom fields and remapped references were verified, then a complete second read matched. Original generated IDs/system metadata remain in the source backup and the private restoration map.
- `rollback-isolation-verification.json`: the actual previous hosted build redeployed and verified in isolation: 12 API views, 46 frontend assets, 271 API files, 261 monthly-worker files, Node 24/runtime configuration, and 510 unchanged records. Sending was disabled and no schedules were created in isolation.
- `isolation-before-candidate`: fresh backup of the isolated restored application before testing the new candidate; 19 tables, 510 records and 55 checksums verified.
- `target-deployment-gate.json`: recorded before live deployment. Live raw data, function configuration and schedule still matched the original backup. Frozen candidate/rollback checksums, restoration, independent rollback redeployment, local validation and isolated candidate checks all passed.
- `pre-activation`: fresh backup of the deployed release before adding/enabling the daily schedule: 19 tables, 510 records, all three function archives/configurations, and 57 verified checksums.

The isolated restore encountered a transient table-metadata 404 after table creation; bounded read retries resolved it. No live schema change was made. Exact deployment/rollback commands, triggers and smoke procedures are preserved in `release-procedure.md` in the restricted root.

## Deployment and verification

- `npm run validate` passed on Node 24.21.0: **814 tests across 48 files**, schema/backend checks, TypeScript and production build.
- Candidate deployed and verified in isolation before Development. The new summary route rejected an invalid request ID without sending email. Reports rendered normally with restored data.
- Current-data PDF was generated and visually checked across five pages, including 21 card rows and 41 cashback follow-up rows. Page bounds and repeated table headers passed.
- Live verification: **12 API views, 46 frontend assets, 1,154 API files and 1,145 daily-worker files** matched the frozen candidate. The original monthly worker's 261 files/configuration remained unchanged. All **510 pre-existing raw records remained unchanged**.
- Live Reports rendered with existing balances. The CFO-only send control was covered by UI tests and verified hosted build artifacts; the browser smoke used the CEO read-only view.
- Disabled hosted job `71834000000047406` completed with **SUCCESS**. The disabled flag was verified before submission and all 510 records remained unchanged. No test email was sent.
- After enabling, an immediate configuration read briefly returned the old worker flag; subsequent independent reads and full schedule verification confirmed both enabled flags, timezone, expression and target. Existing monthly cron and job pool remained unchanged.

## Active schedule

| Resource | Verified value |
|---|---|
| Recipient | `jackgun9@gmail.com` |
| Daily function | `capitalos-daily-summary`, ID `71834000000055152`, Node 24 Job Function |
| Worker flag | `DAILY_SUMMARY_EMAILS_ENABLED=true` |
| Cron | `capitalos_daily_summary`, ID `71834000000023890`, pre-defined, enabled |
| Expression / timezone | `0 23 * * *` / `Asia/Kolkata` |
| Job pool | Existing `capitalos_statements`, ID `71834000000023829` |
| Retry policy | Two retries, 300 seconds apart; uncertain SMTP attempts are not resent |
| First scheduled run | 6 October 2026, 11:00 PM IST |

Evidence: `live-verification.json`, `released/disabled-smoke-verification.json`, `released/schedule-verification.json`, and `release-complete.json` in the restricted backup root. Actual first-run email delivery must be observed after the scheduled time; this release verified activation and the disabled runtime, not inbox delivery.

## Exact rollback

First disable only the new daily scheduler and worker:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261006T050455Z-daily-summary
python3 tools/scheduler_control.py disable
```

Capture a **new** complete backup and API baseline that preserve every transaction and email Activity record added since this release. Verify `rollback-checksums.json`, then redeploy the independently rehearsed old API/frontend:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261006T050455Z-daily-summary/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Verify 12 API views against the new baseline, all archived frontend/API hashes, runtime/configuration, unchanged new raw records, and the existing monthly worker/schedule. Review dashboard, profits, ledger and Reports. Keep the disabled daily worker/cron and all history. No schema migration was needed; code rollback does not restore data. Never overwrite post-backup transactions with the old snapshot.
