# Cashback release — 6 October 2026

Deployed and verified in Catalyst **Development**, the current business-use environment: organization `60088793510`, project `71834000000017016`.

[Open CapitalOS](https://capitalos-60088793510.development.catalystserverless.in/app/index.html#/pending-profits).

## Released

Cashback sharing is additional to regular profit, with one editable payment per original card contribution. Historical paid cashback may omit its amount; unknown amounts stay out of monetary totals. The Profits page uses compact cashback rows and independent filters. Unresolved cashback stays visible across months and capital returns. Ledger, cumulative summaries, reports and statements separate cashback from regular profit; cashback does not reduce pending regular profit. Change history presents readable changed values. Mobile layouts were verified during local testing.

Added only nullable `COS_Allocations.cashback_data` TEXT(10000), without a default or backfill. Existing cashback entries remain available for manual review; no historical records were rewritten.

## Backup and rollback gates

Private backup root: `/Users/jaswanth-6838/CapitalOS-backups/20261005T185121Z` (outside the repository).

- `target`: fresh full backup of 19 tables / 498 raw records, including deleted entries and activity, schema/security export, frontend, both functions, runtime and private configuration. Archive integrity and SHA-256 checks passed. Two complete paginated reads matched; the live data was rechecked immediately before migration. No user write pause was assumed.
- `isolation/restore-verification.json`: all 498 records restored into isolated project `71834000000023864`, all custom fields verified, generated IDs and structured references mapped, complete second read matched. Original system metadata remains in the source backup.
- `rollback-isolation-*.json`: the previously deployed application was actually redeployed against the additive schema and verified: 12 API views, 45 frontend assets, 269 API files, 261 worker files, and all restored records unchanged.
- `target-before-api-retry`: an additional fresh full backup after an interrupted grouped deployment. Catalyst uploaded frontend and worker but returned a socket connection error for the API. The old API was verified unchanged before an API-only retry, which succeeded. Exact commands and gates are in `release-procedure.md` and `target-api-retry-gate.json`.

Monthly sending was disabled in isolation, no test schedules were created, and no partner emails or WhatsApp messages were sent.

## Verification

- Local validation: **775 tests across 44 files**, schema/backend checks, TypeScript checks and production frontend build passed.
- Hosted candidate: historical blank cashback amount, paid/edit/unpaid/not-applicable statuses, persistence, one editable settlement, audit history, and unchanged regular profits/returns passed using synthetic isolated data. Browser checks confirmed the compact list, independent filter, cumulative cashback totals, and a single edited ledger entry.
- Live release: **12 API views, 46 frontend assets, 271 API files and 261 worker files** verified against the frozen release. All **498 existing records remained unchanged**, allowing only the newly added null column. Node 24, memory/environment/authentication, existing monthly schedule and job pool remained unchanged.
- Live Profits page loaded and showed 39 historical cashback entries for manual review. No synthetic records were created in the live project.

## Exact rollback

First take a fresh complete backup and API baseline that includes all transactions since release. Verify `/Users/jaswanth-6838/CapitalOS-backups/20261005T185121Z/rollback-checksums.json` and preserve cashback data. From the frozen old workspace:

```sh
cd /Users/jaswanth-6838/CapitalOS-backups/20261005T185121Z/rollback
npm exec --yes --package=node@24.21.0 -- catalyst deploy --only functions,client --project 71834000000017016 --dc in --org 60088793510 -ni
```

For API-only rollback, target `--only functions:capitalos-api` from that same workspace. Verify 12 API views against the fresh baseline, all old frontend/backend hashes and runtime/configuration, unchanged schedule, and unchanged raw records. Review dashboard, profits, ledger and partner totals.

Keep the additive column and all cashback records; the old app ignores them. Code rollback does not restore data. Any data repair must explicitly reconcile transactions recorded after the snapshot. Never overwrite live data with this pre-release backup automatically. Full procedure, isolated evidence and private configuration are preserved in `/Users/jaswanth-6838/CapitalOS-backups/20261005T185121Z/release-procedure.md`.
