# Manual Catalyst deployment playbook

Use this procedure whenever the user requests a deployment. It records the
manual workflow used for the 14 October 2026 cashback timestamp release. It
implements the [mandatory backup and rollback gate](../DEPLOYMENT.md#mandatory-backup-gate)
and [post-deployment Git sync](../DEPLOYMENT.md#post-deployment-git-sync).

The `npm run deploy -- --plan` command is a read-only planning step required by
the repository instructions. The guarded runner's execution path is not the
deployment procedure for this project while hosted qualification is incomplete.
Continue with the manual steps below. The user has authorized deployment and
the required post-release push; do not ask for a second confirmation.

## 1. Identify the exact release

1. Read `AGENTS.md`, the mandatory release gate in `DEPLOYMENT.md`, this file,
   the latest successful manual release record, and its private procedure.
2. Run `npm run deploy -- --plan` and retain its read-only plan result.
3. Identify the current Development/Production project, organization, data
   center, recovery project, release scope, runtime and exact Catalyst command
   from current repository documentation and authenticated read-only platform
   checks. Do not infer project IDs from old records.
4. Use the deployment scope that contains the actual changed code. Do not
   deploy unrelated functions or the client. Do not make a schema, runtime,
   dependency or secret migration part of an ordinary release; stop for the
   applicable separate gate if one is required.
5. Run the release validation under the documented Node version (`.nvmrc`),
   normally `npm exec --yes --package=node@24.21.0 -- npm run validate`.
   Review `git diff --check`, the exact source diff, and generated artifacts.

## 2. Create fresh private evidence

1. Create a new mode-700 run directory under the access-controlled backup root
   outside the repository. Never write backups, business records, runtime
   secrets, detailed private logs or generated financial reports into Git.
2. Use the reviewed manual Catalyst capture tooling from the latest successful
   manual release, after confirming it still matches the current Catalyst API
   and captures every required resource. Point it at the new run directory.
   Do not rerun old release commands with their original paths or overwrite an
   earlier evidence folder.
3. Capture the target environment completely: every paginated raw data table
   including deleted/history rows; schemas and permissions; project export;
   currently deployed frontend and all function archives; function runtime and
   environment configuration; schedules, pools and other writer inventory;
   and stored-file inventory. Preserve credentials only in protected private
   backup material.
4. Read every raw table again after the first read and require exact equality,
   valid pagination, matching row counts, unique row IDs, successful export,
   archive integrity and verified file checksums. Record project identity,
   timestamp, counts, checksums and evidence paths. If consistency or
   completeness fails, stop.
5. Capture the existing reusable recovery project before changing it. Verify
   its identity, full data, schema, app/runtime/configuration and schedules.
   Compare every record with the accepted recovery baseline; confirm there are
   no unique business records. Keep the old backup. If any difference is
   unexplained, stop without resetting recovery.

## 3. Restore and rehearse rollback in recovery

1. Record the rollback procedure, exact rollback command, triggers and smoke
   checks in the private run folder before any deployment command.
2. Restore the fresh target snapshot into the existing recovery project only
   after the previous step passes. Remap generated row IDs and foreign-key
   references while preserving the source backup unchanged. Verify all tables,
   custom fields, references and a complete second read.
3. Prepare the rollback build from the **fresh target capture** of the currently
   deployed application. Do not use a historical rollback folder unless its
   artifacts and configuration have been proven byte-for-byte compatible with
   the fresh capture.
4. Before deploying to recovery, disable outbound email, worker email flags
   and schedules; remove runtime SMTP secrets from the recovery configuration;
   enable the application's recovery guard; and point recovery URLs to the
   recovery project. Verify these controls in hosted configuration and by
   read-only checks. If isolation cannot be proven, stop.
5. Capture the recovery API baseline, then deploy the rollback build to the
   recovery project using the same scope and runtime as the live target.
   Verify all 12 API views, restored raw rows, schemas, function inventories,
   artifact contents, runtime/authentication/configuration, frontend assets,
   and absent schedules. A rollback rehearsal that used an older build does
   not qualify.
6. Capture and verify the recovery project again after rehearsal. Keep this
   post-rehearsal evidence, including confirmation that email and schedules
   remain disabled.

## 4. Freeze candidate and final live gate

1. Freeze the candidate from the fresh live capture, then apply only the
   reviewed release changes. Keep rollback and candidate in the private run
   folder. Preserve the previous app's runtime configuration for rollback;
   never expose it in ordinary logs or Git.
2. Verify candidate checksums and compare the candidate file inventory against
   the requested scope. For files that are expected to remain unchanged, check
   their content hashes. ZIP container bytes can vary due to archive metadata;
   compare archive entry inventory and entry contents when appropriate.
3. Run feature-specific local tests and inspect build output. If the UI changes,
   include the appropriate hosted browser smoke check after deployment. Never
   create financial writes or send real messages solely as smoke tests.
4. Immediately before deployment, capture a fresh target drift snapshot and
   compare data, schemas/permissions, all 12 API views, function archives and
   configuration, frontend asset contents, schedules and pools with the initial
   backup. Stop on any unexplained difference. Preserve/reconcile legitimate
   transactions; never overwrite later data to make the comparison pass.
5. Record a private predeployment gate stating that the data backup,
   rollback rehearsal, candidate checksum, validation and final drift checks
   all passed. Record the exact scope and Catalyst command.

## 5. Deploy and verify the hosted release

Use the standard Catalyst CLI form with the verified project IDs, organization,
data center, and exact scope. Example for an API-only release:

```sh
npm exec --yes --package=node@24.21.0 -- catalyst deploy \
  --only functions:capitalos-api \
  --project VERIFIED_PROJECT_ID --dc in --org VERIFIED_ORG_ID -ni
```

1. Run the command from the frozen candidate directory. Do not deploy from the
   mutable working tree or include an unreviewed scope.
2. After Catalyst reports success, verify all 12 API views and every raw table
   against the fresh baseline; verify schemas and permissions; deployed
   function/client artifacts; runtime/authentication/configuration; schedules,
   pools and file inventory. Confirm expected data is unchanged.
3. Run read-only feature smoke checks. Use browser checks for UI changes. Do not
   mutate financial data or send live email as a smoke test.
4. If the command fails or verification shows partial deployment, inspect the
   private evidence and deployed state. Do not blindly retry or restore old
   data. If rolling back, take a new backup first, preserve later transactions,
   verify the rehearsed rollback artifact/configuration and use the recorded
   rollback procedure.

## 6. Record and synchronize Git

1. Add a release document in `docs/` with the target, scope, behavior change,
   validation, hosted verification, fresh backup/recovery summary and exact
   rollback command. Add a short latest-release entry in `DEPLOYMENT.md`.
   Do not include private business data, backup contents, credentials or
   generated financial reports.
2. Commit the exact deployed source, relevant tests, non-secret configuration
   and release documentation to `main` in the documented GitHub repository.
   Push after successful hosted checks; this is part of the authorized release.
3. Fetch and verify the release commit is an ancestor of remote `main`. If
   authentication or push fails, report deployment and pending Git sync
   separately; do not claim the workflow is complete.
4. Keep detailed logs and all backup/rollback artifacts in the private run
   folder. Report stage summaries and the verified GitHub commit link.

## Stop conditions

Stop before deployment if a fresh backup is incomplete, a second read differs,
the recovery project has unexplained/unique data, restoration or rollback
rehearsal fails, recovery isolation is unverified, the final live state drifts,
candidate checksums change, or runtime/schema compatibility is uncertain.
Preserve all evidence, inspect the relevant failure, and report the specific
blocker. Never bypass a mandatory gate or rerun a destructive operation blindly.
