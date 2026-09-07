# CapitalOS Stage 1 Data Store

## Result

Stage 1 defines an importable Zoho Catalyst Data Store schema, shared domain types, and validation foundations. No Stage 2 or later functionality is included.

The authoritative schema is `infrastructure/datastore/schema.ts`. It deterministically generates `project-template-1.0.0.json`, which uses Catalyst's official IaC `Datastore` component format.

## Tables

### Partners

Stores Partner identity and status. `partner_code` is unique. Name, code, and status are search-indexed. Contact and free-text fields are marked for Catalyst audit consent.

### CEOs

Stores CEO and business identity. `ceo_code` is unique. CEO name, business name, code, and status are search-indexed.

### Documents

Stores file metadata and an internal Catalyst storage reference. `storage_reference` is unique. Files are not public resources; authorization is required before any later download implementation.

### Agreements

Stores Partner and CEO agreements with independent principal/profit terms. It supports FIXED, PERCENTAGE, and explicitly described CUSTOM profit rules, as well as custom payment frequency terms. `agreement_code` is unique.

Relationships:

- `partner_id` to `Partners.ROWID`
- `ceo_id` to `CEOs.ROWID`
- `document_id` to `Documents.ROWID`

Exactly one party relationship and all profit-mode rules are backend-enforced because Catalyst has no conditional check constraints.

### Transactions

Defines the authoritative capital ledger. Principal, profit, and total are separate `bigint` paise columns. `transaction_code` is unique.

Relationships:

- `partner_id` to `Partners.ROWID`
- `ceo_id` to `CEOs.ROWID`
- `agreement_id` to `Agreements.ROWID`
- `document_id` to `Documents.ROWID`

Transaction type, party, direction, amount composition, and total consistency are validated centrally in shared code and must be revalidated by every backend write path.

### PartnerContributions

Stores contribution metadata. `contribution_code` is unique and the amount is integer paise.

Relationships:

- `partner_id` to `Partners.ROWID`
- `agreement_id` to `Agreements.ROWID`
- `ledger_transaction_id` to `Transactions.ROWID`
- `document_id` to `Documents.ROWID`

`ledger_transaction_id` is nullable until the ledger workflow is introduced in Stage 6. Once posted, backend logic must enforce a unique one-to-one link to a matching `PARTNER_CAPITAL_RECEIVED` transaction.

### CEOInvestments

Stores capital-deployment metadata. `investment_code` is unique and principal is integer paise.

Relationships mirror Partner contributions and require a CEO-owned agreement plus a matching `CEO_CAPITAL_PROVIDED` ledger transaction once posted.

### ProfitSchedules

Stores expected and paid principal/profit separately. It never becomes an authoritative balance store: pending values must equal expected minus paid, and Stage 7 calculations will reconcile schedules against ledger activity.

Relationships:

- `agreement_id` to `Agreements.ROWID`
- `partner_id` to `Partners.ROWID`
- `ceo_id` to `CEOs.ROWID`

The `(agreement_id, due_date)` obligation-period key is application-enforced because Catalyst supports only single-column uniqueness.

### PortalAccess

Stores one owner relationship, a unique access code, and only a unique SHA-256 token hash. Raw portal tokens have no column and must never be persisted or logged.

Relationships:

- `partner_id` to `Partners.ROWID`
- `ceo_id` to `CEOs.ROWID`

Exactly one owner and at most one active token per owner are application-enforced.

### AuditEvents

Provides an append-only application audit foundation for later financial corrections and administrative changes. Public APIs must never expose snapshots or reasons.

### SchemaVersions

Tracks immutable schema version/checksum pairs for controlled future migrations.

## IDs and Timestamps

Catalyst automatically creates `ROWID`, `CREATORID`, `CREATEDTIME`, and `MODIFIEDTIME` on every table. Shared repositories will map these fields to `id`, `createdAt`, and `updatedAt`; duplicate timestamp columns are intentionally avoided.

## Money and Rates

