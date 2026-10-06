# CapitalOS — Deployment & Project Reference

**Latest frontend release — 6 October 2026:** Cards now open a compact transaction list with Date, Transaction type, Amount, Notes and monthly %, newest-first sorting and date/type/search filters. Deployed to Development after a fresh verified 600-record backup, isolated data restoration and rollback rehearsal, 820 tests and hosted/browser verification. See [release evidence and rollback](docs/deployment-card-transactions-2026-10-06.md).

**Latest release — 6 October 2026:** Daily PDF summaries now use WhatsApp-confirmed due dates, show **Bill not generated** for missing/unconfirmed dates, and **Profit paid** for settled card profit. The API and daily worker are deployed to Development; the 11 PM IST schedule remains active. Fresh 592-record backup/restoration, isolated rollback rehearsal, 816 tests and hosted verification passed. See [release evidence and rollback](docs/deployment-daily-summary-2026-10-06.md).

**Earlier release — 6 October 2026:** Cashback sharing and the requested list, filters, totals and readable history updates are deployed to Development. Fresh full backups, an isolated 498-record restore, rollback rehearsal and live verification passed. See [release evidence and rollback](docs/deployment-cashback-2026-10-06.md).

**Previous release — 1 October 2026 (month rollover):** Development now creates October pending profit from a completed recurring September payment and requires an October recurring payment for November upcoming. The API, frontend and monthly statement worker were deployed after fresh backups and an isolated rollback rehearsal. All 446 records remained unchanged. See [release verification and rollback](docs/deployment-profit-month-rollover-2026-10-01.md).

**Earlier release — 1 October 2026:** Development now starts combined-capital profit on the effective date, requires Principal will recur for next-month upcoming profit, and shows readable edits and capital combination details in Change history. Fresh backups, isolated rollback rehearsal and hosted verification passed; all 444 records remained unchanged. See [release evidence and rollback procedure](docs/deployment-combined-profits-audit-2026-10-01.md).

**Previous release — 25 September 2026:** Development now includes grouped capital/profit payments, consolidated WhatsApp confirmations, and live grouped email confirmations. Monthly partner statements are also active at 10 AM IST on the last calendar day, with the first scheduled for September 30, 2026. See [release evidence and activation status](docs/deployment-grouped-payments-2026-09-25.md). This follows the [profit-after-capital-return correction](docs/deployment-profit-capital-returns-2026-09-23.md).

