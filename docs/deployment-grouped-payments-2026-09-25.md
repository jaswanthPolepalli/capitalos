# Grouped payments release — 25 September 2026

The application release is deployed and verified in Development, organization `60088793510`, project `71834000000017016`, India DC. [Open CapitalOS](https://capitalos-60088793510.development.catalystserverless.in/app/index.html).

## Released behavior

- Record capital returns or profit payments for multiple entries belonging to one partner, with per-entry persistence and retry reconciliation.
- Generate one consolidated WhatsApp confirmation without entry IDs. Profit confirmations include the paid percentage; remaining amounts are explicitly scoped to the selected entries.
- Send one consolidated email for a completed live payment group. Mock mode does not send email. Email failure does not undo financial payments.
- Send a consolidated monthly statement to each active partner with a saved email address at 10 AM IST on the last calendar day. **Monthly emails are active.**

No schema migration or financial data rewriting was performed. No verification emails were sent to partners.

## Backup and rollback gates

The user confirmed data entry was paused before capture. Restricted backup root, outside the repository:

`/Users/jaswanth-6838/CapitalOS-backups/20260925T103311Z`

Both environments have complete paginated raw table snapshots, including deleted rows and history, schema metadata, project exports with constraints/permissions, deployed frontend/backend archives, runtime/environment configuration, and scheduler inventory. There were no stored-file folders. Each backup was checked against a second full table read and verified checksums.

| Environment | Project | Tables | Records | Verified backup files |
|---|---|---:|---:|---:|
| Live Development | `71834000000017016` | 19 | 264 | 52 |
| Isolated rehearsal | `71834000000021001` | 19 | 144 | 52 |

The rehearsal environment's prior application was matched to independently deployed and verified artifacts from September 23. Its fresh backup passed before changes. The current live application's archived build was then redeployed into rehearsal with that environment's settings: 12 API views, 44 frontend assets, 262 backend files, original runtime/configuration, and all 144 raw records passed verification. Live rollback readiness was recorded before deployment.

Exact release, rollback and smoke commands are in the restricted root's `release-procedure.md`. Frozen `rollback/` and `rehearsal-rollback/` workspaces preserve the previous builds and configuration. Disable the monthly worker/schedule before any future rollback, capture a fresh backup, and redeploy the appropriate frozen workspace. Code rollback must preserve later transactions; never automatically restore this data snapshot.

## Verification

`npm run validate` passed under Node 24.21.0: 739 tests in 40 files, schema check, backend syntax, TypeScript, and production build.

After live deployment, 12 API views remained equivalent, all 45 frontend assets and 267 API backend files matched the frozen candidate, and all 264 raw records were unchanged. The API retained its Node 24 runtime, memory, environment and authentication settings. The private job's 260 files matched its candidate and its deployed type is `job`, runtime `node24`.

Function IDs: API `71834000000039182`; monthly worker `71834000000039218`.

Evidence: `deployment-gate.json`, `rollback-rehearsal-smoke.json`, `rollback-backend-verification.json`, `live-smoke.json`, `live-backend-verification.json`, `released/month-end-verification.json`, and `release-result.json` in the restricted root.

## Monthly activation

The user supplied a new Zoho MCP server and completed OAuth authorization. It is configured as `capitalos-current` in Codex; the organization-list tool verified access to `60088793510`. This resolved the earlier CLI scope limitation and old MCP account mismatch. No credentials were printed or committed.

Before activation, a fresh `pre-activation/` backup captured all 19 tables and 264 records, both deployed function archives and configurations, frontend, schema/project export and empty scheduler inventory. Two complete data reads matched and 54 file checksums passed. The release's isolated rollback rehearsal remains applicable; activation changed only scheduler resources and the job's enabled environment flag, with no additional code deployment or schema changes.

The Function pool was created through the new MCP connection, then the disabled cron was created and inspected. Catalyst requires alphanumeric/underscore pool names and job names no longer than 20 characters; the checked-in spec now uses valid names.

| Resource | Verified configuration |
|---|---|
| Job pool | `capitalos_statements`, ID `71834000000023829`, Function, 2048 MB |
| Cron | `capitalos_month_end_statements`, ID `71834000000021777`, pre-defined, enabled |
| Job name | `monthly_statements` |
| Target | `capitalos-month-end`, function ID `71834000000039218` |
| Expression / timezone | `0 10 28-31 * *` / `Asia/Kolkata` |
| Retry policy | Two retries, 300 seconds apart |
| Worker flag | `MONTH_END_EMAILS_ENABLED=true`, verified remotely |

The worker's SMTP credentials and app URL were configured through the authenticated Catalyst configuration API. With sending disabled, a hosted smoke job completed with `SUCCESS`; all 264 raw records matched the fresh backup. No verification emails were sent. The cron and worker were then enabled and their returned configuration was verified. The nine monthly-worker tests also passed after the scheduler-spec correction; the full 739-test validation passed before the application deployment.

Evidence in the restricted backup root: `current-mcp-organizations.json`, `released/current-mcp-create-jobpool.json`, `pre-activation/backup-verification.json`, `released/disabled-smoke-verification.json`, `released/schedule-verification.json`, and `release-result.json`.

The first actual statement is scheduled for **September 30, 2026 at 10 AM IST**. The scheduler also invokes the worker on September 28 and 29, but its last-day guard exits before datastore/SMTP initialization. The morning statement includes data available at its displayed preparation time. Delivery outcomes must be checked after the first scheduled run; this release did not send a real statement as a test.

To stop future sends, run `python3 tools/scheduler_control.py disable` from the restricted backup root. This disables the cron and restores `MONTH_END_EMAILS_ENABLED=false`, preserving the other environment values and all financial/Activity history. For application rollback, follow `release-procedure.md` and its verified frozen artifacts; capture a fresh backup and preserve/reconcile later transactions.
