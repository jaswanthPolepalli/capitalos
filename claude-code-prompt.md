# CapitalOS — Claude Code Master Prompt

## Project Objective

Build **CapitalOS**, a small, production-ready financial operations web application for managing the movement of business capital between:

**Partners → CFO → CEOs / Businesses → CFO → Partners**

CapitalOS is an **internal CFO operating system with secure, read-only external Partner and CEO portals**.

The application must be designed and implemented for **Zoho Catalyst CLI** deployment.

This document is the authoritative product and engineering blueprint. Do not invent a different product, add unnecessary enterprise features, or replace the core financial model.

---

# 1. Product Vision

CapitalOS gives a CFO one trusted source of truth for:

- partner capital
- CEO/business capital deployment
- agreements
- principal repayments
- profit received
- profit distributed
- outstanding principal
- outstanding profit
- payment schedules
- supporting documents
- secure live external visibility

The product should make the CFO's most important questions answerable within seconds:

> How much capital do we have?
>
> How much has been deployed?
>
> Who owes principal?
>
> Who owes profit?
>
> What has been paid?
>
> What is due next?
>
> What is overdue?

Partners and CEOs receive permanent secure URLs that always display their latest live information.

---

# 2. Business Context

CapitalOS is not a general accounting system, ERP, CRM, banking application, or investment marketplace.

It is a focused capital-management application.

The CFO:

1. collects capital from Partners;
2. records Partner agreements and contributions;
3. deploys capital to CEOs/businesses;
4. records CEO agreements and investments;
5. records principal and profit received from CEOs;
6. records principal and profit paid to Partners;
7. monitors schedules and outstanding balances;
8. provides each Partner and CEO with secure read-only visibility.

Initial currency is **INR only**.

Use Indian formatting such as:

`₹10,00,000`

Do not introduce multi-currency complexity.

---

# 3. Users

## 3.1 CFO

The only authenticated administrative user.

The CFO can:

- create/edit Partners
- create/edit CEOs/businesses
- create/edit Agreements
- record Partner capital contributions
- record CEO investments
- record financial transactions
- manage profit schedules
- view outstanding balances
- view upcoming payments
- view overdue payments
- create/revoke/regenerate portal links
- upload supporting documents
- view reports
- review financial history

## 3.2 Partner

No account or login.

Receives a permanent secure URL.

Partner can see only their own authorized information.

## 3.3 CEO / Business

No account or login.

Receives a permanent secure URL.

CEO can see only their own authorized information.

There are no other roles in the MVP.

---

# 4. Signature Experience

## One-Glance Capital Position

CapitalOS should feel like a financial command center, not a spreadsheet.

The primary experience is:

**Capital In → Capital Deployed → Returns → Profit → Distributions → Outstanding → Next Payment**

The CFO dashboard should prioritize decisions and exceptions.

Public dashboards should provide the same clarity for one Partner or one CEO.

Use charts selectively. Do not turn the dashboard into a chart gallery.

---

# 5. Core User Journeys

## Journey A — CFO manages a complete capital cycle

1. CFO logs in.
2. CFO creates or selects a Partner.
3. CFO creates a Partner Agreement.
4. CFO records a capital contribution.
5. CFO creates/selects a CEO/business.
6. CFO creates a CEO Agreement.
7. CFO records capital provided to the CEO.
8. CEO returns principal and/or profit.
9. CFO records receipts.
10. CFO records principal/profit distributions to Partner.
11. CapitalOS recalculates balances from the ledger.
12. Dashboard and schedules update automatically.
13. Partner/CEO public portals immediately show current live data.

## Journey B — Partner or CEO checks financial position

1. User opens permanent token URL.
2. Backend resolves token.
3. Backend identifies the authorized Partner or CEO.
4. Backend returns only authorized records.
5. User sees current balances, history and schedules.
6. No login is required.
7. No static report is generated.
8. The same URL continues working as data changes.
9. Revoked tokens stop working immediately.

These journeys must become acceptance-test scenarios.

---

# 6. Competitive Positioning

CapitalOS should differentiate from:

- spreadsheets: better security, auditability, live portals and automated calculations;
- accounting software: focused on this specific capital lifecycle;
- investment-management systems: simpler and less enterprise-heavy;
- generic CRMs: designed around financial relationships rather than contacts.

Core differentiators:

1. Principal and profit are always separate.
2. Transactions are the financial source of truth.
3. Multiple agreements per Partner or CEO.
4. Permanent live public portals.
5. Secure token-based isolation.
6. CFO command-center dashboard.
7. Simple focused workflow.
8. INR-first financial presentation.

Do not expand the MVP into payroll, invoicing, general accounting, CRM, banking or ERP functionality.

---

# 7. Functional Requirements

## 7.1 CFO Authentication

Implement secure CFO authentication appropriate for Zoho Catalyst.

