# CapitalOS product and release review

18 September 2026. Original audit, followed by your selections. **S3, S5, S6, S8, F1, F2 (partners and contributions), F4, F7 and Node 24 are now implemented locally. S4 remains an explanation/decision item.** See [implementation status and release requirements](approved-improvements-2026-09-18.md). The findings and line references below describe the pre-implementation snapshot.

The current app has useful daily workflows, but access control, balance correctness and failure recovery need attention before expanding its scope. The existing local validation is fast and green; it does not establish that the deployed backend handles these cases correctly.

This review inspected the current working tree, including existing uncommitted changes, active routes, store, backend, tests and deployment configuration. Synthetic, isolated checks exercised actual API/store code without accessing or changing the live datastore or sending notifications. Browser access was unavailable because computer-access permissions remained pending, so this is a source and behavior audit from an end user's perspective, **not completed visual/device acceptance testing**. Catalyst console authentication, backups, deployed versions, production permissions and monitoring were not inspected. Findings about those settings are therefore verification requirements, not claims about their actual state. No product code or deployment was changed by this review.

Existing functionality includes partners, cash/card contributions, combined capital, profit recording, returns, ledger, bulk recording, reports and charts, CSV exports, printable statements, notifications, search, WhatsApp confirmation sharing, a recovery screen and partner portals. Several recent mobile improvements are already implemented: bottom navigation, expandable record cards, visible actions, larger controls, wrapping reports and modal sizing. Do not add these again as new features. Agreements, business/CEO investments and other older page files are not active workspace routes. README and older roadmaps are stale.

**1. End-user shortcomings and their impact**

P0 means access or confidentiality needs immediate attention. P1 means balance accuracy or dependable task completion is affected. P2 means an important usability or workflow improvement. “Reproduced” refers to isolated execution using synthetic data, not an incident observed in production.

