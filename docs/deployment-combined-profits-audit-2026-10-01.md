# Combined profit and audit history release — 1 October 2026

Deployed and verified in Catalyst Development, organization `60088793510`, project `71834000000017016`, India DC. [Open CapitalOS](https://capitalos-60088793510.development.catalystserverless.in/app/index.html).

Capital combined with an October 1 effective date now has pending profit in October. November upcoming profit requires a completed profit payment with **Principal will recur** selected. The latest payment controls the recurring setting. Original unpaid source profits remain separate.

Change history now displays readable previous/new values, edited records and capital combinations, including original entry dates, amounts, rates, funding sources, notes, remaining capital and carried unpaid profit. Search supports partner names and the change-type filter separates edits/combinations. Existing hosted audit records are decoded for display; no audit or business records were rewritten.

## Mandatory gates

The user confirmed live data entry paused before capture. Restricted durable backup outside the repository:

`/Users/jaswanth-6838/CapitalOS-backups/20261001T054018Z`

Development: **19 tables, 444 raw records**, including deleted rows and operational history. Rehearsal: **19 tables, 144 raw records**. All pages were retrieved; independent full rereads matched and file checksums verified. Backups preserve schema columns, complete project exports with constraints/security, all deployed frontend/function archives, runtime/environment configuration, and scheduler settings. No stored-file folders exist. Credentials and business data remain in restricted backup storage.

Before live deployment, the archived current Development API/frontend was successfully redeployed into the isolated project `71834000000021001` with its runtime/configuration. All 12 API views, 45 frontend files, 267 backend files, original Node 24 settings and 144 unchanged raw records passed. The rehearsal's previous build had been verified against independently redeployed September 25 artifacts/configuration before replacing it. Exact release/rollback commands, triggers, smoke checks and data reconciliation procedure are in restricted `release-procedure.md`; frozen candidate and rollback workspaces plus checksums are preserved. Both gates were recorded in `deployment-gate.json` before the live command.

## Validation and hosted verification

`npm exec --yes --package=node@24.21.0 -- npm run validate` passed: **746 tests in 41 files**, schema check, backend syntax, TypeScript and production build.

Only `capitalos-api` and the frontend were deployed. The hosted 12 API views remained equivalent; all 45 frontend files and 267 backend files matched the frozen candidate. Every one of the 444 raw records remained unchanged. Node 24, memory, environment and authentication settings were preserved. The monthly worker archive/configuration and scheduler settings were verified unchanged. No schema migration, verification transactions or emails were performed. Data entry may resume.

Evidence: `backup-verification.json`, `rollback-rehearsal-smoke.json`, `rollback-backend-verification.json`, `live-smoke.json`, `live-backend-verification.json`, `released/frontend-verification.json`, `released/preserved-worker-schedule.json` and `release-result.json` under the restricted backup root.

## Rollback

After pausing writes and capturing the latest data, verify `rollback-checksums.json` and run:

```bash
cd /Users/jaswanth-6838/CapitalOS-backups/20261001T054018Z/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Follow `release-procedure.md` for frontend/backend/runtime/API/raw-data smoke checks. For rollback after subsequent transactions, use newly captured API/data baselines. Schema is unchanged and compatible. Monthly worker/schedule are outside this release and remain unchanged. Code rollback does not restore data: preserve and reconcile later payments, edits and audit records; never automatically overwrite them with the pre-release snapshot.
