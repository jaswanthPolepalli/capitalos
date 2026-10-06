# Profit after capital returns — 23 September 2026

Target: Catalyst **Development**, organization `60088793510`, project `71834000000017016`, India DC.

App: https://capitalos-60088793510.development.catalystserverless.in/app/index.html

This frontend/backend release keeps current unpaid profit based on the original contribution. Capital returns reduce the future monthly run rate without settling unpaid profit. Profit recording, editing, dashboard and bulk balances use the corrected obligation; combining capital preserves the original unpaid profit. No schema migration or business-data rewrite is involved.

Example regression: ₹1,78,500 at 3% with ₹1,62,500 capital returned and no profit paid has ₹5,355 profit pending, ₹16,000 capital outstanding, and a ₹480 forward monthly run rate.

## Backup and validation

Data entry was confirmed paused. Restricted fresh backup:

`/Users/jaswanth-6838/CapitalOS-backups/20260923T101911Z`

Development backup: **19 tables, 225 raw records**, including deleted rows and operational history. Independent complete paginated reads matched. Current deployed frontend/backend ZIPs, Node 24 configuration, schema/constraints and project security definitions are preserved; no filestore folders exist. Original backup checksums verified.

The isolated rehearsal project `71834000000021001` also has a fresh verified backup of **19 tables and 144 records**. Catalyst initially rejected its export while another project export was running; completing the exports sequentially resolved this before any deployment.

`npm run validate` under Node **24.21.0** passed: **666 tests across 34 files**, schema and syntax checks, TypeScript and frontend build. Frozen candidate and rollback workspaces retain the hosted dependencies, Node 24, memory and environment settings. Configurations remain in restricted storage rather than Git.

Status: **frontend and backend deployed successfully to Catalyst Development**.

Before release, the current target frontend/backend were redeployed to the isolated project. Verification passed for **44 frontend files**, **262 backend files**, **12 API views**, and all **144 unchanged raw records**. Node 24, memory, environment values and authentication were preserved. Catalyst adds an environment-update timestamp on deployment; this metadata timestamp is excluded from the operational configuration comparison.

After release, the target passed the same **44 frontend-file**, **262 backend-file** and **12 API-view** checks. All **225 raw records remained unchanged**. The downloaded deployed frontend archive matches the frozen candidate. No business transactions or emails were created by verification. Data entry may resume.

Restricted evidence: `deployment-gate.json`, `rollback-rehearsal-smoke.json`, `rollback-backend-verification.json`, `live-smoke.json`, `live-backend-verification.json`, and `released/frontend-verification.json`. The release log records both successful Catalyst deployment steps.

## Rollback

The exact commands and smoke checks were recorded in restricted `release-procedure.md` before deployment. If startup, data loading, payments, combinations or profit balances fail, pause writes and capture current records before rollback:

```bash
cd /Users/jaswanth-6838/CapitalOS-backups/20260923T101911Z/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Verify archived checksums first. After rollback, compare frontend and backend files to the saved build, verify runtime/configuration, the five core APIs and their deleted-record views, activity/reminder APIs, and all raw tables. Schema is unchanged and compatible with the archived application.

Code rollback does not restore data. Retain all post-backup transactions and reconcile any newer combined-profit snapshots separately. Do not overwrite current rows with the earlier snapshot. Catalyst may reuse a frontend history ID; the saved archive and its checksum identify the previous build.
