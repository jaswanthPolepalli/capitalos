# CapitalOS — Deployment & Project Reference

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

Five dedicated **COS_** tables power the frontend store:

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

> **Note on soft-delete:** All COS_* tables use the same soft-delete pattern — the `notes` column is prefixed with `DELETED:<ISO timestamp>\n` when a record is logically deleted. The API filters these rows out on every GET.

---

## Backend Function

| Field | Value |
|---|---|
| Function Name | `capitalos-api` |
| Function ID | `40997000000261004` |
| Type | Advanced I/O (applogic) |
| Stack | Node.js 18 |
| SDK | `zcatalyst-sdk-node` |
| Base URL | `https://capitalos-60070830470.development.catalystserverless.in/server/capitalos-api/` |

### API Endpoints

```
GET    /server/capitalos-api/partners
POST   /server/capitalos-api/partners
PATCH  /server/capitalos-api/partners/:id
DELETE /server/capitalos-api/partners/:id        — soft-delete + cascade

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

Deploy only if: npm test → ALL PASS (currently 553 tests)
```

### ⚠️ What Tests DO NOT Cover — Known Gap

The existing test suite tests **pure business logic** (calculations, validation schemas, formatting) but does **not** test:

1. **New Catalyst Datastore tables existing** — Tests run locally and don't connect to the live Catalyst API. If a new table (e.g. `COS_CreditCards`) is added to the codebase but **not yet created in Catalyst console/API**, tests will pass but the live app will crash.

2. **`Promise.all` failure cascade** — If any one API endpoint in `store.ts` `loadAll()` returns a 500, the entire load fails and the app shows empty data everywhere. Always wrap new table fetches with `.catch(() => [])`:
   ```ts
   apiGet<CreditCard>("credit-cards").catch(() => [] as CreditCard[])
   ```

**Rule:** Whenever you add a new `apiGet()` call in `loadAll()`, always add `.catch(() => [])` to prevent a missing table from wiping the entire app display.

### Pre-Deploy Validation Gate

Run this command before **every** deploy. It must exit with code 0:

```bash
npm run validate
```

This runs in order:
1. `npm run schema:check` — Catalyst schema template is in sync
2. `npm run typecheck` — TypeScript clean across all workspaces
3. `npm test` — All 514+ tests pass
4. `npm run client:build` — Production build succeeds

**If any step fails → abort the deploy. Fix the issue and re-run.**

---

## Deploy Commands

### Prerequisites
```bash
# Install Catalyst CLI (one-time)
npm install -g --allow-scripts=zcatalyst-cli zcatalyst-cli

# Login (opens browser)
catalyst login --dc in
```

### Deploy Everything
```bash
# 1. Build client
npm run client:build

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
│       └── catalyst-config.json  # type: "applogic", stack: "node18"
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
- `_loading` flag prevents concurrent requests but not sequential reloads

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
