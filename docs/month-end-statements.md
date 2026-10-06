# Monthly partner emails

The month-end email job and schedule were deployed, verified and activated in Catalyst Development on 25 September 2026. The first statement is scheduled for **30 September 2026 at 10 AM IST**. The new `capitalos-current` MCP connection accesses organization `60088793510`; the earlier connection blocker is resolved. A disabled hosted job completed successfully, and all 264 raw records remained unchanged. See [release evidence](deployment-grouped-payments-2026-09-25.md). Checked-in defaults remain disabled for setup safety, and local mock mode never starts the worker.

The requested schedule is **10:00 AM Asia/Kolkata on the last day of each month**. Because it is sent in the morning, the statement is month-to-date at the displayed preparation time, not a promise to include transactions entered later that day. A delayed job shows its actual snapshot time. Later entries and corrections remain visible in the partner portal.

Every active partner receives one consolidated email at their saved address, including partners with no activity (zero monthly movement). Partners without an address are recorded as skipped. Deleted partners and deleted/hidden financial rows are excluded.

The email contains:

- Capital contributed during the calendar month.
- Capital returned during the calendar month.
- Profits paid during the calendar month.
- Profit remaining at the snapshot cutoff, including older unpaid dues, using the same unpaid-profit calculation as the app.
- Capital outstanding at the start of the month and at the cutoff.

Capital combinations are internal transfers, not new contributions. Returns against combined capital still reduce the overall capital balance. Future-dated contributions/payments are excluded. Capital returns do not settle profit. The remaining-profit figure is the app's recorded unpaid balance; it does not invent additional recurring accruals or projected future profit periods.

## Deployment and activation

Follow [DEPLOYMENT.md's mandatory backup and rollback gates](../DEPLOYMENT.md#mandatory-backup-gate) before deploying either function or changing the live schedule. Enabling this job starts outbound partner communication, so use only the one intended live environment. The Development environment can contain real data.

1. Capture and verify the existing data, deployed application, runtime/configuration, and current scheduler configuration. Verify rollback readiness in isolation and record the exact restore/smoke procedure before deployment.
2. Run `npm ci --prefix functions/capitalos-month-end`. `npm run validate` prepares the job's standalone shared modules and runs its tests. The generated `shared/` directory is required in the deployed artifact; its source modules are maintained in `functions/capitalos-api/`. `npm run month-end:prepare` can also regenerate it explicitly. The Catalyst function predeploy hook prepares it automatically before packaging.
3. Deploy `capitalos-month-end` as a Node 24 **Job Function** with sending disabled. It has no public HTTP endpoint. The existing `COS_Activity` table must retain its unique `event_id` constraint and allow SELECT/INSERT; the four financial tables need SELECT access. No schema migration is required.
4. Configure `SMTP_USER` and `SMTP_APP_PASSWORD` securely in the function's environment using the existing live Gmail SMTP account. Configure `APP_BASE_URL` for the actual live app. Do not put passwords in JSON, Git, commands, or logs. The job uses the configured account and does not copy the API function's embedded SMTP credentials.
5. Create a Function job pool named `capitalos_statements` and a **pre-defined cron** in the intended environment using [infrastructure/month-end-cron.json](../infrastructure/month-end-cron.json). Select target `capitalos-month-end`, timezone `Asia/Kolkata`, expression `0 10 28-31 * *`, and two retries five minutes apart. Keep the cron disabled until release checks are complete. The function independently checks the last calendar day and the 10 AM threshold, including leap years. This avoids relying on nonstandard `L` syntax.
6. Verify the deployed artifact/configuration and perform a disabled-mode smoke run: it must exit before initializing the datastore or SMTP. Use the supplied synthetic test harness to verify delivery and financial calculations; do not trigger a live email run merely as a smoke check.
7. After the release gates and configuration checks pass, set `MONTH_END_EMAILS_ENABLED=true` and enable that cron. Record its environment, ID, expression, timezone, target, and job-pool ID in the release evidence. Check its first scheduled run and `monthly-statement-email` Activity records. It is not active until both the flag and cron are enabled.

Catalyst's [Node Job Function example](https://docs.catalyst.zoho.com/en/tutorials/newsapp/nodejs/configure-job-function/) documents initializing the SDK from the job context. Its [cron SDK reference](https://docs.catalyst.zoho.com/en/sdk/nodejs/v2/job-scheduling/cron/create-cron-cron-expressions/) and [pre-defined cron guide](https://docs.catalyst.zoho.com/en/job-scheduling/help/implementation/submit-job-predefined-cron/) describe the scheduling fields and console setup. For direct REST requests, map `cron_detail` in the spec to `job_detail` and set `cron_execution_type=pre-defined`. Use pool name `capitalos_statements` (pool names allow alphanumeric characters and underscores) and job name `monthly_statements` (at most 20 characters). The timezone nesting in the checked-in spec also follows the installed Node SDK's `ICatalystCronExpression` type.

## Delivery and recovery

The job retrieves every page of all required datasets before preparing any email. A loading or validation failure aborts without sending an incomplete statement. Each partner/month has a unique Activity snapshot and a separate unique send-attempt reservation. Snapshot amounts and recipient are preserved for retries.

A retry resumes partners whose snapshot exists but whose sending attempt has not started. It never resubmits an email with a reserved, uncertain SMTP result: the provider may already have accepted it. Sent, no-address, and unconfirmed outcomes are append-only. The worker checks its remaining execution time before starting another attempt and fails the job when unattempted or unconfirmed rows remain, allowing scheduler retries and operational visibility. An outage extending beyond the month-end day requires manual review; the worker does not silently backfill another month.

An SMTP failure never modifies financial data. Inspect Activity and the mailbox before manually resolving unconfirmed outcomes. To stop future sends, disable the cron and set `MONTH_END_EMAILS_ENABLED=false`; retain Activity records so re-enabling cannot send duplicates. Any code rollback must use the verified prior artifacts/configuration recorded in the release evidence. No financial data restore is needed to stop this read-only reporting job.

For local mock isolation, the job also exits immediately when `CAPITALOS_MOCK=true` or `VITE_USE_MOCK=true`. There is no mock route that invokes the job. Automated tests replace the mail transport and datastore; they never send real emails.
