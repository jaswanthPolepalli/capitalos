# Mobile view audit

Date: 17 September 2026

## Implementation update

The fixes are now implemented in the working tree. Shared phone styles live in `client/src/mobile.css`; duplicate table/header/search rules were removed from the global stylesheet. Public pages no longer inherit the root scroll lock; workspace content reserves bottom-navigation space. Previously hidden actions are visible, with separate desktop-only cells used only where a mobile equivalent exists.

Financial records now have missing labels filled in and reusable expandable secondary fields (`RecordRow`). Dashboard tables become labelled phone cards. Headers wrap and preserve contact descriptions; global search, notifications and unlock remain accessible. Bulk payment has a visible selection toolbar and a mobile sticky action bar. Statement tables have contained scrolling and separate print behavior; reports use a width-safe grid and wrapping period tabs. Portal links support partner search. Touch controls and modal sizing were improved, and the navigation drawer contains/restores focus and closes when switching to desktop width.

Validation: `npm run validate` passed (schema, TypeScript, all 594 tests, production build). Ten added tests cover mobile CSS visibility and disclosure, bulk selection, portal filtering and drawer interaction. Browser/device layout and virtual-keyboard verification remain outstanding because browser access was unavailable. The original source-level findings below are retained as the audit baseline, not a list of remaining defects.

## Scope and confidence

Reviewed the current working tree, including existing uncommitted changes, all 14 route definitions in `client/src/App.tsx`, the shared shell/navigation, active page components and responsive CSS. This is a source-level audit. Browser access was unavailable, so no screenshots, computed-layout measurements or physical-device checks were performed. Confirmed CSS/markup defects are distinguished from predicted layout risks below. No application code was changed.

Inactive page files (Agreements, CEO/Businesses, CEO Investments, Transactions, Profit Schedule and Module) are not priorities for the current app: they are not registered routes in App.tsx.

## Priority definitions

- P0: likely prevents access to substantial content; verify first.
- P1: confirmed loss of an existing operation or essential information on mobile.
- P2: significant readability, navigation or efficiency improvement.
- P3: polish or scale-dependent improvement.

## Cross-page findings

### 1. Public portal inherits the workspace scroll lock — P0, high-confidence risk

`styles.css:423` applies `height: 100%` and `overflow: hidden` to html/body below 768px. Workspace scrolling is delegated to `.app-shell__workspace`. Public routes render outside AppShell (`App.tsx`) and `.public-portal-shell` (`styles.css:3047`) has neither a bounded height nor vertical scrolling. Long partner and CEO portal pages therefore have no equivalent scroll container. Confirm on a populated portal before other cosmetic work.

Scope the root scroll lock to the workspace, or explicitly provide the public portal with a viewport-height scrolling container. Check loading, error and populated portal states. Passing result: all sections and footer can be reached with touch scrolling.

### 2. Fixed bottom navigation has no matching content clearance — P1, code-confirmed mismatch

The nav is fixed and portaled to document.body, so it reserves no layout space. Its height is `68px + env(safe-area-inset-bottom)` (`styles.css:1665`), while mobile page padding ends at 24px (`styles.css:1311`). The workspace occupies the whole app height. Last controls/content can sit behind the nav, particularly on devices with a bottom safe area.

Reserve the full nav height plus comfortable spacing in the scrolling workspace. Verify the last pagination button, final payment action, statement footer and Settings controls at maximum scroll.

### 3. Mobile globally hides action cells — P1, confirmed

`styles.css:1547` sets `.table-cell--action { display: none !important; }`. This is only safe when a page supplies a `.table-cell-actions` alternative. Several active pages do not. Fix action parity before redesigning cards.

Confirmed affected operations:

| Page | Operation hidden | Source |
|---|---|---|
| Capital Contributions | Edit contribution | CapitalContributionsPage.tsx:1074 |
| Partner Detail | Allocation edit, record capital return, record profit payment | PartnerDetailPage.tsx allocation table, following line 850 |
| Return Obligations | Edit existing return date; set missing return date | ReturnObligationsPage.tsx:293 and :362 |
| Settings | Restore deleted allocations, capital returns and profits | SettingsPage.tsx:193, :234, :275 |
| Credit Cards | Delete an unassigned card | CreditCardsPage.tsx:568 |

