# Recurring profit month rollover — 1 October 2026

Deployed and verified in Catalyst Development, organization `60088793510`, project `71834000000017016`, India DC. [Open CapitalOS](https://capitalos-60088793510.development.catalystserverless.in/app/index.html).

## Corrected behavior

A completed September profit payment with Principal will recur creates October pending profit. A completed October payment settles that cycle and creates November upcoming only when Recur is selected on that payment. The latest payment's month determines which cycle is pending/upcoming. Partial payments retain their remaining balance. An unpaid cycle carries forward without automatically generating additional debts. Principal returned before a cycle starts reduces its basis; later returns do not settle profit already owed. Combination snapshots preserve recurring source debt as of their effective date. The API, client and monthly statement worker share these calculations.

The reported Santhosh cash contribution of ₹3,00,000 at 3% had a completed recurring payment on September 30. Read-only verification using the downloaded deployed code and existing live records confirmed **₹9,000 October pending and ₹0 November upcoming**. No payment or history records were rewritten to achieve this result.

## Backup and rollback gates

The user confirmed data entry paused before a new capture. Restricted backup outside the repository:

`/Users/jaswanth-6838/CapitalOS-backups/20261001T055555Z`

Development backup: **19 tables, 446 raw records**. Rehearsal backup: **19 tables, 144 raw records**. Complete paginated snapshots include deleted rows/history/import reservations. Two full reads matched, archives and checksums verified. Schema/security project exports, columns, deployed frontend/API/worker archives, runtime/environment and scheduler inventories were preserved. No stored-file folders exist. Credentials and data remain in restricted storage.

The previous live API, frontend and worker were successfully redeployed into isolated project `71834000000021001`. The 12 API views, 45 frontend files, 267 API files, 260 worker files and runtime/configuration passed; all 144 rehearsal records stayed unchanged. The rehearsal worker was newly created with sending disabled and no schedule, and was not invoked. The rehearsal's prior API/frontend had been matched to independently verified earlier October 1 artifacts before replacement. Exact release and rollback commands, triggers and smoke checks were recorded in `release-procedure.md`. Both mandatory gates were recorded before the live deployment.

## Release verification

Node 24 validation passed: **755 tests in 42 files**, schema/backend checks, TypeScript and production build. API, frontend and private monthly worker were deployed together. The downloaded release matched 45 frontend files, 269 API files and 261 worker files. All 12 API views remained equivalent and all **446 raw records remained unchanged**. Original Node 24, memory, environment/authentication, monthly worker enable flag and schedule/pool settings were preserved. No schema migration, verification transactions or emails were performed. Data entry may resume.

Evidence in the restricted root includes backup verification/checksums, `rollback-rehearsal-smoke.json`, both rollback function verifications, `deployment-gate.json`, `live-smoke.json`, both live function verifications, frontend/scheduler verification, `released/santhosh-rollover-verification.json` and `release-result.json`.

## Rollback

Pause writes and capture current data; verify `rollback-checksums.json`, then redeploy both archived functions and frontend:

```bash
cd /Users/jaswanth-6838/CapitalOS-backups/20261001T055555Z/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

Follow `release-procedure.md` for API, frontend, both backend archives, runtime, scheduler and raw-record smoke checks. After later transactions, use freshly captured data/API baselines. Schema is unchanged and compatible. Code rollback does not restore data: preserve and reconcile all later records rather than overwriting them with this earlier snapshot.
