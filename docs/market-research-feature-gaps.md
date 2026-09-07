# CapitalOS — Market Research & Feature Gap Analysis

> Prepared by Sahaa AI | July 2026  
> Purpose: Compare CapitalOS against similar platforms in the market and identify high-value features to incorporate.

---

## 1. What Is CapitalOS (Our System)

CapitalOS is an **INR-first, personal CFO workspace** for a single operator managing:
- **Partners** — people who invest capital with the CFO (like silent lenders)
- **CEOs / Businesses** — companies the CFO deploys that capital into (like borrowers)
- **Agreements** — terms governing each capital relationship (rate, frequency, period)
- **Capital Contributions / CEO Investments** — fund flow records
- **Transaction Ledger** — every money movement (inflow from CEOs, outflow to partners)
- **Profit Schedule** — payment schedule tracking who is owed what and when
- **Public Portal** — read-only view shared externally with partners/CEOs

**Gap summary in one line:** CapitalOS is a well-structured financial ledger with good data modeling — but it currently lacks the intelligence layer, automation, and communication tools that modern platforms in this space have.

---

## 2. Similar Platforms Researched

| Platform | Category | Closest Parallel to CapitalOS |
|---|---|---|
| **Juniper Square** | Fund Administration (PE/VC/CRE) | LP portal, capital calls, distributions, reporting |
| **Carta** | Fund Administration (VC/PE) | Fund accounting, waterfall, LP portal, capital accounts |
| **AngelList** | VC Fund Admin | Capital calls, distributions, LP portal, tax, reporting |
| **Lendr** | Private / Hard Money Lending | Loan origination, investor capital tracking, borrower portal |
| **Private Money Ledger** | Private Lending | Capital ledger, interest tracking, lender/borrower portal |
| **LoanLoop** | Seller-Finance Lending | Amortization, payment tracking, borrower portal, tax summaries |
| **Fundingo** | Private Lending (Salesforce-based) | Loan lifecycle, collections, document management |
| **Hypercore** | Private Credit | Full loan lifecycle, private credit complexity |
| **Visible.vc** | VC Portfolio Monitoring | Investor updates, portfolio data, fundraising CRM |
| **KapitalNex / AIF Software** | India AIF/Wealth | SEBI-compliant investor onboarding, KYC, capital calls |

---

## 3. Features Available in Competing Platforms (Not Yet in CapitalOS)

### 3.1 🔔 Communication & Relationship Layer

#### WhatsApp / SMS Payment Reminders *(MoneyLendingERP, Hypercore)*
- Automated reminder messages sent to borrowers/CEOs on upcoming due dates
- Configurable: 7 days before, 3 days before, on due date, 1 day after
- **CapitalOS fit:** CFO gets a reminder to chase CEOs, or optionally send a message directly from the app to the CEO's registered phone number

#### Email Digest / Weekly Summary *(Juniper Square, Visible.vc)*
- Automated weekly/monthly email to the CFO summarising: pending payments, overdue items, expected inflows this week
- **CapitalOS fit:** A "Weekly Briefing" email sent to the CFO's email every Monday morning with a snapshot of the portfolio

#### Investor / Partner Statement Emails *(Carta, AngelList, Juniper Square)*
- Auto-generated statements emailed to partners/investors on a schedule (monthly, quarterly)
- Shows: opening balance, contributions, profit received, principal returned, closing balance
- **CapitalOS fit:** One-click "Send statement to partner" from the Partner Detail page, using the Public Portal link

#### In-App Messaging / Notes on Entities *(Lendr, Fundingo)*
- Thread-based conversation log on each CEO or Agreement record
- CFO can log: phone calls, promises made, dispute notes, escalation history
- **CapitalOS fit:** F5 (CEO Escalation Notes) is a start — expand it to a full activity timeline with timestamps on every entity

---

### 3.2 📊 Analytics & Intelligence

#### Portfolio Health Score / Risk Rating *(Hypercore, Juniper Square)*
- Each CEO/borrower gets an automatically computed risk score based on: days overdue, repayment consistency, outstanding-to-capital ratio, broken promises
- Color-coded: Green / Amber / Red
- **CapitalOS fit:** Extend the F5 "CEO Payment Health" into a full Risk Score visible on the dashboard and CEO list