| ID | Priority / confidence | What a user can experience | Evidence and proposed package |
|---|---|---|---|
| U01 | P0; code confirmed, unauthenticated handler behavior reproduced | The CFO PIN controls browser UI, but the API itself does not verify identity/role. Read-only UI is not reliable write protection. Hosted gateway exposure still needs checking. | [RoleContext](../client/src/context/RoleContext.tsx), lines 55–79; [API](../functions/capitalos-api/index.js), handler at 325. **S1**. |
| U02 | P0; code confirmed | A partner portal downloads the shared workspace data before filtering it locally. Links are predictable and have no implemented expiry/revocation. The “Secure” label overstates this design; CEO-prefixed links resolve to aggregate content. | [Portal resolution](../client/src/pages/PublicPortalPage.tsx), 80–89 and 853–874; [store](../client/src/store.ts), 187–199; [link creation](../client/src/pages/PortalLinksPage.tsx), 19 and 81. **S1**. |
| U03 | P0; source confirmed | An email credential is embedded in backend source. Its current validity was not tested. A leaked copy could allow misuse of the sender account. The value is deliberately omitted here. | [API](../functions/capitalos-api/index.js), 35–42. Rotate/revoke and replace with managed secrets. **S1/C1**. |
| U04 | P1; reproduced | A ₹500 payment against ₹1,000 expected profit can show ₹0 pending instead of ₹500. Settlement depends on a “Partial payment” note marker; the bulk flow does not add it. Users should not have to mark a checkbox to keep a real balance outstanding. | [Store](../client/src/store.ts), 430–455; [bulk recording](../client/src/pages/BulkPaymentPage.tsx), 386–411. **S2**. |
| U05 | P1; reproduced | Recurring profit lacks a period ledger. A full February payment marked reinvested still produces ₹0 current pending in September and labels the expected amount “next month.” Editing notes can change financial meaning. Intended recurrence/proration rules must be agreed before repair. | [Store](../client/src/store.ts), 419–467. **S2**. |
| U06 | P1; source confirmed | After the first 200 datastore rows, balances and histories may omit records. Deleted rows also occupy the fetched page. This can affect validation and deletion cascades, not just screen pagination. | [API](../functions/capitalos-api/index.js), 172–176. **S3**. |
| U07 | P1; reproduced | Two simultaneous combinations of the same ₹1,000 and ₹2,000 contributions both succeed and create two ₹3,000 combined records. Concurrent returns use the same read-then-write pattern and can exceed the available principal. | [API](../functions/capitalos-api/index.js), 358–377 and 531–544. **S4**. |
| U08 | P1; reproduced | An edit can bypass financial validation. The actual handler accepted a negative capital return and an invalid date in the isolated check. Restoration also needs parent/balance validation. | [API](../functions/capitalos-api/index.js), 568–597 and 658 onward. **S2/S4**. |
| U09 | P1; code confirmed | A fast double tap can record profit twice. Reinvestment saves the payment and then separately changes the return date; failure in the second step can leave a partially completed operation. | [Profit modal](../client/src/components/RecordProfitModal.tsx), 86–131. **S4/S6**. |
| U10 | P1; code confirmed | Bulk recording always advances to “Payments posted!” even if every request fails. Failed items disappear into console logs, with no retry list. Its initial selection also does not synchronize when data arrives after a cold load. | [Bulk page](../client/src/pages/BulkPaymentPage.tsx), 318–326, 365–371 and 386–411. **S4/S6**. |
| U11 | P1; reproduced API contract mismatch | Deleted Records requests `?deleted=true`, but the backend discards the query and returns active entries. Real deleted entries are absent. Restore updates existing cached entries instead of reliably reinserting removed ones. | [Settings](../client/src/pages/SettingsPage.tsx), 60–63; [API](../functions/capitalos-api/index.js), 337 and list filters; [store](../client/src/store.ts), 773 onward. **S5**. |
| U12 | P1; code confirmed | Failed loading can appear as an empty workspace, empty cards or a portal spinner that never resolves. No usable retry/freshness state distinguishes “no data” from “could not load.” An already open second device need not refresh when the first device saves. | [Store](../client/src/store.ts), 182–244; [portal](../client/src/pages/PublicPortalPage.tsx), 853–871; [useStore](../client/src/useStore.ts), 14–21. **S6**. |
| U13 | P1; code confirmed | The ledger is rebuilt from mutable current records. Users cannot reliably establish who changed an amount, its previous value or why it changed. Allocation deletion can leave related payment/return rows; partner cascade deletion excludes cards and can fail halfway through. | [Store](../client/src/store.ts), 203–236 and 819 onward; [API](../functions/capitalos-api/index.js), 269–311 and 473 onward. **S5**. |
| U14 | P2; code confirmed | Reminders may overstate the amount due by attaching all partner principal to the earliest return date. Profit-overdue detection uses principal return dates. Dismissal is device-local, and fixed notification IDs can suppress a later occurrence. | [Notifications](../client/src/lib/notifications.ts), 36–69 and 82–140. **S7/F4**. |
| U15 | P1; reproduced | The actual payment form submitted ₹100.49 as ₹100 and ₹100.50 as ₹101. At a fixed 18 September 00:15 IST clock, it defaulted to 17 September. The separately tested BigInt engine is not the active store's money model. Users need explicit precision and business-date rules. | [Profit modal](../client/src/components/RecordProfitModal.tsx), 29 and 111; [store](../client/src/store.ts), 417; [bulk page](../client/src/pages/BulkPaymentPage.tsx), 344 and 392. **S2**. |
| U16 | P2; code confirmed | “Pay all pending profit obligations” describes a record-entry workflow: it does not transfer funds. Users may confuse recorded payments with confirmed bank payments. | [Bulk page](../client/src/pages/BulkPaymentPage.tsx), 394–401 and 421. Rename actions consistently and distinguish recorded, reconciled and notified. **S6/F3**. |
| U17 | P2; code confirmed | Statement printing exists, but the statement has no period selector or opening/closing running balance. Annual reports use Jan–Dec only. Payment references in some forms are flattened into notes, and no routed receipt upload/reconciliation workflow was found. | [Statement](../client/src/pages/PartnerStatementPage.tsx), 33–80; [reports](../client/src/pages/ReportsPage.tsx), 26–48; [bulk references](../client/src/pages/BulkPaymentPage.tsx), 394. **F1/F3**. |
| U18 | P2; code confirmed, delivery not exercised | The user cannot tell whether a financial record was saved but email delivery failed. Email is launched without durable completion tracking and contains a hard-coded development host. | [API](../functions/capitalos-api/index.js), 47, 77 and 462–468. **S7**. |
| U19 | P2; source-level UX limitation | Phone statements and portal tables retain a 560px minimum width and require horizontal scrolling. Existing mobile fixes deserve device verification; modal keyboard/focus handling varies by component. A manifest exists, but no service-worker/offline/freshness/native-share implementation was found. | [Mobile styles](../client/src/mobile.css), 83–128; [manifest](../client/public/manifest.json); [profit modal](../client/src/components/RecordProfitModal.tsx). **S8/F5**. |
| U20 | P2; code confirmed risk, spreadsheet execution not tested | CSV escaping handles separators/quotes but leaves formula-leading text intact. A name or note beginning with `=` can be treated as a formula by spreadsheet software rather than as literal data. | [CSV utility](../client/src/lib/csv.ts), 12–18. Add spreadsheet-safe text export and regression checks. **S8**. |