Do not build an unnecessary custom authentication system if Catalyst's supported authentication facilities provide a safer native approach.

Authentication must protect every private CFO route and API.

Unauthenticated users must not access private APIs.

Never place secrets in frontend code.

---

## 7.2 Partner Management

CFO can:

- list Partners
- search Partners
- filter by status
- create Partner
- edit Partner
- view Partner detail
- view financial summary
- view agreements
- view contributions
- view transactions
- view portal access

Partner fields:

- id
- partner_code
- name
- phone
- email
- address
- status
- notes
- created_at
- updated_at

---

## 7.3 CEO / Business Management

CFO can:

- list CEOs/businesses
- search
- filter by status
- create
- edit
- view detail
- view agreements
- view investments
- view transactions
- view outstanding balances
- view portal access

Fields:

- id
- ceo_code
- ceo_name
- business_name
- phone
- email
- address
- status
- notes
- created_at
- updated_at

---

# 8. Agreement Management

Each Partner and CEO can have multiple agreements.

An agreement belongs to either a Partner or a CEO.

Fields:

- id
- agreement_code
- party_type
- partner_id nullable
- ceo_id nullable
- agreement_type
- capital_amount
- start_date
- end_date
- profit_calculation_type
- profit_rate nullable
- fixed_profit_amount nullable
- profit_frequency
- principal_repayment_terms
- profit_payment_terms
- status
- notes
- document_id nullable
- created_at
- updated_at

Enums:

agreement_type:

- PARTNER
- CEO

profit_calculation_type:

- FIXED
- PERCENTAGE
- CUSTOM

profit_frequency:

- ONE_TIME
- MONTHLY
- QUARTERLY
- YEARLY
- CUSTOM

Rules:

- Partner agreement must reference exactly one Partner.
- CEO agreement must reference exactly one CEO.
- An agreement must never ambiguously reference both.
- Percentage profit requires a valid rate.
- Fixed profit requires a valid fixed amount.
- CUSTOM must be explicitly represented and never silently treated as another type.

Do not hard-code assumptions about custom profit calculation. Provide a structure that can support it without corrupting financial data.

---

# 9. Partner Capital Contributions

Fields:

- id
- contribution_code
- partner_id
- agreement_id
- contribution_date
- amount
- payment_method
- reference_number
- notes
- document_id nullable
- created_at
- updated_at

Rules:

- amount > 0
- valid Partner required
- valid Partner agreement required
- agreement must belong to that Partner

---

# 10. CEO Investments

Fields:

- id
- investment_code
- ceo_id
- agreement_id
- investment_date
- principal_amount
- purpose
- payment_method
- reference_number
- status
- notes
- document_id nullable
- created_at
- updated_at

Rules:

- principal_amount > 0
- valid CEO required
- valid CEO agreement required
- agreement must belong to that CEO

---

# 11. Central Transaction Ledger

The transaction ledger is the central financial source of truth.

Fields:

- id
- transaction_code
- transaction_date
- transaction_type
- partner_id nullable
- ceo_id nullable
- agreement_id nullable
- principal_amount
- profit_amount
- total_amount
- direction
- payment_method
- reference_number
- notes
- document_id nullable
- created_at
- updated_at

Transaction types:

- PARTNER_CAPITAL_RECEIVED
- CEO_CAPITAL_PROVIDED
- CEO_PRINCIPAL_RECEIVED
- CEO_PROFIT_RECEIVED
- PARTNER_PRINCIPAL_PAID
- PARTNER_PROFIT_PAID

direction:

- IN
- OUT

Important:

- Store principal and profit separately.
- Do not use negative numbers as the primary representation of direction.
- total_amount should equal principal_amount + profit_amount.
- Amounts must be non-negative.
- Validate transaction type against the associated party and direction.
- Prevent impossible relationships.

Examples:

PARTNER_CAPITAL_RECEIVED:
- Partner required
- principal_amount > 0
- profit_amount normally 0
- direction IN

CEO_CAPITAL_PROVIDED:
- CEO required
- principal_amount > 0
- profit_amount normally 0
- direction OUT

CEO_PRINCIPAL_RECEIVED:
- CEO required
- principal_amount > 0
- profit_amount 0
- direction IN

CEO_PROFIT_RECEIVED:
- CEO required
- principal_amount 0
- profit_amount > 0
- direction IN

PARTNER_PRINCIPAL_PAID:
- Partner required
- principal_amount > 0
- profit_amount 0
- direction OUT

PARTNER_PROFIT_PAID:
- Partner required
- principal_amount 0
- profit_amount > 0
- direction OUT

Implement validation centrally in backend functions.

---

# 12. Profit Schedules

Fields:

- id
- agreement_id
- partner_id nullable
- ceo_id nullable
- due_date
- expected_principal
- expected_profit
- paid_principal
- paid_profit
- principal_pending
- profit_pending
- status
- created_at
- updated_at