#### Trend Charts — Capital & Profit Over Time *(Carta, Juniper Square, Visible.vc)*
- Line charts showing: deployed capital over months, profit received per month, partner payouts per month
- Helps CFO see if the portfolio is growing, shrinking, or stagnating
- **CapitalOS fit:** Add a "Portfolio Trends" section on the dashboard with a 12-month sparkline for capital in, capital out, profit in, profit out

#### Concentration Risk Widget *(Juniper Square, Carta)*
- Pie chart / bar chart showing: what % of total capital is deployed with a single CEO
- Alert if any single CEO holds >40% of total portfolio
- **CapitalOS fit:** A "Concentration" panel on the Dashboard — "₹30L of ₹80L (37%) is with Devraj Bhat Infrastructure"

#### Net Interest Margin / Spread Calculator *(Hypercore, Private Credit tools)*
- Shows the spread between what the CFO earns from CEOs vs. what the CFO pays to partners
- E.g. "Earning 18% from CEOs, paying 12% to partners → 6% spread = ₹X/month margin"
- **CapitalOS fit:** Add a "CFO Margin" KPI on the dashboard: Expected monthly from CEOs − Expected monthly to partners = Net CFO earnings

#### Payment Velocity Tracking *(Lendr, Fundingo)*
- Shows average days to payment per CEO (e.g., "Arjun pays on average 4 days late")
- **CapitalOS fit:** Add "Avg. payment delay" metric on CEO detail page, derived from ledger transaction dates vs due dates

---

### 3.3 📅 Scheduling & Automation

#### Auto-Generated Repayment Schedules *(Carta, AngelList, LoanLoop)*
- When an agreement is created, the system auto-generates the full repayment schedule for the entire term
- E.g. Create agreement on 1 Apr 2023 for 24 months at 12% quarterly → system creates 8 profit schedule entries automatically
- **CapitalOS fit:** On Agreement creation, auto-populate `ProfitSchedule` rows for the full term rather than adding them manually

#### Recurring Payment Reminders with Snooze *(LoanLoop, Lendr)*
- CFO can "snooze" a reminder: "Remind me again in 3 days" 
- Promise-to-pay tracking: "CEO promised to pay by 15 Jun" → reminder triggers if not paid by then
- **CapitalOS fit:** Add "Snooze" to notification alerts (F2) and "Promise date" already planned in F5

#### Amortization Schedule View *(LoanLoop, Private Money Ledger)*
- Tabular view of every payment period for the full term: principal component, profit component, running balance
- Like a bank loan statement
- **CapitalOS fit:** On Agreement Detail page, show a "Full Schedule" tab with all entries, their due dates, paid amounts, and outstanding balance — a proper amortization-style table

#### Calendar View of Due Dates *(Lendr, Fundingo)*
- A monthly calendar view showing every payment due (from CEOs) and every payment owed (to partners) on their respective dates
- CFO can see the entire month at a glance
- **CapitalOS fit:** A "Calendar" page or widget showing profit due dates and return dates in a proper monthly grid

---

### 3.4 📁 Document & Compliance Layer

#### E-Signature Integration *(AngelList, Carta, Lendr)*
- Agreements can be digitally signed via DocuSign / SignDesk integration directly in the app
- Signed document auto-attached to the Agreement record
- **CapitalOS fit:** When creating an Agreement, CFO can send a signature request to the partner/CEO's email; signed PDF auto-attached via F4 Document Upload

#### Document Expiry Alerts *(Lendr, KapitalNex)*
- System tracks when agreement documents, KYC documents, or ID proofs expire
- Notifies CFO before expiry
- **CapitalOS fit:** Add `documentExpiryDate` field to Agreement; fire notification 30 days before expiry

#### Audit Trail / Change History *(Carta, Juniper Square)*
- Every change to a record is logged: who changed what, from what value, to what value, at what time
- Immutable log — records cannot be altered
- **CapitalOS fit:** An `AuditLog` table in the datastore that logs all writes to financial records; viewable on each entity's detail page under an "Activity" tab

