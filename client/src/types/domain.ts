/**
 * Client-side domain view models.
 *
 * These mirror the shared/src/domain.ts interfaces but use JavaScript-native
 * types (string for money display, proper Date handling) suitable for React
 * components. Raw paise values are kept as bigint; formatted strings are
 * produced by the formatINR utility at the presentation layer.
 */

// ─── Status codes ─────────────────────────────────────────────────────────────

export const ENTITY_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const INVESTMENT_STATUSES = [
  "ACTIVE",
  "PARTIALLY_REPAID",
  "FULLY_REPAID",
  "WRITTEN_OFF",
] as const;
export type InvestmentStatus = (typeof INVESTMENT_STATUSES)[number];

// ─── Base ─────────────────────────────────────────────────────────────────────

export interface EntityBase {
  id: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ─── Partner ──────────────────────────────────────────────────────────────────

export interface Partner extends EntityBase {
  partnerCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: EntityStatus;
  notes: string | null;
}

// Financial summary derived from the transaction ledger (server-computed)
export interface PartnerFinancialSummary {
  partnerId: string;
  totalCapitalContributed: bigint; // paise
  totalPrincipalReturned: bigint; // paise
  principalOutstanding: bigint; // paise
  totalProfitEarned: bigint; // paise
  totalProfitPaid: bigint; // paise
  profitPending: bigint; // paise
  totalPending: bigint; // paise
  nextPaymentDate: string | null;
  nextPaymentAmount: bigint | null; // paise
}

// ─── CEO / Business ───────────────────────────────────────────────────────────

export interface CEO extends EntityBase {
  ceoCode: string;
  ceoName: string;
  businessName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: EntityStatus;
  notes: string | null;
}

// Financial summary derived from the transaction ledger (server-computed)
export interface CEOFinancialSummary {
  ceoId: string;
  totalCapitalProvided: bigint; // paise
  totalPrincipalReturned: bigint; // paise
  principalOutstanding: bigint; // paise
  totalProfitReceived: bigint; // paise
  profitOutstanding: bigint; // paise
  totalOutstanding: bigint; // paise
  nextPaymentDate: string | null;
  nextPaymentAmount: bigint | null; // paise
}

// ─── Agreement ────────────────────────────────────────────────────────────────

export type ProfitCalculationType = "FIXED" | "PERCENTAGE" | "CUSTOM";
export type ProfitFrequency =
  | "ONE_TIME"
  | "MONTHLY"
  | "QUARTERLY"
  | "YEARLY"
  | "CUSTOM";
export type PartyType = "PARTNER" | "CEO";
export type AgreementStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "DRAFT";

export interface Agreement extends EntityBase {
  agreementCode: string;
  partyType: PartyType;
  partnerId: string | null;
  ceoId: string | null;
  capitalAmount: bigint; // paise
  startDate: string;
  endDate: string | null;
  profitCalculationType: ProfitCalculationType;
  profitRate: string | null; // decimal string e.g. "12.500000"
  fixedProfitAmount: bigint | null; // paise
  customProfitTerms: string | null;
  profitFrequency: ProfitFrequency;
  customFrequencyTerms: string | null;
  principalRepaymentTerms: string;
  profitPaymentTerms: string;
  status: AgreementStatus;
  notes: string | null;
  documentId: string | null;
}

// ─── Contribution ─────────────────────────────────────────────────────────────

export interface PartnerContribution extends EntityBase {
  contributionCode: string;
  partnerId: string;
  agreementId: string;
  ledgerTransactionId: string | null;
  contributionDate: string;
  amount: bigint; // paise
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
  documentId: string | null;
}

// ─── CEO Investment ───────────────────────────────────────────────────────────

export interface CEOInvestment extends EntityBase {
  investmentCode: string;
  ceoId: string;
  agreementId: string;
  ledgerTransactionId: string | null;
  investmentDate: string;
  principalAmount: bigint; // paise
  purpose: string;
  paymentMethod: string;
  referenceNumber: string | null;
  status: InvestmentStatus;
  notes: string | null;
  documentId: string | null;
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export type TransactionType =
  | "PARTNER_CAPITAL_RECEIVED"
  | "CEO_CAPITAL_PROVIDED"
  | "CEO_PRINCIPAL_RECEIVED"
  | "CEO_PROFIT_RECEIVED"
  | "PARTNER_PRINCIPAL_PAID"
  | "PARTNER_PROFIT_PAID";

export type TransactionDirection = "IN" | "OUT";

export interface LedgerTransaction extends EntityBase {
  transactionCode: string;
  transactionDate: string;
  transactionType: TransactionType;
  partnerId: string | null;
  ceoId: string | null;
  agreementId: string | null;
  principalAmount: bigint; // paise
  profitAmount: bigint; // paise
  totalAmount: bigint; // paise
  direction: TransactionDirection;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
  documentId: string | null;
}

// ─── Profit Schedule ──────────────────────────────────────────────────────────

export type ScheduleStatus =
  | "UPCOMING"
  | "DUE"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE";

export interface ProfitSchedule extends EntityBase {
  agreementId: string;
  partnerId: string | null;
  ceoId: string | null;
  dueDate: string;
  expectedPrincipal: bigint; // paise
  expectedProfit: bigint; // paise
  paidPrincipal: bigint; // paise
  paidProfit: bigint; // paise
  principalPending: bigint; // paise
  profitPending: bigint; // paise
  status: ScheduleStatus;
}

// ─── Portal Access ────────────────────────────────────────────────────────────

export interface PortalAccess extends EntityBase {
  accessCode: string;
  accessType: PartyType;
  partnerId: string | null;
  ceoId: string | null;
  // tokenHash is never sent to the browser. The raw token is returned once at creation.
  active: boolean;
  revokedAt: string | null;
  lastAccessAt: string | null;
}
