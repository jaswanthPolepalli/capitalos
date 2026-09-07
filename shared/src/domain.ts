export const PARTY_TYPES = ["PARTNER", "CEO"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const PROFIT_CALCULATION_TYPES = ["FIXED", "PERCENTAGE", "CUSTOM"] as const;
export type ProfitCalculationType = (typeof PROFIT_CALCULATION_TYPES)[number];

export const PROFIT_FREQUENCIES = [
  "ONE_TIME",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
  "CUSTOM",
] as const;
export type ProfitFrequency = (typeof PROFIT_FREQUENCIES)[number];

export const TRANSACTION_TYPES = [
  "PARTNER_CAPITAL_RECEIVED",
  "CEO_CAPITAL_PROVIDED",
  "CEO_PRINCIPAL_RECEIVED",
  "CEO_PROFIT_RECEIVED",
  "PARTNER_PRINCIPAL_PAID",
  "PARTNER_PROFIT_PAID",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_DIRECTIONS = ["IN", "OUT"] as const;
export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number];

export const SCHEDULE_STATUSES = [
  "UPCOMING",
  "DUE",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export type CatalystRowId = string;
export type MoneyPaise = bigint;
export type IsoDate = string;
export type IsoDateTime = string;
export type StatusCode = string;

export interface AuditFields {
  id: CatalystRowId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Partner extends AuditFields {
  partnerCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: StatusCode;
  notes: string | null;
}

export interface CEO extends AuditFields {
  ceoCode: string;
  ceoName: string;
  businessName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: StatusCode;
  notes: string | null;
}

export interface Agreement extends AuditFields {
  agreementCode: string;
  partyType: PartyType;
  agreementType: PartyType;
  partnerId: CatalystRowId | null;
  ceoId: CatalystRowId | null;
  capitalAmount: MoneyPaise;
  startDate: IsoDate;
  endDate: IsoDate | null;
  profitCalculationType: ProfitCalculationType;
  profitRate: string | null;
  fixedProfitAmount: MoneyPaise | null;
  customProfitTerms: string | null;
  profitFrequency: ProfitFrequency;
  customFrequencyTerms: string | null;
  principalRepaymentTerms: string;
  profitPaymentTerms: string;
  status: StatusCode;
  notes: string | null;
  documentId: CatalystRowId | null;
}

export interface PartnerContribution extends AuditFields {
  contributionCode: string;
  partnerId: CatalystRowId;
  agreementId: CatalystRowId;
  ledgerTransactionId: CatalystRowId | null;
  contributionDate: IsoDate;
  amount: MoneyPaise;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
  documentId: CatalystRowId | null;
}

export interface CEOInvestment extends AuditFields {
  investmentCode: string;
  ceoId: CatalystRowId;
  agreementId: CatalystRowId;
  ledgerTransactionId: CatalystRowId | null;
  investmentDate: IsoDate;
  principalAmount: MoneyPaise;
  purpose: string;
  paymentMethod: string;
  referenceNumber: string | null;
  status: StatusCode;
  notes: string | null;
  documentId: CatalystRowId | null;
}

export interface LedgerTransaction extends AuditFields {
  transactionCode: string;
  transactionDate: IsoDate;
  transactionType: TransactionType;
  partnerId: CatalystRowId | null;
  ceoId: CatalystRowId | null;
  agreementId: CatalystRowId | null;
  principalAmount: MoneyPaise;
  profitAmount: MoneyPaise;
  totalAmount: MoneyPaise;
  direction: TransactionDirection;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
  documentId: CatalystRowId | null;
}

export interface ProfitSchedule extends AuditFields {
  agreementId: CatalystRowId;
  partnerId: CatalystRowId | null;
  ceoId: CatalystRowId | null;
  dueDate: IsoDate;
  expectedPrincipal: MoneyPaise;
  expectedProfit: MoneyPaise;
  paidPrincipal: MoneyPaise;
  paidProfit: MoneyPaise;
  principalPending: MoneyPaise;
  profitPending: MoneyPaise;
  status: ScheduleStatus;
}

export interface PortalAccess extends AuditFields {
  accessCode: string;
  accessType: PartyType;
  partnerId: CatalystRowId | null;
  ceoId: CatalystRowId | null;
  tokenHash: string;
  active: boolean;
  revokedAt: IsoDateTime | null;
  lastAccessAt: IsoDateTime | null;
}

export interface DocumentMetadata extends AuditFields {
  fileName: string;
  fileType: string;
  sizeBytes: bigint;
  storageReference: string;
  uploadedBy: string;
}