#### KYC / Identity Verification Fields *(KapitalNex AIF, AngelList)*
- Store PAN number, Aadhaar reference, bank account details, cancelled cheque for each partner
- Flag partners whose KYC is incomplete
- **CapitalOS fit:** Add KYC fields to the Partner entity (PAN, bank account, IFSC); show KYC completeness badge on partner list

---

### 3.5 💸 Payment & Transaction Features

#### Multiple Bank Account Tracking per Partner *(Lendr, Private Money Ledger)*
- Partners may have multiple bank accounts; CFO needs to know which account to pay to
- Track: bank name, account number, IFSC, account holder name, primary flag
- **CapitalOS fit:** Add `PartnerBankAccount` entity; on Quick-Pay modal, show bank account dropdown for the partner

#### Payment Confirmation / Receipt Generation *(LoanLoop, Lendr)*
- After posting a payment, the system auto-generates a payment receipt (PDF)
- Can be downloaded or emailed to the partner/CEO
- **CapitalOS fit:** On Quick-Pay modal post-confirmation, offer "Download receipt as PDF" — a formatted receipt with payment details, amount in words, reference number

#### Partial Payment Handling with Running Balance *(Private Money Ledger, Hypercore)*
- Track partial payments against a due amount
- Show: total due, paid so far, remaining balance, accrued late fees
- **CapitalOS fit:** The `ProfitSchedule` already has `paidProfit` — expose this as "Paid so far / Total due / Remaining" in the UI clearly on each schedule row

#### Penalty / Late Fee Calculation *(LoanLoop, MoneyLendingERP)*
- Configurable late fee: flat fee or % per day after due date
- System auto-calculates late charges and adds them to the outstanding amount
- **CapitalOS fit:** Add `lateFeeType` and `lateFeeRate` to Agreement; compute overdue penalty in `financial/calculations.ts` and show it on overdue schedule entries

#### Multi-Currency / Multi-Entity Support *(Juniper Square, Carta)*
- Not immediately relevant for a personal INR-first system, but flagged for future
- **CapitalOS fit:** Low priority — keep INR-first

---

### 3.6 📤 Reporting & Export

#### Partner Capital Account Statement *(Carta, AngelList, Juniper Square)*
- A formal, printable capital account statement for each partner showing the full history from day 1
- Equivalent to a bank passbook: date | description | debit | credit | balance
- **CapitalOS fit:** On Partner Detail page, add a "Generate Statement" button that creates a printable/exportable capital account statement PDF

#### Tax Summary Report *(LoanLoop, AngelList)*
- Year-wise summary of: total interest/profit paid to each partner (for TDS purposes)
- Total interest received from each CEO
- **CapitalOS fit:** In the Reports page (F6), add a "Tax Summary" section: FY-wise profit paid per partner, useful for TDS filing and income tax preparation

#### CSV / Excel Export for Every Table *(Lendr, Carta, Visible.vc)*
- Every data table (transactions, profit schedule, partners, CEOs) can be exported to CSV in one click
- **CapitalOS fit:** Add a generic "Export to CSV" button on all list/table pages — applies to Ledger, Profit Schedule, Contributions, CEOs, Partners

#### Waterfall / Distribution Preview *(Carta, Juniper Square)*
- Before running a payment cycle, show a "waterfall" breakdown: total incoming → net margin → what goes to each partner proportionally
- **CapitalOS fit:** In the Bulk Payment (F1) flow, add a "Payment waterfall preview" step showing the breakdown before confirmation

---

### 3.7 🔗 Integration & Connectivity

#### UPI / Bank Payment Deep Links *(India-specific, not yet in any platform)*
- From a payment due row, generate a UPI deeplink for the exact amount to the partner's VPA/UPI ID
- Tap to open PhonePe / GPay / BHIM directly with amount pre-filled
- **CapitalOS fit:** Unique India-first feature — on Quick-Pay modal, add "Pay via UPI" button that generates `upi://pay?pa=...&am=...&tn=...` deep link or QR code

#### WhatsApp Share — Payment Confirmation *(India-specific)*
- After recording a payment, offer a "Share on WhatsApp" button that opens WhatsApp with a pre-filled message to the partner/CEO:  
  "₹1,87,500 profit paid for Q3 2025 via NEFT. Ref: NEFT123456. — CFO"