Visual checks still needed: narrow phone widths, landscape/tablet, iOS Safari and Android Chrome; virtual keyboard over payment dialogs; modal focus and screen-reader announcements; 200% zoom, long names and large INR values; portal scrolling; statement print pagination; cold loading and interrupted requests. Existing JSDOM/CSS tests cannot certify these behaviors. No visual defect beyond the source evidence above is claimed as reproduced.

**2. PM plan: selectable fixes, then useful additions**

Recommended product focus: a dependable partner-capital workspace that explains what is owed, records what happened and gives each partner a trustworthy statement. All essential financial operations and permission rules should be available on both web and mobile. Desktop can provide denser review tools while mobile prioritizes fast individual actions.

Select each package independently. Sizes are relative planning estimates, not delivery commitments: S = narrow change, M = several screens/API changes, L = data/security redesign with migration. Financial migrations require a reconciliation preview and explicit treatment of ambiguous legacy records.

| Package | Proposed work | Completion condition | Size / dependency |
|---|---|---|---|
| **S1 — Access and secrets** | Real owner sign-in, server permissions, scoped partner endpoint, opaque expiring/revocable links, credential rotation and managed secrets. | Anonymous writes fail; Partner A cannot retrieve Partner B's data; revoked links stop working; old mail credential is invalidated. | L; first priority. |
| **S2 — Correct money and periods** | Explicit obligations, cycle dates, payment allocation, partial settlement, recurrence, adjustments, precision/date policy and shared server validation for create/edit/restore. | ₹1,000 less ₹500 leaves ₹500; future cycles become due by the chosen rules; changing notes cannot change balances; dates and precision are consistent. | L; financial rules and legacy-data reconciliation first. |
| **S3 — Complete data retrieval** | Cursor pagination/scoped queries, complete balance calculations and matching live schema contract. | More than 200 rows, including deleted rows, produce complete records and correct totals. | M; can run beside S1/S2. |
| **S4 — Safe financial commands** | Durable duplicate-request keys, concurrency protection, recoverable multi-step changes, in-flight UI guards, per-item bulk outcomes and targeted retry. | Double tap, parallel requests and retry after lost response produce one valid operation; interrupted changes recover to an explainable state. | L; server data model and platform transaction/locking design. |
| **S5 — History and recovery** | Actual deleted-record filtering; coherent restore/reversal; append-only actor/before/after/reason history; consistent linked-record handling. | Delete → recover → reload restores valid balances; history explains every financial change; interrupted cascades can resume. | M–L; depends on S1/S2/S4. |
| **S6 — Honest state and task completion** | Loading/error/stale/offline/retry states, last refresh, cross-device refresh policy, preserved drafts, bulk cold-load fix, accurate record-payment wording. | Empty is distinguishable from unavailable; failure identifies affected items; a phone interruption does not silently lose a draft or cause repeat posting. | M; financial retry depends on S4. |
| **S7 — Trustworthy alerts** | Allocation/cycle-specific due amounts, recurring reminder IDs, synchronized dismissal/snooze, durable email jobs and delivery status, correct environment links. | A reminder states the actual obligation and period; a saved record and a delivered message have separate outcomes. | M; depends on S2/S3. |
| **S8 — Web/mobile acceptance and export safety** | Real browser/device checks, consistent modal focus/keyboard behavior, phone statement summaries, large-text checks and safe CSV export. | Core journeys work at supported widths with touch, keyboard and screen readers; exported free text remains text. | M; work alongside S6. |

Optional feature choices after selecting the fixes:

| ID | Feature and user value | Web behavior | Mobile behavior | Dependency / size |
|---|---|---|---|---|
| **F1** | Better statements: date range, opening/closing principal, period profit, running balance, reproducible as-of date and Apr–Mar financial-year preset. | Detailed report filters, printable/downloadable statement and consistent exports. | Readable summary and easy download/share. | S2/S3/S5; M. Enhances existing reports/PDF printing. |
| **F2** | Guided onboarding and CSV import with preview, field mapping, duplicate detection and rejected-row explanations. | Fast spreadsheet migration and bulk review. | Short partner → contribution → obligation-preview flow; review import outcomes. | S2/S3/S4; M–L. |
| **F3** | Payment proof and reconciliation: structured method, bank/account, UTR/reference, receipt attachment and statement matching. | Import bank CSV, review suggested matches, investigate unmatched items. | Capture/upload evidence and record one transaction quickly. | S1/S2/S4/S5; L. Start with CSV before bank integrations. |
| **F4** | Due calendar and reminder workflow: due today/7/30 days, promise-to-pay, snooze, recipient preferences and reminder history. | Calendar/agenda and batch reminder review. | Actionable due list and optional push notifications. | S2/S7; M. Enhances existing notifications/WhatsApp sharing. |
| **F5** | Improved installable mobile web app: install guidance, app update handling, saved drafts, native sharing and deliberate offline state. | Same workspace and synced data. | Home-screen launch, safe resume, touch-friendly quick actions. | S1/S4/S6/S8; M. Keep financial posting online initially. |
| **F6** | Partner self-service: published statements, receipts/documents and “report a discrepancy.” | Preview/control exactly what a partner can view. | Partner reads/downloads statements and submits a query. | S1/S5/F1; M–L. |
| **F7** | Liability planning: 7/30/90-day obligations and concentration by partner/card. | Breakdown, upcoming commitments and scenario review. | Summary and exceptions. | S2/S3; M. Label as liabilities, not cash runway without cash/inflow data. |
| **F8** | Business deployments, incoming returns and asset tracking. | Active investment/agreement workflows with a real data model; later margin/performance analysis. | Essential capture, review and alerts. | Separate scope decision; L. Current inactive pages do not constitute this feature. |

Recommended sequence: S1 plus release controls first; then S2/S3/S4; then S5/S6/S7/S8; then choose two or three optional features. F1, F3 and F5 are a useful initial shortlist if statement sharing and phone entry dominate daily usage. Do not put reconciliation/import/report expansion ahead of correct underlying balances.

Before S2 implementation, define monthly versus one-time profit, first due date, proration, partial principal returns, rate changes, reinvestment meaning, waivers, backdating, rounding and business timezone. Existing notes may not contain enough information to infer history safely; ambiguous rows should be reviewed rather than silently converted.

Useful success measures: duplicate financial records caused by retries; ledger-to-statement reconciliation differences; successful record-and-reload rate; time to record a payment on phone; statement preparation time; unresolved/retried batch items; escaped release defects and recovery time. Set numerical targets after capturing a baseline.

**3. Market comparison: what to borrow**

These are adjacent product benchmarks, not all direct substitutes for CapitalOS. Vendor capabilities below were checked against official public pages; plan/region availability can vary. Proposed adoption is our product judgment.