Pending Profits, Ledger and assigned Credit Cards already implement separate mobile action rows; preserve these. Partners hides its trailing view arrow, but the partner-name link remains, so that is not a blocked detail route.

### 4. Hidden table headers require labels that some pages omit — P1

The mobile table pattern visually hides thead (`styles.css:1476`) and relies on `data-label` pseudo-content (`:1527`). Partner Detail allocation and history rows, Settings deleted records and Bulk Payment omit these labels. Return Obligations' no-date subsection also omits labels on several financial/date fields. Reports totals omit labels despite displaying three different amounts.

Add explicit labels, or use purpose-built mobile records with named amounts and dates. Avoid presenting multiple unexplained currency amounts in a vertical stack.

### 5. Shared header constrains titles and action groups — P1/P2

Below 768px, `.page-header` uses nowrap and overflow hidden, titles truncate, and actions do not shrink (`styles.css:1325`). Partner Detail supplies four buttons in an unwrapped inner flex group (`PartnerDetailPage.tsx:699`). The group can consume the title space and clip controls on narrow screens. Capital Contributions also supplies four actions; its dedicated mobile Add button helps, but the other header actions still need layout verification.

Use a complete title row, one prominent primary action, and a labelled More actions menu or wrapping secondary row. Do not hide the only contact information by using the generic mobile rule that removes header descriptions: Partner Detail places phone/email there.

### 6. Consolidate conflicting responsive rules — P2

Mobile table rules appear around styles.css:1457 and :4108, with general table declarations in between. `.panel .data-table` explicitly restores desktop tables at :1611, so future panel-wrapped tables will behave differently from normal lists. The mobile search field's width:100% is later overridden with 200px and 150px at :3014 and :3039, although its containing SearchInput becomes full width.

Establish explicit table variants and one mobile component layer. Keep input width at 100% of its container. Avoid fixing these conflicts by adding another broad override block.

## Page-by-page priorities

| Page / route | Priority | Findings and recommended direction |
|---|---|---|
| Public Portal `/p/:token` | P0 | Resolve scroll-container risk first. Four kinds of financial tables use horizontal scrolling and small text. Add mobile summaries or labelled expandable records; retain tables where comparison benefits from them. Keep partner identity visible while navigating long sections. |
| Partner Detail `/partners/:id` | P1 | Hidden allocation operations, missing row labels, four-button header, and hidden contact description. Use a wrapping identity/contact area, one primary action, labelled allocation cards, and expandable histories. Preserve visible history Edit buttons, which are ordinary cells and are not subject to the action-cell hiding rule. |
| Capital Contributions `/capital-contributions` | P1 | Row Edit disappears. Header remains crowded despite the existing separate mobile Record Contribution button. Each contribution exposes many fields, producing long cards. Keep amount, partner, outstanding and return date first; expand rate/source/notes/history on demand. |
| Return Obligations `/return-obligations` | P1 | Both edit-date and set-date controls disappear; several no-date fields lose context. Put outstanding amount, due date and overdue status first, with a visible Set/Edit date action. Expand original/returned amounts and rate. |
| Settings `/settings` | P1 | Deleted-record Restore disappears in all three tables, and values lack mobile labels. Provide labelled deleted-record cards with full-width Restore controls and readable partner identity. |
| Bulk Payment `/bulk-payment` | P1 | Select/Deselect all exists only inside the visually clipped table header (BulkPaymentPage.tsx:103); the control is not available as a normal visible touch target. Individual selectors are 24px and cells lack labels. Add a visible selection toolbar, larger selection targets, and a sticky selected-count/total/review bar above bottom navigation. Review payout summary and success buttons use nonwrapping flex layouts and need narrow-width checks. |
| Partner Statement `/partners/:id/statement` | P2, high | Desktop document padding is 40px 48px (styles.css:2286), consuming 96px horizontally on a phone. Header/action rows do not wrap; the six-column contributions table has no scroll wrapper. Add a mobile screen layout with compact padding, stacked header/actions and contained tables/cards, while preserving separate print styles. |
| Reports `/reports` | P2, high | `.reports-grid` has a 320px minimum column (styles.css:5659), wider than the roughly 292px page area at a 320px viewport. Period tabs do not wrap; outer toolbar wrapping does not wrap the tab group. Use minmax(min(100%, 320px), 1fr), wrapping/scrollable period controls, and labelled totals. Verify chart axes/legend at phone width; the fixed 70px Y axis consumes substantial plot space. |
| Credit Cards `/credit-cards` | P1 narrow case; P2 general | Assigned cards already have mobile Edit/Delete rows. Unassigned cards do not. Promote available limit and next due date; collapse notes and secondary billing details. Five summary-strip metrics become one-column below 480px, adding considerable scrolling. |
| Pending Profits `/pending-profits` | P2 | Mobile payment/edit actions already exist. Improve the dense filter/month-navigation area and long multi-field cards. Put partner, payable amount, month/status and Pay action first; expand source, received date and notes. Keep pending/paid state visually explicit when changing month. |
| Ledger `/ledger` | P2 | Mobile Edit/Delete actions and labels already exist. Each event still displays many fields, and the summary strip stacks every metric below 480px. Use a compact event row with amount/date/type/partner, expandable allocation/source/notes, and an optional filter sheet with active-filter count. |
| Dashboard `/` | P2 | Summary metrics already stack and mobile controls have 44px minimum heights in dashboard.css. The partner overview remains a nowrap table in an independently scrolling container capped at 65vh (dashboard.css:118), making comparison and action discovery depend on horizontal and nested vertical scrolling. Consider compact partner summaries with disclosure, or a sticky identity column and clear horizontal-scroll affordance. |
| Partners `/partners` | P2 | Financial labels and partner-name links already work with the card pattern. Six secondary financial/date fields per partner make scanning lengthy. Highlight outstanding and pending amounts, collapse secondary values, and keep long names readable. Check Export/Add header width. |
| Portal Links `/portal-links` | P3 | Already has a single-column mobile grid and wrapping action controls (styles.css:3559). Main opportunity is scale: the page renders every partner portal without search/pagination (PortalLinksPage.tsx:194). Add partner search when the list grows; make Copy/Open actions easy to distinguish and avoid requiring the truncated URL to identify a card. |