- **CapitalOS fit:** Add to post-payment confirmation screen; use `https://wa.me/<phone>?text=...` API

#### Tally / Excel Integration for Accounting Sync *(India MSME space)*
- Export transactions in a Tally-importable format (XML/CSV with ledger heads)
- **CapitalOS fit:** In Reports page, add a "Export for Tally" option that formats ledger transactions with appropriate debit/credit accounts for easy import

---

### 3.8 🖥️ UX & Workflow Improvements

#### Onboarding Wizard for New Partners/CEOs *(Lendr, AngelList)*
- Step-by-step guided wizard: Add partner → Add agreement → Record first contribution → View summary
- Prevents incomplete records (partner without agreement, contribution without schedule)
- **CapitalOS fit:** Replace the separate Add forms with a multi-step wizard that chains partner → agreement → contribution creation in one flow

#### Keyboard-First / Power User Mode *(Linear, Notion-style apps)*
- Beyond Cmd+K global search (F8), add keyboard shortcuts for common actions:
  - `N` → New transaction
  - `P` → Go to partners
  - `L` → Go to ledger
  - `?` → Show shortcuts cheat sheet
- **CapitalOS fit:** Extend the CommandPalette to show a shortcuts help overlay when `?` is pressed

#### Dark Mode *(Standard in modern apps)*
- The theme system already has `ThemeProvider.tsx` — implement a proper dark mode toggle
- **CapitalOS fit:** Already partially possible — complete the dark mode CSS variables in `styles.css`

#### Pinning / Favourites *(Notion, Linear)*
- CFO can "pin" frequently accessed partners or CEOs to the top of their respective lists
- **CapitalOS fit:** Add a `pinnedIds` array in `localStorage`; show pinned items at the top of list pages with a star/pin icon

#### Mobile-Optimised Quick Actions *(Lendr mobile app)*
- On mobile, long-pressing a partner or CEO row shows a context menu: "Record payment", "View statement", "Call partner"
- **CapitalOS fit:** Add a context menu / bottom sheet on mobile for the most common row actions; builds on the existing `MobileNavigation.tsx`

#### Empty State Onboarding Prompts *(All modern SaaS)*
- When the app is first used (no data), show guided prompts on each page:
  - Partners page: "Start by adding your first partner →"
  - Agreements page: "Link a partner to an agreement →"
  - Dashboard: "Your portfolio is empty. Add a partner and record a contribution to get started."
- **CapitalOS fit:** Enhance the existing `empty-state` components to include a step-by-step setup guide

---

## 4. Priority Recommendation for CapitalOS

Based on the comparison above, here are the features ranked by **impact vs. effort** for the CapitalOS use case:

### 🔴 High Impact / Low Effort (Do Next)

| Feature | Why It Matters |
|---|---|
| **Net CFO Margin KPI on Dashboard** | Instant visibility into the spread the CFO earns. One calculation, high daily value. |
| **CSV Export on all tables** | Every CFO needs to export data for their accountant. One button, massive practical value. |
| **Partner Capital Account Statement (PDF)** | Partners will ask for this. Builds trust and professionalism. |
| **WhatsApp Share post-payment** | Indian-context killer feature. One tap to inform partners/CEOs after payment. |
| **UPI Deep Link on payment modals** | Unique India-first feature — generate UPI QR/link with amount pre-filled from Quick-Pay modal. |
| **Auto-Generate Full Profit Schedule on Agreement Creation** | Eliminates the biggest manual data entry pain point in the current app. |

### 🟡 High Impact / Medium Effort (Next Sprint)

| Feature | Why It Matters |
|---|---|
| **Portfolio Trend Charts (12-month line chart)** | Visual overview of capital growth — standard on every competing platform. |
| **Concentration Risk Widget** | Risk awareness. If one CEO defaults, how bad is the damage? |
| **Payment Receipt PDF Generation** | Professionalism and record-keeping — partners expect receipts. |
| **KYC Fields for Partners (PAN, Bank account, IFSC)** | Required for TDS and direct bank transfers. Addresses real operational need. |
| **Tax Summary Report (FY-wise profit paid per partner)** | Critical for TDS filing — a real CFO pain point at year-end. |
| **Calendar View of Due Dates** | Replaces the mental model of "what's due this month" with a visual calendar. |
| **Late Fee / Penalty Calculation** | If a CEO pays late, the CFO loses money without this. Commercially important. |
| **Audit Trail / Change History** | Financial systems need this. Any change to a payment should be traceable. |