| Product | Verified relevant capability | What CapitalOS should incorporate | What to defer |
|---|---|---|---|
| **Zoho Books** | Transaction reconciliation and uneditable activity history with version comparisons. Sources: [reconciliation](https://www.zoho.com/us/books/help/banking/reconciliation.html), [audit history](https://www.zoho.com/in/books/help/reports/activity.html). | S5/F3: references, bank-statement matching, unmatched queue, before/after history. | Full accounting, inventory and invoicing unless requested. |
| **Khatabook** | Customer transaction/reminder workflows, PDF reports, backup and bulk/SMS/call reminder help. [Official help](https://khatabook.com/help/en/). | F1/F2/F4: simple entry, clear balances, convenient statements and reminder history. | Replicating lending/merchant services. |
| **Kubera** | Installable mobile web app; historical wealth reports. [Mobile app](https://help.kubera.com/article/103-does-kubera-have-a-mobile-app), [historical reports](https://help.kubera.com/article/114-what-is-recap-in-kubera). | F1/F5/F7: historical snapshots and a polished installable experience. | Net worth/IRR across asset classes until actual valuations and incoming cash flows exist. |
| **Carta** | Partner portal with transactions/documents and controlled publishing; distribution review workflows. [Portal](https://carta.com/explore/fund-erp/lp-portal/), [distribution workflow](https://releasenotes.carta.com/new-capital-call-and-distribution-experience-1R4qeA). | S1/F1/F6: review before publishing, period statements, per-partner access. | Cap tables, complex waterfalls and US fund-tax workflows. |
| **Juniper Square** | Secure document sharing, investor permissions, self-service and document/login activity; explicit control over publishing. [Official portal](https://www.junipersquare.com/platform/portal). | S1/F6: controlled documents, published snapshots and access/view history. | Fundraising CRM and institutional fund administration. |

Native iOS/Android apps, automated money movement, offline financial writes, AI risk scoring, multi-currency and tax filing are separate expansion decisions. A responsive installable app is the lower-complexity first mobile step; its essential flows still require real-device acceptance.

**4. CI/CD: what is verified now**

`npm run validate` passed: **594 tests in 19 files**, about **11.8 seconds total** on this machine. Vitest took 3.87 seconds; Vite production build took 1.94 seconds with no reported warnings. Backend syntax check passed. Production dependency advisory scans reported zero known vulnerabilities in both manifests; this does not validate credentials, authorization or financial correctness.

The check ran on Node 26.5.0/npm 11.17.0; the function config specifies Node 18. Main JavaScript was 450.85 kB (141.53 kB gzip), reports chunk 391.00 kB (113.82 kB gzip), CSS 90.31 kB (15.65 kB gzip). These are bundle measurements, not observed mobile loading times or production latency.

| Current gap | Why the green suite is insufficient | Proposed control |
|---|---|---|
| No repository CI workflow; deploy commands bypass validation. | The documented rule is not an enforced release gate. | **C1:** required checks, protected release path and controlled deployment credentials. Hooks alone are insufficient; Catalyst supports ignoring scripts. [Official lifecycle scripts](https://docs.catalyst.zoho.com/en/cli/v1/scripts/lifecycle-and-custom-scripts/). |
| Tests do not exercise the actual API handler; some duplicate helper implementations; backend JS is outside TypeScript checks. | A test can pass while production code behaves differently. | **C2:** test actual shared helpers and actual handler with injected datastore/mail dependencies; validate backend types/syntax. |
| Local schema check primarily validates the legacy schema/template, not the real five-table COS API contract. | A missing or wrong remote table/column can escape every local test. | **C3:** one authoritative active schema, versioned migrations and staging database contract checks. |
| Mobile tests use JSDOM/CSS assertions; no real-browser release suite. | They do not establish rendered layout, touch, keyboard, browser persistence or cross-browser behavior. | **C4:** critical browser journeys on desktop and mobile engines plus device spot checks. |
| Production mock mode is controlled only by an environment flag; mock code imports local seed JSON. | A production build with the flag can contain mock behavior and private seed data despite documentation saying this is impossible. | **C1/C5:** reject production mock flags, use synthetic CI fixtures and assert release artifacts exclude mocks/private seed data. |
| Runtime mismatch and SDK set to `latest`; CLI/toolchain not pinned. Both lockfiles do exist. | Local success does not validate the deployed runtime. Existing lockfiles make `npm ci` deterministic, but uncontrolled installs or lockfile refreshes can change dependency resolution. | **C1:** pin supported Node/npm/SDK/CLI; use `npm ci` against both lockfiles. |
| No repository release manifest, monitored promotion, tested rollback or restore procedure found. | Failure detection and recovery depend on manual diagnosis; console configuration is still unverified. | **C5/C6:** traceable artifacts, explicit environments, monitoring, rollback rehearsal and backup restore drills. |

Catalyst lists Node 18 retirement beginning **11 September 2026** and end of support on **11 December 2026**. It supports Node 24. Propose validating the app/SDK on Node 24 LTS and aligning local, CI and deployed runtimes. [Catalyst runtime policy](https://docs.catalyst.zoho.com/en/serverless/help/functions/runtime-support/), [Node release status](https://nodejs.org/en/about/previous-releases).

Catalyst's normal CLI deployment targets Development; production promotion is a separate platform step. Existing documentation overstates what the command guarantees. Each job should verify project ID, environment, schema version and release identity explicitly. [Official quick-start deployment guide](https://docs.catalyst.zoho.com/en/getting-started/quick-start-guide/).

**5. Proposed release pipeline and testing mechanism**

No pipeline can guarantee zero defects. The useful goal is to prevent repeatable failures, verify money invariants, detect regressions quickly and rehearse recovery.

| Stage | Mandatory work | Evidence/output |
|---|---|---|
| Pull request — C1/C2 | Clean checkout, pinned runtime, both deterministic dependency installs; secret/advisory scans; schema/types/backend checks; existing tests plus direct API cases. | Required green checks tied to commit. Financial/access regressions block release; failed checks cannot be waved through by rerunning until lucky. |
| Package — C5 | Build client and function once; exclude mock/seed data; record commit, schema version, dependency hashes, artifact checksums and configuration expectations. | Immutable versioned release bundle. |
| Browser checks — C4 | Test the retained production bundle with synthetic fixtures supplied by the test environment; desktop Chromium and mobile Chromium/WebKit coverage; accessibility checks. | Trace/screenshots on failure; save/reload, navigation and portal isolation verified on the same artifact used in staging and release. |
| Isolated staging — C3/C5 | Apply compatible migrations; check actual tables/columns; deploy that bundle; use synthetic accounts/data and a mail sink. Test real persistence/auth, pagination and multi-request operations. | Verified application/API/database combination. No production snapshots in ordinary CI fixtures. |
| Production promotion — C5 | Release only the verified version through the platform's supported path; serialize deployments; verify environment/config/version. Use compatible backend-first rollout where client/API versions overlap. | Traceable production release; optional feature flags for risky additions. |
| Post-release — C6 | Non-destructive health/read checks, synthetic identity where available, error/latency and reconciliation alerts, current/previous release identification. | Detect and revert incompatible code quickly. Database changes require a forward repair or rehearsed recovery plan, not blind rollback. |
| Nightly/scheduled — C2/C4/C6 | Wider browser matrix, month-end/timezone/property/concurrency/fault tests, representative load, dependency review and periodic backup restore drills. | Broader confidence without putting every expensive check on every small change. |

Critical tests should check outcomes, not copy formulas or assert arbitrary coverage percentages:

| Scenario | Required invariant |
|---|---|
| Anonymous/wrong-role requests; Partner A requests Partner B; revoked/expired portal link | No unauthorized data or mutation, including fields hidden only by the UI. |
| Partial, multiple partial, full, adjusted and recurring profit payments | Obligations minus allocated settlements equals remaining balance for the correct period. Notes do not control arithmetic. |
| Combine/revert and principal return | Original principal is conserved; capital cannot belong to two active combinations or be returned twice. |
| Double tap, concurrent API calls, timeout after successful commit, retry | One durable financial effect for one operation, or an explicit conflict. |
| Failure after each step of reinvestment/bulk/cascade | Recoverable state; each item shows success, failure or uncertain status; retry cannot duplicate successful items. |
| Create/edit/delete/restore with bad dates, negative values, missing parents or exhausted balances | Same server invariants apply to every mutation. |
| 201+ rows, deleted rows across pages, large representative dataset | Complete data and reconciling summaries/statements/ledger. |
| End of month, leap day, rate changes and India midnight | Consistent date/period results under a frozen clock and chosen rounding rules. |
| Cold-load bulk page, missing table, network failure, second device refresh | Usable error/retry/freshness state; failed data never masquerades as zero debt. |
| Phone keyboard, dialog scroll/focus, large text, long content, print/PDF/CSV | Essential controls stay reachable and exports preserve meaning. |
| Migration and rollback against previous client/API | Backward-compatible release or a verified controlled transition. |
| Backup restore | Restored records reconcile to the expected balances; recovery procedure works on an isolated environment. |

Use invariant/property tests for the money model and targeted mutation testing where a passing suite might tolerate a changed sign, deleted authorization check or rounding error. Establish a coverage baseline for actual active server/financial code, then prevent regressions; total test count alone is not a release criterion.

Faster delivery should preserve today's inexpensive full gate. Cache package downloads by both lockfile hashes; cancel superseded PR jobs; build once and promote the same artifact; parallelize independent API/browser jobs; deploy only changed components when schema/API compatibility allows it. Keep slow broad/load/device checks scheduled while retaining critical financial/authentication journeys in every release. Measure queue, installation, test, build, upload and verification times separately before setting speed targets. The current 12-second local gate is already inexpensive; CI and deployment timings have not been measured.

**6. Decision sheet**

All selections are pending. You can reply using IDs, for example: `S1–S8; C1–C6; F1 and F5 now; F3 later; defer F8`.

| Choice group | IDs | Suggested decision |
|---|---|---|
| Reliability and user trust | S1–S8 | Prioritize before broader adoption; S1 first, then money/data/write integrity. |
| Testing and release controls | C1–C6 | Introduce alongside repairs so reproduced failures become required regression checks. |
| Statements / onboarding / evidence | F1 / F2 / F3 | Choose according to frequency of partner reporting, spreadsheet migration and reconciliation work. |
| Reminders / mobile / partner portal | F4 / F5 / F6 | Choose according to how often work occurs on phones and how independently partners should operate. |
| Planning / product expansion | F7 / F8 | F7 after correct obligation data; F8 is a separate investment/income product scope. |

No fixes, feature additions, credential changes, outbound messages or deployments have been performed. This review adds only this decision document; existing user changes remain intact.
