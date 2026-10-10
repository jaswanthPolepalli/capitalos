# Daily summary report update — 10 October 2026

Deployed to CapitalOS Development, organization `60088793510`, project `71834000000017016`, using the manual Catalyst workflow. The release scope was `functions:capitalos-api`, `functions:capitalos-daily-summary`, and `client`. No schema change was made.

## What changed

- Daily summaries use 12:01 AM IST on the generated date as the start of that day's activity window.
- Reports includes a **Display report data** control for the activity totals, current card usage, cash outstanding, and card balances.
- Cash outstanding is grouped by partner and confirmed due date. Cash without a confirmed due date is grouped together for that partner, and cash rows do not include expected profit.
- The PDF includes daily capital added/returned, profit paid and cashback paid; current card usage with outstanding amounts and pending profit; cash by partner and due date; and combined card/cash totals.

## Release verification

Private release evidence is stored outside Git at `/Users/jaswanth-6838/CapitalOS-backups/20261010T-pdf-summary-manual-release/`.

- The fresh Development backup contains all 19 tables and 835 rows, plus schema, function/frontend artifacts, configuration, schedules and pools. Checksums and a complete second paginated read passed. A final read-only drift check confirmed the live state still matched this backup before deployment.
- The recovery project was backed up before reset, verified to contain only the previously restored duplicate dataset, restored from the fresh Development snapshot, and used to rehearse the previous app. Rollback verification passed for all 12 API views, 48 client assets, all 835 rows, three function builds and runtime settings. Recovery schedules were absent.
- Recovery email delivery was disabled for the rehearsal: API recovery/email guards were set, both worker email flags were disabled, and SMTP variables were removed. No email was sent.
- `npm run validate` passed with 944 tests across 57 files, schema/backend checks, TypeScript checks and the production client build. `git diff --check` also passed.
- Hosted Development verification passed for all 12 API views, all 835 raw rows, schemas, 48 frontend assets, three function builds/configurations, schedules and pools.
- The signed-in Reports screen displayed the new report data preview. Read-only report data and PDF requests confirmed the 12:01 AM IST start, cash grouping, reconciled current totals, and the expected PDF sections. The PDF was valid and rendered as three pages. No email or financial write was triggered.

## Rollback

Before rollback, take and verify a fresh complete Development backup and API baseline. Preserve or reconcile any transactions recorded after that backup. Then redeploy the previous build frozen in the private `rollback/` workspace:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261010T-pdf-summary-manual-release/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api,functions:capitalos-daily-summary,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

After rollback, compare all 12 read-only API views and raw table rows with the fresh backup; verify schemas, the API and daily-summary artifacts and runtime configuration, all frontend assets, schedules and pools. Open Reports and check **Display report data** and PDF generation without sending email. The month-end worker was outside this release scope. Code rollback does not restore data.