Statuses:

- UPCOMING
- DUE
- PARTIALLY_PAID
- PAID
- OVERDUE

Schedules should be derived/generated from applicable agreement terms and financial activity.

Do not make manually entered balances the source of truth.

Where a schedule requires manual CFO confirmation, preserve the distinction between expected obligation and actual transaction payment.

---

# 13. Financial Calculation Rules

Never treat a manually stored outstanding balance as authoritative.

The transaction ledger is authoritative.

## CEO

Total capital provided:

SUM of CEO_CAPITAL_PROVIDED principal.

Principal returned:

SUM of CEO_PRINCIPAL_RECEIVED principal.

Principal outstanding:

total capital provided - principal returned.

Profit received:

SUM of CEO_PROFIT_RECEIVED profit.

Profit expected:

derived from applicable agreement and schedules.

Profit outstanding:

profit expected - profit received.

## Partner

Total capital contributed:

SUM of Partner capital contributions.

Principal returned:

SUM of PARTNER_PRINCIPAL_PAID principal.

Principal outstanding:

total capital contributed - principal returned.

Profit earned:

derived from applicable Partner agreement and schedules.

Profit paid:

SUM of PARTNER_PROFIT_PAID profit.

Profit pending:

profit earned - profit paid.

Prevent negative outstanding balances unless the system explicitly identifies and handles an overpayment.

Do not silently clamp incorrect accounting data to zero. Detect and surface invalid states for CFO review.

---

# 14. CFO Dashboard

The dashboard is a decision-support screen.

Top KPIs:

- Total Partner Capital
- Total Capital Deployed
- Principal Received from CEOs
- Principal Returned to Partners
- Profit Received from CEOs
- Profit Paid to Partners
- Principal Outstanding
- Profit Outstanding
- CFO Net Profit where determinable

Main sections:

## CEO Outstanding

Columns:

- CEO / Business
- Capital Provided
- Principal Returned
- Principal Outstanding
- Profit Received
- Profit Pending
- Total Outstanding
- Next Payment
- Status

## Partner Outstanding

Columns:

- Partner
- Capital Contributed
- Principal Returned
- Principal Outstanding
- Profit Earned
- Profit Paid
- Profit Pending
- Total Pending
- Next Payment
- Status

## Payment Attention

Show:

- upcoming payments
- due payments
- overdue payments
- partially paid schedules

## Recent Transactions

Show latest transactions with:

- date
- code
- party
- type
- principal
- profit
- total
- direction

Dashboard must support drill-down into underlying records.

---

# 15. Partner Public Portal

No login.

Permanent token URL.

Example:

`/p/<unguessable-token>`

Display:

- Partner name
- financial summary
- total capital contributed
- principal returned
- principal outstanding
- total profit earned
- profit paid
- profit pending
- total amount pending
- contribution history
- principal repayment history
- profit history
- pending payment schedule
- relevant agreement information

Never show:

- other Partners
- unrelated CEOs
- internal CFO notes
- private internal documents
- internal administrative data

The public UI must be polished, trustworthy and easy to understand.

---

# 16. CEO Public Portal

No login.

Permanent token URL.

Display:

- CEO / Business name
- total capital received
- principal returned
- principal outstanding
- profit received
- profit outstanding
- total outstanding
- investment history
- payment history
- outstanding payment schedule
- relevant agreement information

Never show:

- Partner information
- other CEOs
- internal CFO notes
- internal documents
- unrelated transactions

---

# 17. Public Portal Security

This is a critical requirement.

Public data must NEVER be fetched broadly and filtered in the browser.

The backend must resolve:

`raw token → token hash → authorized Partner/CEO → authorized records only`

Never trust:

- client-supplied partner_id
- client-supplied ceo_id
- query parameters claiming identity
- predictable database IDs

Use long cryptographically random tokens.

Store a secure hash of the token where practical.

The raw token may be returned/displayed only when necessary to create/copy the portal URL.

Portal access fields:

- id
- access_code
- access_type
- partner_id nullable
- ceo_id nullable
- token_hash
- active
- created_at
- revoked_at nullable
- last_access_at nullable

Controls:

- Generate link
- Copy link
- Revoke link
- Regenerate link
- View status

Revoked links must stop working immediately.

Regenerated tokens invalidate the old token.

A Partner token can never access another Partner.

A CEO token can never access another CEO.

A Partner token can never access CEO data.

A CEO token can never access Partner data.

Add reasonable abuse protection/rate limiting if supported by the chosen Catalyst architecture.

Do not expose raw token values in logs.

---

# 18. Documents

Support optional document attachments for:

- agreements
- payment proofs
- receipts
- other supporting documents

Documents must not become public merely because a Partner/CEO dashboard is public.

