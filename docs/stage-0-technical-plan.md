# CapitalOS Stage 0 Technical Plan

## Repository and Tooling Snapshot

- The workspace contains only the product blueprint; there is no existing application, Catalyst configuration, or Git repository.
- Zoho Catalyst CLI `1.27.0` is installed and authenticated.
- No Catalyst project named `CapitalOS` exists in the selected organization. Existing projects are unrelated and will not be reused.
- Local Node.js is `26.5.0` and npm is `11.17.0`. Function runtime selection must use a Catalyst-supported Node.js version rather than assuming the local version is deployable.
- Catalyst CLI supports project/client/function initialization and Data Store row import/export. It does not expose a local command for creating Data Store table schemas, and `iac:pack` does not recognize a schema-only Data Store target.

## Architecture

CapitalOS will use a TypeScript monorepo with these ownership boundaries:

- `client/`: React web client, introduced in Stage 2.
- `functions/`: Catalyst Advanced I/O API functions, introduced with authenticated APIs.
- `shared/`: framework-independent domain types, Zod validation schemas, and deterministic financial rules.
- `infrastructure/datastore/`: versioned Catalyst Data Store schema manifests and an idempotent setup approach.
- `tests/`: business-rule, schema-contract, API, and isolation tests.

The transaction ledger remains the financial source of truth. Contributions and investments are domain records linked to their corresponding ledger entries; no outstanding balance columns will be treated as authoritative.

## Stage 1 Plan

1. Define every MVP Data Store table, column, relationship, unique key, and query index in a machine-readable manifest.
2. Add strict shared TypeScript domain models and enums.
3. Add Zod validation foundations for party ownership and agreement, contribution, investment, transaction, schedule, and portal-access invariants.
4. Add a deterministic schema validator and contract tests so unsupported or incomplete schema changes fail locally.
5. Document the Catalyst setup workflow and any constraints that Catalyst must enforce in backend code rather than through native database constraints.

Stage 1 will not add authentication, APIs, UI, calculations, dashboards, public portals, or document storage behavior.

## Later Stages

- Stage 2: Catalyst authentication, protected routing, responsive application shell, and theme system.
- Stage 3: Partner and CEO CRUD.
- Stage 4: Agreement CRUD and ownership validation.
- Stage 5: Contributions, investments, and supporting-document hooks.
- Stage 6: Authoritative transaction ledger and reversal foundation.
- Stage 7: Deterministic financial calculations and schedules.
- Stage 8: CFO dashboard.
- Stages 9-11: isolated CEO and Partner portals, then permanent token lifecycle management.
- Stage 12: reports, documents, audit history, accessibility, performance, responsive polish, and deployment validation.

## Assumptions

- INR is the only currency and monetary values are stored as integer paise to avoid floating-point errors.
- Catalyst-managed `ROWID`, `CREATEDTIME`, and `MODIFIEDTIME` metadata will be mapped at the repository boundary; explicit business timestamps remain in shared models where required.
- Posted financial records will later use status and reversal references rather than hard deletion.
- A new Catalyst project will be created or selected before applying the remote schema. This workspace will not be attached to an unrelated existing project.

## Catalyst Compatibility Concerns

- Data Store schema creation is console/IaC-driven rather than deployed by `catalyst deploy`; the manifest and setup guide must remain the reviewed source of truth.
- Catalyst Data Store constraint support must be verified per column type. Any unavailable check, composite unique, or conditional relationship constraint will be enforced atomically in backend services and covered by tests.
- Data Store decimal behavior must not be used for money unless exact precision is verified. Integer paise is the default representation.
- Runtime versions available to Catalyst Functions may lag the local Node.js runtime. Function packages will declare a supported runtime when initialized.
- Public table scopes must remain disabled. All private and public data access will pass through authenticated/scoped backend functions.

## Stage Exit Criteria

Stage 1 is complete only when the schema manifest validates, shared TypeScript compiles in strict mode, validation tests pass, all required unique keys/indexes are present, and Catalyst-specific limitations are documented. Work then stops pending the next instruction.