**Active deployment — 21 September 2026:** CapitalOS Development now runs in subscribed organization **60088793510**, project **71834000000017016**, using the user-selected September 18 data backup. Open [the current app](https://capitalos-60088793510.development.catalystserverless.in/app/index.html). See [migration evidence, current resource IDs, and rollback procedure](docs/deployment-account-migration-2026-09-21.md). The local project association and function configuration target this new organization.

**Historical reference:** the account IDs, URLs, and commands in the older sections below describe the original organization **60070830470**. Use the migration record above for the current deployment. The prior profit confirmation release is documented [here](docs/deployment-profit-confirmation-2026-09-18.md), and the earlier broader release [here](docs/deployment-2026-09-18.md).

## Monthly statements active

The private `capitalos-month-end` Job Function and its pre-defined cron are deployed, verified and enabled in the current Development project. The schedule is **10 AM IST on the last calendar day**; the worker rejects earlier days before reading data or initializing SMTP. A disabled hosted smoke run succeeded with all 264 records unchanged. The new `capitalos-current` MCP connection was authorized and verified against organization `60088793510`, resolving the earlier job-pool creation blocker. See [release evidence](docs/deployment-grouped-payments-2026-09-25.md) and [monthly statement operations](docs/month-end-statements.md). Checked-in function/cron defaults remain disabled for safe setup in other environments.

## Cashback implementation — released 6 October 2026

Development has the additive nullable `COS_Allocations.cashback_data` TEXT(10,000) column and the verified cashback application release. Existing rows were not backfilled. See [behaviour](docs/cashback-implementation.md), [column definition](infrastructure/cashback-column.json), and [release verification and rollback](docs/deployment-cashback-2026-10-06.md). Other environments still require both gates below before schema or application deployment.

## Mandatory backup gate

**No deployment without a fresh, verified backup of the target environment.** This rule applies before every Development or Production release, including frontend-only, backend-only, hotfix and manual/CI deployments, and before hosted schema/data migrations. Development may be the app used for daily operations.

**Both gates must pass before deployment:**

1. **Data backup:** existing data is completely backed up, verified and restorable.
2. **Rollback readiness:** the previous deployed frontend/backend build is preserved and can be redeployed if the new release has issues. Verify artifact integrity, runtime/configuration availability and compatibility with the post-deployment schema. Record exact rollback commands, rollback triggers and post-rollback smoke checks. Validate redeployment in an isolated environment before claiming rollback readiness; do not overwrite the active app to rehearse it.

If either gate fails or remains unverified, **do not deploy**. Keeping a ZIP or Git commit alone does not establish that rollback will work. Code rollback and data restoration are separate operations; do not automatically restore an old data snapshot when reverting a build.

Before running deployment or migration commands:

1. Identify the exact project, environment and deployed version. Pause writes or use a consistent snapshot mechanism so the backup does not mix records from different points in time.
2. Back up all existing application datastore tables, including deleted records, history, reminders and import reservations. Retrieve every page, not just the first 200 rows. Include referenced stored files where applicable, schema definitions, constraints and access permissions.
3. Preserve the currently deployed frontend and backend artifacts, runtime versions and deployment configuration needed to restore that version. Preserve necessary secret configuration through secure backup or managed version references; never put credentials in Git, logs or ordinary Markdown files. Do not substitute the new local build for the currently deployed version.
4. Store the backup in access-controlled durable storage outside the working tree. Record its timestamp, project/environment, artifact versions, table row counts, checksums and secure storage reference in the release record, without including business data or credentials.
5. Verify the backup is readable and complete: reconcile table counts, validate checksums and archives, and confirm a documented restoration path. A schema-changing release must also validate restoration in an isolated environment before proceeding.
6. Record both the backup verification result and rollback verification evidence before the first deployment command. If backup capture, consistency, restoration or rollback verification fails, **stop the deployment** and report the blocker. Resume writes after capture when appropriate; avoid leaving operations paused if a release is abandoned.

A frontend/backend pair may share one verified backup when deployed together as one release. A separate deployment attempt requires a fresh backup. Rollback planning must account for writes made after the backup; restoring old data must not silently discard newer transactions.

This is a mandatory repository workflow rule, not an automated backup implementation. No backup or deployment is performed merely by updating this document.

### One reusable backup project

Use the existing CapitalOS business-use project and **one dedicated, reusable backup/recovery-test project**. Do not create a new project for each release. Reuse an existing verified recovery-test project; record its project ID and environment before use. The permanent backup project has not yet been designated or consolidated from the existing release-check projects.

For each release:

1. Capture and verify a fresh, consistent backup of the live data and currently deployed application using the gate above. Keep versioned archives in access-controlled durable storage outside both projects so refreshing the backup project does not erase the only recovery copy.
2. Before resetting the reusable backup project, verify its identity, preserve and verify its existing data/application under the same backup gate, and confirm it has no unique business transactions. Copy the live snapshot and previous deployed application into it. Live remains the business-use setup; copying does not move users or remove live records. Keep outbound email and schedules disabled in the backup project.
3. Verify restored records, references, artifacts, runtime/configuration and rollback smoke checks in the backup project. Record exact rollback commands and schema compatibility. If candidate testing changes this project, preserve the verified previous build/data and return it to the verified recovery state before deploying to live.
4. Deploy the release to the existing live setup only after all required checks pass, then run live smoke checks. Preserve or reconcile any transactions recorded after backup if recovery becomes necessary.

The older per-release `*-Check` projects are historical test environments. Consolidation or deletion requires checking their contents and preserving required recovery evidence first; this policy update does not delete, rename or reset any hosted project.

## Development schema provisioned — 18 September 2026

Used the existing documented Catalyst OAuth connection and REST API to create the three additive tables in Development. A separate `schema:operations -- --check` passed after creation; metadata inspection confirmed required columns and unique keys. No existing business records were changed. No application deployment was performed in this step. Hosted function access and table permissions still need verification during the staged release.

| Table | Development table ID | Custom columns |
|---|---|---|
| `COS_Activity` | `40997000000298001` | 11 |
| `COS_Reminders` | `40997000000304003` | 12 |
| `COS_Imports` | `40997000000303003` | 5 |

The migration now addresses tables by name because numeric IDs exceed JavaScript's safe integer range, uses the documented `Environment: Development` header, and retries GET 404 responses briefly to allow newly created table metadata to become available. It never retries POST requests automatically. [Catalyst column metadata API](https://docs.catalyst.zoho.com/en/api/code-reference/cloud-scale/push-notifications/ios/enable-ios-push-notifications/) documents table-name addressing and the environment header.

## September release: schema before code

The repository now targets **Node 24**, with local/CI patch version in `.nvmrc`. The Development function is verified on Node 24 as of the September release. Use `nvm install && nvm use`, npm 11.17.0, then install both lockfiles with `npm ci` and `npm ci --prefix functions/capitalos-api`.

Before deploying the upgraded function, provision **COS_Activity**, **COS_Reminders** and **COS_Imports** from `OPERATIONS_TABLES` in `infrastructure/datastore/schema.ts`:

1. Run `npm run schema:operations` to inspect the offline plan.
2. Supply `CATALYST_PROJECT_ID` and a short-lived `CATALYST_ACCESS_TOKEN` securely in the environment. `CATALYST_API_ORIGIN` defaults to the India API origin. The script only targets Development.
3. Run `npm run schema:operations -- --apply`, then `npm run schema:operations -- --check`. This adds missing tables/columns and refuses incompatible definitions; it does not delete or migrate existing business records.
4. Verify backend access and table permissions in Catalyst. Activity/reminder tables require SELECT/INSERT, with no application UPDATE/DELETE; imports also require UPDATE. Unique `event_id`/`import_key` constraints are required. The script creates schema, not access policies.
5. Run `npm run validate`, deploy the Node 24 function to Development, and smoke-test retrieval, one edit/history entry, deletion/restoration, import duplicate handling and a manual reminder before deploying the matching client.
6. Promote the additive schema before application code if releasing to Production. Retain the previous code artifact for rollback and keep the additive tables. Review any operations marked unconfirmed before retrying.

Do **not** import the full legacy project template into the existing project as a migration. Missing activity storage intentionally prevents business writes; deploying code first will make writes fail. History begins with this version and cannot reconstruct earlier changes. The Development schema was subsequently provisioned as recorded above; application deployment remains outstanding.

See [approved improvements](docs/approved-improvements-2026-09-18.md) for acceptance criteria and known limits.

## Live App

| Environment | URL |
|---|---|
| Development | https://capitalos-60070830470.development.catalystserverless.in/app/index.html |

---

## Catalyst Project Info

| Field | Value |
|---|---|
| Project Name | CapitalOS |
| Project ID | `40997000000254001` |
| Org ID | `60070830470` |
| Data Center | `in` (India) |
| Environment | Development |

---

## Datastore Tables

Five core **COS_** tables power the frontend store; three additional operational tables are required by the September release above:

| Table | Table ID | Purpose |
|---|---|---|
| `COS_Partners` | `40997000000266029` | Capital partner records |
| `COS_Allocations` | `40997000000261019` | Capital allocations (amount, profit%, dates) |
| `COS_Returns` | `40997000000274001` | Capital return payments |
| `COS_Profits` | `40997000000263015` | Profit payment records |
| `COS_CreditCards` | `40997000000251036` | Partner credit cards for card-funded capital |

### Column Schemas

**COS_Partners**: `name` (varchar, required), `phone`, `email`, `notes` (text)

**COS_Allocations**: `partner_id` (varchar, required), `amount_rupees` (bigint, required), `profit_percent` (varchar, required), `received_date` (date, required), `return_date` (date), `credit_card_id` (varchar), `notes` (text)

**COS_Returns**: `allocation_id` (varchar, required), `partner_id` (varchar, required), `amount_rupees` (bigint, required), `returned_date` (date, required), `notes` (text)

**COS_Profits**: `allocation_id` (varchar, required), `partner_id` (varchar, required), `amount_rupees` (bigint, required), `paid_date` (date, required), `notes` (text)

**COS_CreditCards**: `partner_id` (varchar), `card_name` (varchar 255, required), `card_limit` (bigint), `pending_limit` (bigint), `bill_generation_date` (date), `due_date` (date), `notes` (text)

> **Note on `partner_id` columns:** All `_id` reference columns are stored as **varchar(50)** in every table — not as Catalyst foreign key data type. The Catalyst REST API does not support creating `foreign key` columns programmatically (returns PATTERN_NOT_MATCHED error). The application code enforces referential integrity.

> **Note on soft-delete:** All COS_* tables use the same soft-delete pattern — the `notes` column is prefixed with `DELETED:<ISO timestamp>\n` when a record is logically deleted. Normal GET lists hide deleted rows and descendants of deleted parents. `?deleted=true` returns recoverable records and explains blocked restores. New parent deletion is logical; independently deleted children stay deleted after parent restoration.

---

## Backend Function

| Field | Value |
|---|---|
| Function Name | `capitalos-api` |
| Function ID | `40997000000261004` |
| Type | Advanced I/O (applogic) |
| Stack | Node.js 24 (repository target; verify hosted stack after deployment) |
| SDK | `zcatalyst-sdk-node` |
| Base URL | `https://capitalos-60070830470.development.catalystserverless.in/server/capitalos-api/` |

### API Endpoints

```
GET    /server/capitalos-api/partners
POST   /server/capitalos-api/partners
PATCH  /server/capitalos-api/partners/:id
DELETE /server/capitalos-api/partners/:id        — soft-delete parent; descendants hidden logically

GET    /server/capitalos-api/allocations
POST   /server/capitalos-api/allocations
PATCH  /server/capitalos-api/allocations/:id
DELETE /server/capitalos-api/allocations/:id
POST   /server/capitalos-api/allocations/:id/restore

GET    /server/capitalos-api/capital-returns
POST   /server/capitalos-api/capital-returns
PATCH  /server/capitalos-api/capital-returns/:id
DELETE /server/capitalos-api/capital-returns/:id
POST   /server/capitalos-api/capital-returns/:id/restore

GET    /server/capitalos-api/profit-records
POST   /server/capitalos-api/profit-records
PATCH  /server/capitalos-api/profit-records/:id
DELETE /server/capitalos-api/profit-records/:id
POST   /server/capitalos-api/profit-records/:id/restore

GET    /server/capitalos-api/credit-cards
POST   /server/capitalos-api/credit-cards
PATCH  /server/capitalos-api/credit-cards/:id
DELETE /server/capitalos-api/credit-cards/:id

GET    /server/capitalos-api/list-tables          — diagnostic: lists all Datastore tables + IDs
```

---

## Testing Policy — Required Before Every Deploy

> **No deployment without a green test suite.**
> See [TESTING.md](./TESTING.md) for the full policy.

### The Rule

```
Feature added   → Write tests for it
Feature changed → Update tests to match the new behaviour
Feature deleted → Delete the tests that covered it
Bug fixed       → Add a regression test so it never returns

Deploy only if: npm test → ALL PASS (use the current full-suite result)
```

### What local validation does not establish

The suite now includes UI/store tests and real API handlers with a fake datastore. It does not connect to live Catalyst or prove that its schema, permissions and runtime are correct. Perform the staged smoke checks above.

Do not convert required-data loading failures into empty arrays: that hides failure as “no records.” The shared S6 loader preserves the last complete snapshot, exposes error/retry/freshness state and refreshes on focus/reconnect plus every minute while visible. Smoke-test a failed initial load and a failed refresh before release.

### Pre-Deploy Validation Gate

Run this command before **every** deploy. It must exit with code 0:

```bash
npm run validate
```

This runs in order:
1. `npm run schema:check` — Catalyst schema template is in sync
2. `npm run backend:check` — Backend source syntax is valid
3. `npm run typecheck` — TypeScript clean across all workspaces
4. `npm test` — All tests pass
5. `npm run client:build` — Production build succeeds

**If any step fails → abort the deploy. Fix the issue and re-run.**

---

## Deploy Commands

Run these commands only after completing the [mandatory backup gate](#mandatory-backup-gate) and the validation gate above.

### Prerequisites
```bash
# Install Catalyst CLI (one-time)
npm install -g --allow-scripts=zcatalyst-cli zcatalyst-cli

# Login (opens browser)
catalyst login --dc in
```

### Deploy Everything
```bash
# 1. Complete schema checks above, then validate and build
npm run validate

# 2. Deploy function (backend)
catalyst deploy --only functions --dc in --org 60070830470 -ni

# 3. Deploy client (frontend)
catalyst deploy --only client --dc in --org 60070830470 -ni
```

### Deploy Function Only
```bash
catalyst deploy --only functions --dc in --org 60070830470 -ni
```

### Deploy Client Only
```bash
npm run client:build
catalyst deploy --only client --dc in --org 60070830470 -ni
```

### List Projects
```bash
catalyst project:list --dc in
```

---

## Project Structure

```
CapitalOS/
├── catalyst.json              # Catalyst CLI config (client + functions)
├── client/                    # React + Vite frontend
│   ├── index.html
│   ├── vite.config.ts         # base: "/app/" for Catalyst hosting
│   └── src/
│       ├── store.ts           # Cloud store — fetches from /server/capitalos-api/
│       ├── useStore.ts        # React hook wrapping the store
│       ├── App.tsx            # HashRouter (required for Catalyst SPA routing)
│       └── pages/
├── functions/
│   └── capitalos-api/
│       ├── index.js           # Advanced IO handler (req, res) — uses zcatalyst-sdk-node
│       ├── package.json       # { "zcatalyst-sdk-node": "latest" }
│       └── catalyst-config.json  # type: "applogic", stack: "node24"
├── infrastructure/
│   └── datastore/schema.ts    # Original schema definition (not used by live tables)
└── docs/                      # Stage documentation
```

---

## Important Notes

### SPA Routing
- Uses **HashRouter** (`#/partners`, `#/allocations`) — required because Catalyst returns 404 for non-existent URL paths
- Vite build uses `base: "/app/"` — files served at `/app/assets/...`
- No Catalyst auth SDK in `index.html` — causes "invalid URL pattern" errors on mobile

### Data Persistence
- All mutations go directly to Catalyst Datastore via the `capitalos-api` function
- `store.ts` calls `loadAll()` on every mount to re-fetch fresh data
- In-flight loads share a promise; successful recovery/import refreshes await existing work and then reload. Focus/reconnect and visible-only one-minute polling refresh already-open devices; updates are not instantaneous.

### Date Handling — Timezone Safety
- **Never use `new Date("YYYY-MM-DD").toISOString()`** for date-only strings. This creates UTC midnight which shifts to the previous day in IST (UTC+5:30).
- **Always parse ISO date strings as local midnight**: `const [y, m, d] = iso.split("-").map(Number); new Date(y, m-1, d)`
- **Always format dates back using local getters**: `date.getFullYear()`, `date.getMonth()+1`, `date.getDate()`
- This applies to `computeNextDueDate()` and any other date arithmetic function.

### Re-authenticating MCP Token
If MCP token expires (valid for 1 hour), refresh with:
```bash
REFRESH_TOKEN="<from ~/.sahaa/data/settings/sahaa_mcp_settings.json>"
CLIENT_ID="<from same file>"
TOKEN_ENDPOINT="https://mcp.zoho.in/baas/mcp/v1/oauth/<hash>/<id>/token"

curl -X POST "${TOKEN_ENDPOINT}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}&client_id=${CLIENT_ID}"
```
Full token config is in `~/.sahaa/data/settings/sahaa_mcp_settings.json`.
The correct API base for Catalyst India DC is: `https://api.catalyst.zoho.in` (not `catalyst.zoho.in` or `catalyst.zoho.com`).

---

## Creating New Datastore Tables (Programmatic)

When a new feature requires a new Catalyst Datastore table, it **cannot** be created by `catalyst deploy` — you must create it manually via the REST API.

### Step-by-step using the MCP OAuth token

```bash
# 1. Refresh the MCP OAuth token (token expires in 1 hour)
ACCESS_TOKEN=$(curl -s -X POST "https://mcp.zoho.in/baas/mcp/v1/oauth/<hash>/<id>/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=<refresh_token>&client_id=<client_id>" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

PROJECT_ID="40997000000254001"
BASE="https://api.catalyst.zoho.in/baas/v1/project/${PROJECT_ID}"

# 2. Create the table
TABLE_RESP=$(curl -sL -X POST "${BASE}/table" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"table_name":"YOUR_TABLE_NAME"}')
TABLE_ID=$(echo "$TABLE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['table_id'])")
echo "Created table ID: $TABLE_ID"

# 3. Add columns (MUST use array format — single object format fails with JSON_PARSE_ERROR)
curl -sL -X POST "${BASE}/table/${TABLE_ID}/column" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '[
    {"column_name":"col1","data_type":"varchar","max_length":255},
    {"column_name":"col2","data_type":"bigint"},
    {"column_name":"col3","data_type":"date"},
    {"column_name":"col4","data_type":"text"}
  ]'
```

### Important column API gotchas

| Issue | Detail |
|---|---|
| Single object vs array | Column creation **requires array format** `[{...}]`, not `{...}` — single object returns `JSON_PARSE_ERROR` |
| Foreign key columns | Catalyst API **cannot create `foreign key` data type columns** programmatically — use `varchar(50)` instead and enforce references in application code |
| `partner_id` pattern | All `_id` columns in every COS_* table are stored as `varchar(50)`, not Catalyst FK type |
| Verify table list | Use `GET /server/capitalos-api/list-tables` to see all table names + IDs in the live project |

### After creating the table

1. Update `DEPLOYMENT.md` (this file) with the new table's ID and column schema
2. Update `infrastructure/datastore/schema.ts` with the new table definition  
3. Run `npm run schema:generate` to regenerate `project-template-1.0.0.json`
4. Update `tests/schema-contract.test.ts` to include the new table name in `EXPECTED_TABLES`
5. Deploy: `npx catalyst deploy`

---

## Local Dev

```bash
# Start dev server
npm run client:dev

# Type check
npm run client:typecheck

# Run tests
npm test

# Full validate + build
npm run validate
```