Every document request must perform authorization.

Use Catalyst-supported storage appropriate to the platform.

Do not expose storage credentials.

Store metadata separately where appropriate:

- id
- file name
- file type
- storage reference
- associated record
- uploaded_at
- uploaded_by

---

# 19. Auditability

Financial records must be traceable.

Where practical:

- created_at
- updated_at
- created_by
- updated_by

Do not hard-delete posted financial transactions.

Prefer:

- reversal
- correction
- void/reversal status

The original financial event should remain traceable.

Do not rewrite historical transactions silently.

---

# 20. API Design

Use clean REST APIs implemented with Zoho Catalyst Functions.

Private examples:

- `POST /api/auth/login`
- `GET /api/partners`
- `POST /api/partners`
- `GET /api/partners/:id`
- `PUT /api/partners/:id`
- `GET /api/ceos`
- `POST /api/ceos`
- `GET /api/ceos/:id`
- `PUT /api/ceos/:id`
- `GET /api/agreements`
- `POST /api/agreements`
- `GET /api/agreements/:id`
- `PUT /api/agreements/:id`
- `GET /api/contributions`
- `POST /api/contributions`
- `GET /api/investments`
- `POST /api/investments`
- `GET /api/transactions`
- `POST /api/transactions`
- `GET /api/profit-schedules`
- `POST /api/profit-schedules`
- `GET /api/dashboard/cfo`
- `GET /api/portal-links`
- `POST /api/portal-links`
- `POST /api/portal-links/:id/revoke`
- `POST /api/portal-links/:id/regenerate`
- `GET /api/documents`
- `POST /api/documents`
- `GET /api/reports/...`

Public examples:

- `GET /api/public/:token/dashboard`
- `GET /api/public/:token/transactions`
- `GET /api/public/:token/schedules`
- `GET /api/public/:token/agreements`

Adjust exact route structure to Catalyst conventions if required, while preserving the security model and separation between private and public APIs.

---

# 21. Validation

Implement backend validation for:

- amount > 0 where required
- valid dates
- valid enum values
- Partner agreement ownership
- CEO agreement ownership
- valid transaction type
- valid party relationship
- total_amount consistency
- valid schedule relationship
- duplicate codes
- impossible transaction combinations
- unauthorized public access

Use TypeScript validation schemas where appropriate.

Do not rely only on frontend validation.

---

# 22. Navigation

## Private CFO Navigation

- Dashboard
- Partners
- CEOs / Businesses
- Agreements
- Capital Contributions
- CEO Investments
- Transactions
- Profit Schedule
- Portal Links
- Documents
- Reports
- Settings

Use a responsive sidebar on desktop/tablet and an appropriate mobile navigation pattern.

## Public Portal Navigation

Keep it minimal:

- Overview
- Financial History
- Payment Schedule
- Agreements

If the content can fit elegantly on one public page, prefer a focused single-page experience with anchored sections rather than unnecessary navigation.

---

# 23. Screen Specifications

## Dashboard

Purpose:
Answer the CFO's key financial questions.

Must include:

- KPI cards
- outstanding tables
- payment attention
- recent transactions
- selective trend visualization
- loading/empty/error states

## Partners

Purpose:
Find and manage Partners.

Features:

- search
- status filter
- sortable table
- add Partner
- edit Partner
- quick financial summary

## Partner Detail

Purpose:
Single source of truth for one Partner.

Show:

- profile
- financial position
- agreements
- contributions
- repayments
- profit
- transactions
- portal link
- documents

## CEOs / Businesses

Purpose:
Manage businesses receiving capital.

## CEO Detail

Show:

- business information
- capital position
- investments
- repayments
- profit
- schedules
- transactions
- portal link
- documents

## Agreements

Purpose:
Manage financial terms.

Use clear forms with contextual fields based on agreement type and profit calculation type.

## Capital Contributions

Purpose:
Record Partner capital entering the system.

Use a focused transaction-entry workflow.

## CEO Investments

Purpose:
Record capital deployed to a CEO/business.

## Transactions

Purpose:
Provide an authoritative searchable ledger.

Filters:

- Partner
- CEO
- Agreement
- date range
- status
- transaction type
- direction

## Profit Schedule

Purpose:
Show expected versus paid obligations.

Highlight:

- upcoming
- due
- partial
- paid
- overdue

## Portal Links

Purpose:
Securely manage Partner/CEO public access.

Actions:

- generate
- copy
- revoke
- regenerate
- view status

Never display complete raw tokens unnecessarily after creation.

## Documents

Purpose:
Find supporting financial documents.

## Reports

Purpose:
Provide useful financial summaries without becoming an accounting suite.

Include:

- capital summary
- Partner statement
- CEO statement
- transaction report
- outstanding report
- profit report
- overdue report

---

# 24. UI / UX Design Philosophy

