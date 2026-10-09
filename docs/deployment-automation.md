# Guarded deployment runner

`npm run deploy` prints the release plan. It does not contact Catalyst or deploy.

```sh
npm run deploy:test
npm run deploy -- --plan --scope client
# Only after the setup requirements below have been completed:
npm run deploy -- --execute --config /absolute/private/release.json --scope all
```

Scopes are `client`, `functions`, and `all`. This adapter supports the existing **Development** project `71834000000017016` and reusable recovery project `71834000000073259`, organization `60088793510`. Production, schema migrations, runtime/configuration changes, backend dependency changes, stored files, unexpected function inventories, and changed API response baselines stop for review. There is no bypass flag. It never creates projects or automatically rolls back data.

The runner consolidates the October 8 release tooling. It is locally tested, **not yet qualified by a hosted deployment**. The repository's mandatory backup and rollback gates still apply. Do not interpret the existence of this script or its passing unit tests as proof of hosted backup/rollback readiness.

## Initial setup still required

1. Use Node 24 from `.nvmrc`, Python 3.10+, the installed Catalyst CLI, and authenticated Catalyst/Git access. The credential adapter uses the existing CLI's internal refresh API; if that changes, authentication fails closed. An optional short-lived `CATALYST_ACCESS_TOKEN` is accepted for API capture; the CLI must independently be authenticated for deployment.
2. Commit and review the intended source on `main`. The runner accepts a clean tree; it does not guess which unfinished changes to commit. It commits only its generated release record after hosted checks. The remote must be the repository specified in `AGENTS.md`, with no unmerged remote changes.
3. Copy `scripts/release/config.example.json` **outside Git**, set a durable, access-controlled backup root (mode `700`), and set the last verified recovery release folder and deployed source commit. Backups contain real data and runtime secrets. Provision storage durability/retention separately; a permission check cannot establish disk durability.
4. Configure the supplied platform_controls.py and behavior.py hooks as described below. The platform hook snapshots controls, restricts API access to GET, disables scheduled writers, verifies no application users and no additional deployed writer components, and drains the documented 15-minute job execution limit plus 30 seconds. Matching sequential reads alone are not an atomic snapshot. Privileged console/OAuth administrators retain recovery access and must not issue out-of-band writes during a release.
5. Remove embedded credentials from application source before automated release. The API source now reads private SMTP runtime values and requires CAPITALOS_EMAILS_ENABLED=true. On 9 October the user explicitly requested retaining the existing credential without rotation. Credential migration changes runtime configuration and requires its own reviewed release, not an exception to the scanner. The scanner does not replace a full security review.

No hosted settings, credentials or data are changed by installing this runner. No fake successful hooks are provided. Qualify one supervised release before treating it as deployment automation. Security Rules changes currently require console assistance: API reads work, but updates are rejected by this installation. The hook writes console-action.json and waits up to ten minutes for fresh API verification of the requested change. This is an assisted step, not an unattended capability.

## Hook contract

Each hook is an argv array whose first element is an absolute executable path. No shell interpolation occurs. Hooks are trusted release code: keep them reviewed, versioned separately from secrets, and restrict write access. A JSON receipt is evidence from that trusted implementation, not independent proof that a claimed mechanism exists.

The runner supplies `CAPITALOS_RUN_ID`, `CAPITALOS_RELEASE_DIR`, `CAPITALOS_SOURCE_DIR`, `CAPITALOS_RELEASE_SCOPE`, `CAPITALOS_PROJECT`, `CAPITALOS_RECOVERY_PROJECT`, `CAPITALOS_ENVIRONMENT`, and a fresh `CAPITALOS_RECEIPT` path. A hook must exit zero and write a JSON object at that exact path:

```json
{
  "passed": true,
  "run_id": "the supplied CAPITALOS_RUN_ID",
  "project": "71834000000017016",
  "recovery_project": "71834000000073259",
  "all_writers_paused": true
}
```