### 🟢 Medium Impact / Low-Medium Effort (Backlog)

| Feature | Why It Matters |
|---|---|
| **Activity Timeline on entity detail pages** | Replaces the current "escalation notes" text box with a proper timestamped log. |
| **Partner Bank Account management** | Operational necessity when you have 10+ partners with different bank accounts. |
| **Payment Velocity per CEO** | Interesting analytics — which CEOs are consistently slow? |
| **Tally Export for Accounting** | Very India-relevant. Most small business accountants use Tally. |
| **Keyboard Shortcuts + Help Overlay** | Power user delight feature. |
| **Pinned / Favourite Entities** | Useful when managing 20+ partners and CEOs. |
| **Onboarding Wizard** | Important for future multi-user scenarios. |

---

## 5. Feature Ideas Unique to CapitalOS's India Context

These are features no Western competitor offers but are highly relevant for India-based private capital operations:

| Feature | Description |
|---|---|
| **UPI Payment QR Code** | Generate a UPI QR code for each payment due — partner scans and pays directly |
| **WhatsApp Reminder Bot** | Send a templated WhatsApp message to a CEO's number directly from the CEO page when payment is overdue |
| **GST / TDS Tracking** | Flag which profit payments require TDS deduction (Section 194A for interest > ₹40,000) and track TDS deducted |
| **Cheque Tracking** | Some partners/CEOs still deal in cheques — track cheque number, bank, clearance status per transaction |
| **Festival / Holiday-Aware Due Dates** | Flag when a payment falls on a bank holiday or festival (Diwali, Holi) and suggest shifting the date |
| **INR Denomination Display** | Already done well — continue showing in Lakhs/Crores format throughout |
| **Regional Language Support** | Future: support Tamil, Telugu, Kannada, Hindi in the partner portal for non-English-speaking partners |

---

## 6. Summary Table

| Category | CapitalOS Today | Market Standard | Gap |
|---|---|---|---|
| Partner/investor portal | ✅ Public portal via token | ✅ Branded portal with login | Login-gated portal for partners |
| Capital tracking | ✅ Full | ✅ Full | — |
| Profit schedule | ✅ Full | ✅ Full | — |
| Auto-generate schedules | ❌ Manual | ✅ Auto on agreement creation | Auto-populate schedule on create |
| Payment receipts | ❌ None | ✅ PDF receipt on every payment | Receipt generation |
| CSV export | ❌ None | ✅ On every table | Export everywhere |
| Tax summary report | ❌ None | ✅ Carta / AngelList | FY-wise profit paid per partner |
| Audit trail | ❌ None | ✅ Carta / Juniper Square | Change log on all financial records |
| Trend charts | ❌ None | ✅ All platforms | 12-month portfolio trend charts |
| Concentration risk | ❌ None | ✅ Juniper Square | Risk concentration widget |
| Net margin KPI | ❌ None | ✅ Private credit tools | CFO spread / margin on dashboard |
| Late fee calculation | ❌ None | ✅ LoanLoop / MoneyLendingERP | Penalty on overdue amounts |
| Calendar view | ❌ None | ✅ Lendr / Fundingo | Monthly calendar of due dates |
| KYC fields | ❌ None | ✅ KapitalNex / AngelList | PAN, bank account, IFSC on partners |
| WhatsApp integration | ❌ None | ✅ MoneyLendingERP | Share payments via WhatsApp |
| UPI deeplink | ❌ None | ❌ None (India exclusive opp) | UPI QR / deeplink on payment modals |
| E-signature | ❌ None | ✅ AngelList / Carta | DocuSign / SignDesk integration |
| Pinning / favourites | ❌ None | ✅ Many SaaS | Pin frequently used entities |
| Dark mode | ⚠️ Partial infra | ✅ Standard | Complete dark mode |

---

*Document created: 2026-07-09 | Author: Sahaa AI (Research mode)*