The interface must feel like a premium modern financial product.

Reference qualities:

- Apple
- Airbnb
- Linear
- Arc Browser

Do not copy their branding.

Avoid:

- Bootstrap-like layouts
- generic admin dashboards
- dense spreadsheet-only interfaces
- excessive borders
- poor typography
- emoji icons
- placeholder copy
- Lorem Ipsum
- decorative charts with no decision value

Use:

- generous whitespace
- strong hierarchy
- excellent typography
- premium cards
- subtle borders
- rounded corners
- clear status indicators
- elegant tables
- responsive layouts
- thoughtful empty states
- fast interactions

Use Phosphor Icons or another approved icon library rather than emoji.

---

# 25. Visual Language

Create a coherent design system.

Define:

- typography scale
- spacing scale
- radius scale
- elevation/shadow rules
- surface hierarchy
- status styles
- button variants
- form styles
- table styles
- modal/drawer styles
- responsive breakpoints

Support:

- Light Mode
- Dark Mode

Financial numbers should have strong visual hierarchy.

Use appropriate visual distinction for:

- positive/incoming
- outgoing
- pending
- overdue
- paid
- active
- closed

Do not rely on color alone for meaning.

---

# 26. Responsive Strategy

Mobile-first.

Support:

- mobile
- tablet
- desktop

Tables should transform intelligently on smaller screens:

- horizontal scrolling where appropriate
- stacked information cards
- priority columns first
- compact filters
- bottom-sheet/drawer patterns where useful

Do not merely shrink desktop layouts.

Preserve the user's intent and important information at every viewport.

---

# 27. Motion System

Use tasteful Framer Motion animations.

Include:

- page transitions
- spring-based modal/drawer transitions
- subtle card entrance
- table/filter transitions
- number/value transitions where appropriate
- shared visual transitions where useful
- micro-interactions for buttons and controls

Do not over-animate financial workflows.

Respect `prefers-reduced-motion`.

---

# 28. Component Library

Create reusable components such as:

- AppShell
- Sidebar
- MobileNavigation
- PageHeader
- Breadcrumbs
- KPI Card
- FinancialMetric
- StatusBadge
- DataTable
- MobileDataCard
- SearchInput
- FilterBar
- DateRangeFilter
- EmptyState
- LoadingState
- ErrorState
- ConfirmDialog
- FormField
- CurrencyInput
- DateInput
- MoneyDisplay
- TransactionTypeBadge
- PaymentScheduleRow
- FinancialSummary
- Timeline
- DocumentCard
- PortalLinkCard
- PortalAccessStatus
- ChartCard
- SectionHeader
- Drawer
- Modal
- Toast/Notification

Keep components composable and type-safe.

---

# 29. Mock APIs and Mock Data

During frontend development, use realistic mock APIs.

Mock data must include:

- multiple Partners
- multiple CEOs
- multiple agreements
- multiple contributions
- multiple investments
- multiple transactions
- partial repayments
- overdue schedules
- upcoming schedules
- paid schedules
- realistic Indian names
- realistic business names
- realistic INR amounts
- realistic dates
- realistic payment methods
- realistic reference numbers
- realistic document names

Never use:

- Lorem Ipsum
- "John Doe"
- fake-looking placeholder labels
- empty dashboards with no meaningful state

Mock data must exercise edge cases.

The frontend architecture must allow mock APIs to be replaced by Catalyst APIs without rewriting UI components.

---

# 30. State Management

Use appropriate separation:

- TanStack Query for server state
- Zustand only for lightweight client/application state
- React Hook Form for forms
- Zod for validation schemas

Do not duplicate server state unnecessarily in Zustand.

Invalidate/refetch relevant queries after mutations.

Make optimistic updates only where safe.

Financial mutations should favor correctness over optimistic visual behavior.

---

# 31. Technology Stack

Preferred:

- React
- TypeScript
- responsive CSS/Tailwind where compatible with the Catalyst setup
- shadcn/ui where compatible
- Framer Motion
- Phosphor Icons
- Zustand
- TanStack Query
- React Hook Form
- Zod
- Zoho Catalyst Functions
- Zoho Catalyst Data Store
- Catalyst-supported storage for documents
- Catalyst Web Client
- Catalyst CLI

Before installing packages or using framework features, inspect the existing project and Catalyst-supported runtime.

Do not introduce technologies simply because they are fashionable.

Use the minimum dependency set that produces a robust application.

---

# 32. Catalyst Architecture

Design the repository so it is naturally compatible with Zoho Catalyst CLI.

Separate:

- frontend/web client
- Catalyst functions
- shared types/schemas
- configuration
- tests

The application must be deployable using Catalyst CLI.

Before implementation:

1. inspect the existing repository;
2. identify the installed Catalyst CLI/runtime conventions;
3. preserve compatible configuration;
4. use supported Catalyst project structure;
5. avoid unsupported server/runtime assumptions.

