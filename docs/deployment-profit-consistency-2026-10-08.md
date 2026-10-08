# Profit payout and paid-rate consistency — 8 October 2026

Deployed and verified in **Development**, organization `60088793510`, project `71834000000017016`.

Monthly payout is current-month recorded profit plus the live remaining profit balance. A final ₹5,000 payment replaces a ₹6,000 estimate; with another ₹6,000 pending, payout is ₹11,000. Partial balances carry forward, and a settled non-recurring contribution does not reappear as an estimate after month rollover. Future recurring cycles retain the configured rate.

Dashboard, partner/portfolio summaries and partner detail use the shared calculation. Paid-profit history, public portal history, ledger and paid-profit CSV rates use actual payments, formatted to two decimal places. Contribution terms retain their configured monthly rate. WhatsApp and email confirmations use contribution capital rather than remaining capital, so later principal returns do not change the paid rate. Missing capital does not produce a fabricated configured paid rate. Partner urgency no longer compares unpaid debt against a changing paid-plus-pending total; capital-return deadlines and pending attention remain.

## Release scope and validation

API and frontend only; no schema changes or financial writes. The release was built in an isolated worktree from remote main. Unrelated uncommitted CFO-sharing features in the primary workspace were excluded and preserved.

`npm exec --yes --package=node@24.21.0 -- npm run validate` passed: **859 tests across 51 files**, schema/backend checks, TypeScript and production build. Coverage includes lower final payments, repeated partial payments, recur on/off, month/year rollover, reload persistence, principal returns, grouped payments, paid-rate formatting, failed initial loading and stale refresh behavior. This count is for the isolated release, not the broader workspace containing unfinished work.

## Backup and rollback evidence

Restricted archive outside Git: `/Users/jaswanth-6838/CapitalOS-backups/20261008T100007Z-profit-consistency`.

Fresh live backup captured **19 tables / 743 raw records**, including deleted records and history, schema/permission export, all three functions, frontend, private runtime configuration, cron/job-pool inventories and empty file-storage inventory. **57 checksums**, archive integrity and matching complete paginated snapshots passed.

The reusable recovery project **CapitalOS-Cards-Check**, Development `71834000000073259`, was freshly backed up (**655 records, 57 checksums**). Data and application matched its previously verified recovery state, establishing no unique business transactions. All **743 live records** were restored with verified custom fields, remapped references and matching second reads. The restored project was backed up again before rehearsal. Previous deployed application was redeployed there: **12 API views, 47 frontend assets, all three function archives/runtime settings and 743 unchanged records** passed. Recovery schedules and outgoing email jobs remain disabled.

Exact release and rollback commands were recorded privately in `release-procedure.md` before deployment. Final live gate confirmed unchanged data, schema, deployed builds/configuration, frontend version and schedules.

## Hosted verification

Deployment succeeded. All **12 API views, 47 frontend assets and 743 raw records** passed comparison. The hosted **1,154 API files** match the frozen candidate. The **1,145 daily-worker files** and **261 monthly-worker files** remain unchanged. Node24, memory, environment, authentication and cron/job-pool inventories passed verification. No live test payment or email was created.

Browser automation was unavailable in this session; hosted verification used API responses, complete asset checksums, downloaded function archives and runtime configuration. UI behavior was covered by the automated tests; no manual browser smoke is claimed.

Private evidence: `target/backup-verification.json`, `recovery-before/backup-verification.json`, `recovery-reset-gate.json`, `isolation/restore-verification.json`, `isolation-before-rollback/backup-verification.json`, `rollback-isolation-verification.json`, `validation.log`, `candidate-behavior-verification.json`, `target-deployment-gate.json`, `live-verification.json`, and `release-source-checksums.json`.

## Exact rollback

Capture and verify a **new complete live backup and API baseline** first. Preserve transactions recorded since this release backup. Verify archive checksums, required runtime configuration and unchanged schema compatibility, then:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261008T100007Z-profit-consistency/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions:capitalos-api,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Verify 12 API views and raw records against the new baseline; compare frontend assets and API files with rollback artifacts; verify Node24, memory, environment/authentication and unchanged workers/schedules. Check dashboard, partner detail and paid history. Rollback triggers include incorrect payouts/rates, broken loading or unexpected data/configuration drift.

Code rollback does not restore data. Data recovery must separately preserve or reconcile newer transactions.