## Form and navigation follow-up

- Shared modal layout already becomes a bottom sheet below 560px, but uses 92vh and lacks bottom-safe-area footer padding. Validate keyboard-open Save/Cancel visibility and long forms; use dynamic viewport sizing and a reachable footer.
- Shared form inputs are 14px; use a consistent mobile input size, as Dashboard already does with 16px. Check focus behavior on actual iOS hardware.
- Mobile header buttons can be only 34px high and row actions 36px. Set a project target of at least 44px for frequent touch actions; do not rely on icon size alone.
- The top bar is removed on all non-home workspace pages. Check discoverability of role unlock, notifications and global search from those pages; offer an intentional mobile entry point for essential global actions.
- The More drawer moves focus to Close but has no explicit focus trap or focus restoration. Verify keyboard/screen-reader navigation and background isolation. These checks also matter when a phone uses an external keyboard.

## Recommended implementation order

1. Restore reachability: public scrolling, bottom-nav clearance, hidden row actions, visible bulk select-all.
2. Restore clarity: Partner Detail labels/contact/header, Settings cards, statement mobile layout, Reports narrow-width layout.
3. Reduce scrolling: compact financial record cards, expandable secondary fields, grouped filters, compact summaries.
4. Validate interaction details: keyboard-open modals, safe areas, touch targets, drawer focus and long data values.

## Acceptance checklist for subsequent browser verification

Test 320, 360, 390, 430 and 768 CSS-pixel widths, plus short landscape height. Use populated mock data; inspect CFO and read-only states. Include long partner/card names, large INR amounts, long notes, missing dates, unassigned cards and deleted records.

- No whole-page horizontal overflow; intentional table scrolling remains contained and discoverable.
- Scroll to the last item and tap every final control without bottom-navigation overlap.
- Every desktop operation has an intentional mobile equivalent in the appropriate role.
- Each financial value/date is understandable without a visible desktop header.
- Open the keyboard in add/edit/payment forms and reach Save, Cancel and validation errors.
- Verify public partner and CEO portals can reach every section and footer.
- Check bulk selection, review, validation and completion layout using mock records only.
- Check portrait/landscape and larger text; verify statement print output separately from screen layout.

No functional test suite was run because this deliverable only adds an audit document. CSS/markup conclusions above are source-backed; predicted clipping, device keyboard behavior and actual scroll outcomes still need browser confirmation.