- All INR values are stored as integer paise in Catalyst `bigint` columns.
- Shared validation converts accepted integer inputs to JavaScript `bigint`.
- Percentage rates are decimal strings with up to six decimal places, avoiding Catalyst `double` and JavaScript floating-point arithmetic.
- Formatting as Indian rupees is a presentation concern for later stages.

## Indexes

Native Catalyst uniqueness is enabled for all business codes, document storage references, token hashes, audit event codes, and schema versions/checksums.

Catalyst Search indexes are enabled on frequently searched or filtered fields, including:

- Partner/CEO names, codes, and statuses
- agreement party IDs, dates, types, and status
- contribution/investment party IDs, agreement IDs, dates, and status
- transaction date, type, party IDs, agreement ID, and direction
- schedule agreement/party IDs, due date, and status
- portal token hash, party IDs, and active state

Catalyst does not expose user-defined relational B-tree indexes through CLI/IaC. Search indexes and foreign-key metadata are the available physical indexing controls. ZCQL query plans must be measured with realistic data before production; any platform-managed index limitation is documented rather than represented as a nonexistent SQL index.

## Delete Behavior and Permissions

Every foreign key uses `ON-DELETE-SET-NULL`; no relationship can cascade-delete financial history. Required parent records must be protected from deletion in backend services because Catalyst does not offer an `ON DELETE RESTRICT` mode.

The IaC template grants App Administrator only `SELECT`, `INSERT`, and `UPDATE`. It creates no App User table scope or permission. Later clients must use authenticated backend functions, and public portal reads must be owner-scoped server-side.

## Validation Coverage

The Stage 1 tests cover:

- complete table inventory
- native unique constraints
- required Catalyst Search indexes
- all foreign-key targets and non-cascading delete rules
- bigint paise storage for every financial amount
- omission of raw portal tokens
- valid and invalid agreement ownership/profit modes
- every allowed transaction type/direction/amount combination
- total amount consistency
- schedule overpayment detection
- token hash and owner validation

Run:

```bash
npm run validate
```

## Catalyst Setup

No existing Catalyst project named `CapitalOS` was available, so this workspace is intentionally not bound to an unrelated project.

1. Validate and generate the template:

   ```bash
   npm run validate
   npm run schema:generate
   ```

2. Package the schema-only IaC template:

   ```bash
   npm run iac:pack -- capitalos-stage1.zip
   ```

3. Review the ZIP, then import it to create the dedicated project:

   ```bash
   catalyst --org <org-id> iac:import capitalos-stage1.zip --name CapitalOS
   ```

4. Complete Catalyst's browser confirmation, wait for the import job, and initialize this directory against the new project ID.

5. Export the project after import and compare its Data Store metadata with the typed manifest before starting Stage 2.

IaC import creates a new Catalyst project. Do not run the import against an existing unrelated project.

## Assumptions and Limitations

- General Partner, CEO, agreement, and investment status values are not enumerated in the product blueprint. Validation accepts uppercase status codes rather than inventing a lifecycle.
- Composite and conditional uniqueness is not native to Catalyst Data Store and must be enforced atomically in backend functions.
- Catalyst cannot represent cross-column arithmetic checks, enums, or exactly-one-party checks. The shared schemas establish these rules, and private/public APIs must call them server-side.
- Catalyst CLI `1.27.0` cannot package a project whose only IaC component is Data Store because its target filter recognizes only deployable code/hosting targets. `npm run iac:pack` creates the same template-root ZIP deterministically; Catalyst CLI remains responsible for `iac:import`.
- Required foreign keys use null-on-delete because Catalyst has no restrict mode. Backend services must reject parent deletion when references exist.
- `ledger_transaction_id` links prepare contributions and investments for the Stage 6 authoritative ledger without implementing that later-stage workflow now.
- Remote import was not performed because no dedicated CapitalOS cloud project exists yet. Local IaC packaging and contract validation are the Stage 1 deployment checks.