If a framework choice conflicts with Catalyst Web Client capabilities, adapt the implementation while preserving the product requirements.

Use environment/configuration variables for:

- API base URLs where needed
- environment-specific settings
- non-public configuration

Never commit secrets.

---

# 33. Suggested Folder Structure

Adapt to actual Catalyst CLI requirements, but target a structure conceptually similar to:

```text
capitalos/
├── client/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── layout/
│   │   │   ├── finance/
│   │   │   ├── partners/
│   │   │   ├── ceos/
│   │   │   ├── agreements/
│   │   │   ├── transactions/
│   │   │   └── portals/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── stores/
│   │   ├── types/
│   │   └── mocks/
│   └── ...
├── functions/
│   ├── auth/
│   ├── partners/
│   ├── ceos/
│   ├── agreements/
│   ├── contributions/
│   ├── investments/
│   ├── transactions/
│   ├── schedules/
│   ├── dashboards/
│   ├── portals/
│   ├── documents/
│   └── reports/
├── shared/
│   ├── types/
│   ├── schemas/
│   └── financial/
├── tests/
└── catalyst configuration
```

Do not blindly create this exact structure if Catalyst requires a different structure. Preserve the architectural separation.

---

# 34. Backend Financial Service Layer

Centralize financial calculations.

Create pure, testable functions for:

- calculatePartnerPosition
- calculateCEOPosition
- calculateProfit
- calculateOutstandingPrincipal
- calculateOutstandingProfit
- calculateTotalPending
- calculateScheduleStatus
- validateTransaction
- validateAgreement

These functions must not depend on browser state.

Where practical, keep calculation logic deterministic and independently unit-testable.

---

# 35. API Security

For every private API:

- validate authentication
- validate input
- authorize requested record
- return safe error
- log appropriate server-side diagnostic information

For every public API:

- resolve token server-side
- verify token active status
- identify owner server-side
- scope every query to that owner
- never accept owner identity from the browser
- update last_access_at where appropriate
- do not expose internal fields

Never return database internals unnecessarily.

Never expose stack traces.

---

# 36. Error Handling

Create polished user-facing states for:

- invalid credentials
- unauthorized
- forbidden
- invalid token
- revoked token
- missing record
- validation failure
- duplicate record
- financial inconsistency
- upload failure
- API failure
- unexpected server error

Public invalid/revoked token pages should reveal as little information as practical.

Use clear messages, not technical jargon.

---

# 37. Accessibility

Target strong WCAG-aligned accessibility.

Include:

- keyboard navigation
- visible focus
- semantic HTML
- labels for form controls
- accessible dialogs
- accessible tables
- sufficient contrast
- non-color status indicators
- screen-reader-friendly descriptions
- reduced-motion support

Do not sacrifice accessibility for visual effects.

---

# 38. Performance

Optimize for fast initial loading.

Use:

- route-level/code splitting where appropriate
- lazy loading for non-critical content
- efficient queries
- pagination for large tables
- server-side filtering where appropriate
- minimal client state
- optimized document handling

Do not load the entire transaction history when only a summary is required.

Public portals must fetch only their authorized data.

---

# 39. Testing Strategy

Testing must begin with business rules.

At minimum cover:

### Scenario 1

Partner contributes:

`₹10,00,000`

CEO receives:

`₹10,00,000`

CEO returns principal:

`₹2,00,000`

CEO pays profit:

`₹50,000`

Partner receives principal:

`₹1,00,000`

Partner receives profit:

`₹30,000`

Verify calculations across CFO, Partner and CEO views.

### Additional tests

- multiple Partners
- multiple CEOs
- multiple agreements
- multiple contributions
- recurring profit
- one-time profit
- partial repayment
- overdue schedule
- fully paid schedule
- invalid transaction relationships
- overpayment detection
- token isolation
- revoked token
- regenerated token
- Partner A cannot access Partner B
- Partner cannot access CEO data
- CEO cannot access Partner data
- CEO A cannot access CEO B
- public endpoint cannot be manipulated using IDs

Security isolation tests are mandatory.

---

# 40. Acceptance Criteria

CapitalOS is acceptable only when:

## Product

- CFO can manage the complete capital lifecycle.
- Partner and CEO relationships are modeled independently.
- Multiple agreements are supported.
- Principal and profit remain separate.

## Financial integrity

- Ledger is source of truth.
- Balances are calculated correctly.
- Transaction direction is explicit.
- Invalid financial relationships are rejected.
- Posted transactions are not silently deleted.

## Public portals

- permanent URLs work
- URLs survive data changes
- token identifies the owner server-side
- only authorized data is returned
- tokens are unguessable
- tokens can be revoked
- regenerated tokens invalidate old access
- predictable IDs cannot be used to access data

## UX