Required guarantees:

| Hook | Receipt field | Required implementation |
| --- | --- | --- |
| `quiesce` | `all_writers_paused` | Obtain exclusive maintenance control for both projects, drain in-flight writes, block user/API/direct datastore/job/integration writers while permitting this release's recovery restore. Must not deploy code or migrate schema to obtain the barrier. |
| `assert_quiesced` | `all_writers_paused` | Independently check that the barrier still holds, including after application deployment. A stale receipt/file is insufficient. |
| `resume` | `writes_resumed` | Idempotently release this run's maintenance control even if quiesce only partially succeeded. Do not release another run's control. |
| `isolation` | `outbound_email_blocked`, `access_permissions_verified` | Verify recovery outbound email is actually blocked, including hardcoded SMTP paths; verify restored access policies match the required protected recovery configuration. Remain effective across redeployments. Schedules must be absent. |
| `behavior` | `candidate_behavior_verified` | Run feature-specific checks against the frozen candidate in `CAPITALOS_RELEASE_DIR/candidate`. Use local tests or read-only inspection; do not deploy or mutate either hosted project. Verify frontend source parity for backend-only releases if relevant. Include visual review evidence when the release needs it. |

Any hook that needs to change hosted configuration must have its own applicable backup/rollback gate. These hooks must not hide a deployment, destructive operation, or unverified configuration change. Until an actual barrier and email isolation are available, the correct outcome is a guardrail stop.

## Sequence and failure behavior

The runner locks the shared Git directory to prevent concurrent invocations from local worktrees, checks source/remote/authentication, and runs `npm run validate`. It preserves the validated generated artifact hashes. It then obtains the write barrier, backs up live and recovery data/application/configuration, verifies identity and schema compatibility, prepares rollback commands and frozen artifacts, checks recovery against the previous verified baseline, restores live data into recovery, and backs up that restored state before rehearsing the previous build.

After the rehearsal, feature checks, and a fresh live drift check, it deploys the requested scope. Hosted verification checks 12 API views, frontend assets, exact function file inventories, runtime configuration, raw records, schema, and schedules. API differences stop even if they may be intentional: review and update the verification adapter before the next attempt.

Writes resume before release documentation and Git synchronization. Source must remain unchanged throughout. The runner generates a release document, commits it, pushes without force, fetches, and verifies that remote `main` contains the release commit. It never commits backup contents, hook logs or runtime configuration. The prior source must already be committed.

Detailed logs, receipts, snapshots and `status.json` live only in the private release directory. Console output is stage-level progress plus a blocker and evidence path. Helpers may contain sensitive server responses in private logs; do not paste whole logs into chat or Git. Unexpected exceptions are recorded privately.

A failure stops subsequent stages and attempts to release the write barrier, including on SIGTERM/Ctrl-C. If release fails, an urgent message reports that writes may still be paused. SIGKILL, power loss, and machine failure cannot run cleanup; the maintenance mechanism needs an independently recoverable lease/timeout and an operator recovery procedure.

There is no `--resume` for deployment: every new attempt takes fresh backups. A failure after a deployment command starts may represent a partial deployment. Inspect `deployment_attempted`, `hosted_verified`, `git_synced`, and the private logs. Do not rerun blindly or restore an old snapshot. If deployment and hosted checks passed but Git sync failed, complete Git sync separately from the recorded commit; do not redeploy merely to retry Git.

After a completed release, update private `recovery_baseline` to its release directory and `previous_source_commit` to `source_commit` in `status.json` before the next release. This explicit pointer update prevents a failed/partial run from becoming the accepted recovery baseline. It may be automated by a trusted operator wrapper only after all stages pass.

## Verification limits

Offline tests cover stage ordering and stop behavior, cleanup, missing/stale evidence, concurrent runs, source drift, checksum tampering/path escapes, target allowlists, secret-value redaction, and the hosted-success prerequisite for Git sync. They use synthetic fixtures and do not contact Catalyst. The adapter's actual APIs, restore semantics, credential refresh, permissions, and hooks still require supervised hosted qualification under both repository gates.