- mobile-first
- desktop/tablet support
- light/dark mode
- professional financial UI
- responsive tables
- loading states
- empty states
- error states
- accessibility
- realistic content
- no placeholder UI

## Deployment

- project works with Catalyst CLI
- frontend is deployable as a Catalyst Web Client
- backend functions are deployable through Catalyst
- configuration is environment-safe
- no secrets are committed

---

# 41. Development Workflow — MANDATORY

Do NOT attempt to build everything in one step.

Work incrementally.

## Stage 0 — Technical Plan

First:

- inspect repository
- inspect existing Catalyst configuration
- inspect installed versions
- inspect available project structure
- produce concise technical implementation plan
- identify assumptions
- identify Catalyst compatibility concerns

Do not implement product functionality yet.

## Stage 1 — Database Schema and Relationships

Implement only:

- Data Store schema
- relationships
- indexes
- validation foundations
- shared data types
- migration/setup approach

Then validate.

Report:

- tables created
- columns
- relationships
- indexes
- assumptions
- limitations


## Stage 2 — CFO Authentication and Admin Shell

Implement:

- authentication
- protected routing
- app shell
- navigation
- responsive shell
- theme system

Validate.


## Stage 3 — Partners and CEOs

Implement:

- Partner CRUD
- CEO CRUD
- list/detail pages
- search/filter
- validation

Validate.


## Stage 4 — Agreements

Implement:

- agreement CRUD
- agreement validation
- party ownership
- profit configuration

Validate.


## Stage 5 — Contributions and Investments

Implement:

- Partner contributions
- CEO investments
- validation
- supporting documents where appropriate

Validate.


## Stage 6 — Transaction Ledger

Implement:

- transaction creation
- ledger
- filtering
- sorting
- validation
- reversal/correction foundation

Validate.


## Stage 7 — Financial Calculations

Implement:

- principal calculations
- profit calculations
- outstanding calculations
- schedules
- status logic

Add comprehensive tests.

Validate.


## Stage 8 — CFO Dashboard

Implement:

- KPI command center
- outstanding tables
- payment attention
- recent transactions
- selective charts

Validate.


## Stage 9 — CEO Public Dashboard

Implement:

- secure token resolution
- read-only dashboard
- isolated APIs
- history
- schedules

Run security tests.


## Stage 10 — Partner Public Dashboard

Implement:

- secure token resolution
- read-only dashboard
- isolated APIs
- history
- schedules

Run security tests.


## Stage 11 — Permanent Secure Portal URLs

Implement:

- token generation
- secure hashing
- portal management
- copy link
- revoke
- regenerate
- immediate invalidation
- abuse protection where supported

Run isolation tests.


## Stage 12 — Reports, Documents, Audit History and UX

Implement:

- reports
- document management
- audit metadata
- printable statements
- final UX polish
- accessibility review
- performance review
- responsive review
- deployment validation

provide final validation report.

---

# 42. Stage Discipline

After every stage:

1. validate implementation;
2. run relevant tests;
3. inspect for regressions;
4. report exactly what changed;
5. list assumptions;
6. list limitations;
7. do not unnecessarily modify previous stages;
8. keep database design backward-compatible;
9. do not implement future stages automatically.

When a stage is complete, WAIT for the next instruction.

Do not interpret “continue” as permission to skip validation.

---

# 43. Coding Standards

Use:

- TypeScript strictness
- explicit types for domain models
- small reusable functions
- clear naming
- centralized validation
- domain-oriented modules
- consistent error handling
- consistent API response shapes
- no duplicated financial logic
- no magic financial constants
- no secrets in source code

Avoid:

- giant components
- giant API handlers
- duplicated queries
- duplicated calculation logic
- hidden side effects
- arbitrary global state
- unnecessary dependencies

---

# 44. Data Model Integrity Rules

Use foreign-key relationships or Catalyst-supported relational constraints where available.

Recommended indexes:

- partner_id
- ceo_id
- agreement_id
- transaction_date
- transaction_type
- due_date
- portal token hash
- active portal access
- status fields used frequently for filtering

Use unique constraints for:

- partner_code
- ceo_code
- agreement_code
- transaction_code
- contribution_code
- investment_code
- access_code where applicable

If Catalyst Data Store has platform-specific constraint limitations, enforce the equivalent safely in backend logic and document the limitation.

---

# 45. UX Details

Forms should:

- use clear labels
- show INR formatting
- prevent invalid amounts
- provide contextual validation
- confirm destructive/reversal actions
- preserve user input on recoverable errors

Tables should:

- support sorting
- support search
- support filters
- support pagination where needed
- show useful empty states
- allow drill-down

Financial values should always clearly distinguish:

- principal
- profit
- total

Do not combine them into one ambiguous amount.

---

# 46. Realistic Content

Use believable sample content such as:

Partners:
- Indian individual/business names
- realistic contact information
- realistic capital values

Businesses:
- realistic Indian business names
- realistic business purposes

Transactions:
- realistic dates
- realistic INR amounts
- UPI / NEFT / RTGS / bank transfer where appropriate
- believable reference numbers

Documents:
- agreement filenames
- payment proof filenames
- receipt filenames

Do not use real people's sensitive data.

---

# 47. Reports

Reports should answer practical questions:

- How much capital was contributed?
- How much was deployed?
- How much principal came back?
- How much principal was returned?
- How much profit came in?
- How much profit was distributed?
- What is outstanding?
- What is overdue?
- What is due next?

Support filtering by:

- Partner
- CEO
- Agreement
- date range
- transaction type
- status

If export/print is implemented, preserve the same financial semantics.

---

# 48. Public Portal UX

Public pages should feel trustworthy and polished.

Use a restrained financial presentation.

At the top:

- name
- "CapitalOS" identity
- current financial position

Use clear cards:

- Principal
- Profit
- Outstanding
- Next Payment

Make it obvious that the page is read-only.

Do not expose administrative controls.

Do not reveal token values in the visible UI.

---

# 49. Security Review Checklist

Before declaring the project complete, verify:

- no public endpoint trusts a Partner ID
- no public endpoint trusts a CEO ID
- no predictable ID is used as public identity
- token entropy is sufficient
- token hashes are protected
- revoked tokens fail immediately
- regenerated tokens invalidate old tokens
- Partner isolation works
- CEO isolation works
- cross-type isolation works
- private endpoints require authentication
- documents enforce authorization
- secrets are not client-exposed
- errors do not expose stack traces
- logs do not contain raw public tokens
- database queries are owner-scoped
- public responses contain only necessary fields

---

# 50. Financial Test Matrix

Build automated tests around:

| Case | Expected |
|---|---|
| Partner contribution | Partner capital increases |
| CEO capital provided | CEO principal outstanding increases |
| CEO principal received | CEO principal outstanding decreases |
| CEO profit received | CEO profit received increases |
| Partner principal paid | Partner principal outstanding decreases |
| Partner profit paid | Partner profit pending decreases |
| Partial repayment | Schedule becomes PARTIALLY_PAID |
| Full repayment | Schedule becomes PAID |
| Past unpaid due date | Schedule becomes OVERDUE |
| Future due date | Schedule becomes UPCOMING |
| Invalid Partner transaction | Rejected |
| Invalid CEO transaction | Rejected |
| Partner A token + Partner B data | Denied |
| Partner token + CEO data | Denied |
| CEO A token + CEO B data | Denied |
| Revoked token | Denied |
| Old regenerated token | Denied |

---

# 51. Important Product Constraints

Do not add:

- multi-currency
- multi-admin roles
- payroll
- invoicing
- accounting ledger beyond the defined capital ledger
- banking integration
- payment gateway
- marketplace
- public registration
- unnecessary CRM features

unless explicitly requested later.

Keep CapitalOS small, clean and maintainable.

---

# 52. AI Roadmap — Future Only

AI is not authoritative for financial calculations.

Potential future features:

- CFO financial assistant
- natural-language reporting
- agreement-term extraction
- financial summaries
- anomaly detection
- payment-risk insights
- automated explanations of outstanding balances

AI must never replace deterministic financial calculation logic.

---

# 53. Final Product Standard

CapitalOS should feel like software that a real CFO could confidently use every day.

It must be:

- simple
- fast
- accurate
- trustworthy
- secure
- responsive
- maintainable
- visually polished
- auditable

The experience should feel closer to a premium modern financial product than a generic admin dashboard.

Every screen must have one clear job.

Every important financial number must be traceable.

Every public user must see only their own authorized information.

Every balance must ultimately be explainable from underlying financial records.

---

# 54. Final Instruction to Claude Code

You are the Lead Engineer implementing CapitalOS.

Treat this document as the product and engineering source of truth.

Do not jump directly into implementing all functionality.

Start by inspecting the repository and Catalyst CLI project structure.

Then produce the Stage 0 technical plan.

After the plan, implement **Stage 1 only**.

At the end of Stage 1:

- validate the schema;
- validate relationships;
- validate indexes;
- run relevant tests;
- report exactly what was created;
- report assumptions and Catalyst-specific limitations;

Wait for the next instruction before proceeding to Stage 2.

Do not build the entire application in one response.

Do not invent business rules.

Do not weaken public-data isolation for convenience.

Do not replace ledger-driven calculations with manually stored balances.

Do not introduce unnecessary technologies.

When Catalyst platform constraints require an implementation adjustment, choose the smallest supported change that preserves the product's security, financial integrity and user experience, and document the decision.

The final deployed application must be Catalyst CLI compatible and ready for production deployment after all stages have been completed and validated.