The runner intentionally has no default mechanism to mutate business records for smoke tests or send messages. New feature tests remain part of normal development; release automation does not establish all business behavior by itself.


## Runtime setup progress — 9 October 2026

The working API source now reads SMTP_USER/SMTP_APP_PASSWORD from private runtime configuration. Email fails closed unless CAPITALOS_EMAILS_ENABLED=true. CAPITALOS_MAINTENANCE=true blocks mutating API methods before parsing bodies, reading data or sending email. CAPITALOS_RECOVERY=true also permanently blocks those API mutations. Both scheduled workers return before initializing datastore/SMTP in maintenance or recovery mode. GET release-status exposes only guard booleans and a guard version, never credentials.

These are **local changes, not yet deployed**. They cannot pause the currently deployed older application. Initial installation therefore requires a verified platform-level write barrier, scheduled-job drain, protected recovery access and rollback rehearsal. After installation, environment flags provide defense in depth; they do not block direct administrative datastore writes by themselves or prove all writers are paused.

The existing credential was preserved privately without rotation at the user's request. Private release settings, the previous verified recovery baseline pointer, and a proposed live/recovery runtime configuration are prepared under the user's CapitalOS-private directory. Runtime configuration remains unapplied. Recovery runtime configuration should contain no SMTP credentials and should disable both scheduled workers; the older archived API still contains its original embedded credential and needs platform isolation during rollback rehearsal.

API read access verified the live and recovery project identities, three functions each, existing live schedules and absent recovery schedules. Console access to organization 60088793510 has now been restored. The Security Rules read endpoint was verified; update requests were rejected, and the recovery rules were verified unchanged after those attempts. The supplied platform hook therefore requests console-assisted changes and independently verifies them. The bootstrap and supervised deployment are pending qualification; no success receipts are fabricated.

Platform documentation: [Security Rules methods](https://docs.catalyst.zoho.com/en/serverless/help/security-rules/key-concepts/) and [editing Security Rules](https://docs.catalyst.zoho.com/en/serverless/help/security-rules/implementation/). Rules can restrict HTTP methods but do not control scheduled job execution or administrative datastore writes, so those need separate verification.


## Supplied hooks and one-time runtime installation

Set each platform hook to an argv array `["/absolute/path/to/python3", "/absolute/path/to/scripts/release/platform_controls.py", "HOOK_NAME"]`, using quiesce, assert_quiesced, resume or isolation. Set behavior to the same interpreter and scripts/release/behavior.py. Paths must refer to the reviewed release checkout. The only routine console intervention is a Security Rules change when console-action.json reports pending=true. The hook checks the actual platform configuration and harmless rejected-method probes; acknowledging a request is not sufficient.

`install_smtp_runtime` optionally names a private mode-600 JSON file containing exactly SMTP_USER and SMTP_APP_PASSWORD. This explicitly supported migration adds those values and the email/recovery flags to the frozen live API runtime configuration. It never rewrites the archived rollback build. Recovery rehearsal removes runtime SMTP secrets, disables both workers, and sets recovery/email guards; the platform HTTP restriction also protects legacy API code with embedded SMTP configuration. Remove install_smtp_runtime from normal-release configuration once installation is verified.

The writer inventory gate rejects extra event listeners, legacy crons, AppSail services, pipelines, application users or unexpected function inventories. It preserves administrative recovery access. This cannot prevent a privileged administrator from deliberately changing cloud controls or writing directly during maintenance; the release operator must retain exclusive administrative write ownership.

Drain-limit sources: [Advanced I/O limit](https://docs.catalyst.zoho.com/en/serverless/help/functions/advanced-io/) and [Job Function limit](https://docs.catalyst.zoho.com/en/serverless/help/functions/job-functions/).
