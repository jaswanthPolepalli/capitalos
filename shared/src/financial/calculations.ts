/**
 * CapitalOS — Deterministic Financial Calculation Functions
 *
 * These functions are the authoritative implementation of financial logic.
 * They are pure, stateless, and free of any framework or browser dependency.
 *
 * Rules:
 * - All monetary values are in integer paise (bigint).
 * - The transaction ledger is the only source of truth.
 * - Manually stored balance columns are NEVER trusted.
 * - Principal and profit are always tracked separately.
 * - Overpayments are surfaced as errors, never silently clamped.
 *
 * Stage 7 implements client-side calculation over mock data.
 * The same functions will be used server-side once Catalyst Functions are live.
 */

import type { SCHEDULE_STATUSES, TRANSACTION_TYPES } from "../domain.js";

// ─── Primitive types (independent of domain.ts) ───────────────────────────────

export type MoneyPaise = bigint;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

// ─── Input shapes ──────────────────────────────────────────────────────────────

export interface TransactionRecord {
  transactionType: TransactionType;
  principalAmount: MoneyPaise;
  profitAmount: MoneyPaise;
  totalAmount: MoneyPaise;
  direction: "IN" | "OUT";
  partnerId: string | null;
  ceoId: string | null;
  transactionDate: string; // ISO date "YYYY-MM-DD"
}

export interface ScheduleRecord {
  expectedPrincipal: MoneyPaise;
  expectedProfit: MoneyPaise;
  paidPrincipal: MoneyPaise;
  paidProfit: MoneyPaise;
  dueDate: string; // ISO date "YYYY-MM-DD"
}

// ─── Output shapes ────────────────────────────────────────────────────────────

export interface PartnerPosition {
  partnerId: string;
  totalCapitalContributed: MoneyPaise;
  totalPrincipalReturned: MoneyPaise;
  principalOutstanding: MoneyPaise;
  totalProfitPaid: MoneyPaise;
  profitPending: MoneyPaise; // expected earned minus paid (from schedules)
  overpaymentDetected: boolean;
}

export interface CEOPosition {
  ceoId: string;
  totalCapitalProvided: MoneyPaise;
  totalPrincipalReturned: MoneyPaise;
  principalOutstanding: MoneyPaise;
  totalProfitReceived: MoneyPaise;
  overpaymentDetected: boolean;
}

export interface SchedulePosition {
  principalPending: MoneyPaise;
  profitPending: MoneyPaise;
  totalPending: MoneyPaise;
  status: ScheduleStatus;
  overpaymentDetected: boolean;
}

export interface LedgerTotals {
  totalCapitalIn: MoneyPaise;  // all partner capital received
  totalCapitalOut: MoneyPaise; // all CEO capital provided
  totalPrincipalFromCEOs: MoneyPaise;
  totalProfitFromCEOs: MoneyPaise;
  totalPrincipalToCEOs: MoneyPaise; // same as totalCapitalOut (principal dimension)
  totalPrincipalToPartners: MoneyPaise;
  totalProfitToPartners: MoneyPaise;
}

// ─── Partner position ─────────────────────────────────────────────────────────

/**
 * Calculate the financial position of a single Partner from the ledger.
 *
 * @param partnerId - the partner's stable ID
 * @param transactions - all ledger transactions (unfiltered)
 * @param earnedProfit - total profit the partner has earned per agreements/schedules
 */
export function calculatePartnerPosition(
  partnerId: string,
  transactions: readonly TransactionRecord[],
  earnedProfit: MoneyPaise = 0n,
): PartnerPosition {
  const partnerTxns = transactions.filter((t) => t.partnerId === partnerId);

  const totalCapitalContributed = sum(
    partnerTxns
      .filter((t) => t.transactionType === "PARTNER_CAPITAL_RECEIVED")
      .map((t) => t.principalAmount),
  );

  const totalPrincipalReturned = sum(
    partnerTxns
      .filter((t) => t.transactionType === "PARTNER_PRINCIPAL_PAID")
      .map((t) => t.principalAmount),
  );

  const totalProfitPaid = sum(
    partnerTxns
      .filter((t) => t.transactionType === "PARTNER_PROFIT_PAID")
      .map((t) => t.profitAmount),
  );

  const principalOutstanding = totalCapitalContributed - totalPrincipalReturned;
  const profitPending = earnedProfit - totalProfitPaid;

  const overpaymentDetected =
    totalPrincipalReturned > totalCapitalContributed ||
    (earnedProfit > 0n && totalProfitPaid > earnedProfit);

  return {
    partnerId,
    totalCapitalContributed,
    totalPrincipalReturned,
    principalOutstanding: principalOutstanding < 0n ? 0n : principalOutstanding,
    totalProfitPaid,
    profitPending: profitPending < 0n ? 0n : profitPending,
    overpaymentDetected,
  };
}

// ─── CEO position ─────────────────────────────────────────────────────────────

/**
 * Calculate the financial position of a single CEO from the ledger.
 *
 * @param ceoId - the CEO's stable ID
 * @param transactions - all ledger transactions (unfiltered)
 */
export function calculateCEOPosition(
  ceoId: string,
  transactions: readonly TransactionRecord[],
): CEOPosition {
  const ceoTxns = transactions.filter((t) => t.ceoId === ceoId);

  const totalCapitalProvided = sum(
    ceoTxns
      .filter((t) => t.transactionType === "CEO_CAPITAL_PROVIDED")
      .map((t) => t.principalAmount),
  );

  const totalPrincipalReturned = sum(
    ceoTxns
      .filter((t) => t.transactionType === "CEO_PRINCIPAL_RECEIVED")
      .map((t) => t.principalAmount),
  );

  const totalProfitReceived = sum(
    ceoTxns
      .filter((t) => t.transactionType === "CEO_PROFIT_RECEIVED")
      .map((t) => t.profitAmount),
  );

  const principalOutstanding = totalCapitalProvided - totalPrincipalReturned;

  const overpaymentDetected = totalPrincipalReturned > totalCapitalProvided;

  return {
    ceoId,
    totalCapitalProvided,
    totalPrincipalReturned,
    principalOutstanding: principalOutstanding < 0n ? 0n : principalOutstanding,
    totalProfitReceived,
    overpaymentDetected,
  };
}

// ─── Outstanding principal ────────────────────────────────────────────────────

export function calculateOutstandingPrincipal(
  totalProvided: MoneyPaise,
  totalReturned: MoneyPaise,
): MoneyPaise {
  if (totalReturned > totalProvided) {
    return 0n; // caller should check overpayment separately
  }
  return totalProvided - totalReturned;
}

// ─── Outstanding profit ───────────────────────────────────────────────────────

export function calculateOutstandingProfit(
  totalExpected: MoneyPaise,
  totalPaid: MoneyPaise,
): MoneyPaise {
  if (totalPaid > totalExpected) {
    return 0n; // overpayment; caller should surface this
  }
  return totalExpected - totalPaid;
}

// ─── Schedule position ────────────────────────────────────────────────────────

/**
 * Derive the status and pending amounts for a single profit schedule entry.
 *
 * @param schedule - the schedule record
 * @param today - ISO date string "YYYY-MM-DD", defaults to current date
 */
export function calculateScheduleStatus(
  schedule: ScheduleRecord,
  today: string = new Date().toISOString().slice(0, 10),
): SchedulePosition {
  const { expectedPrincipal, expectedProfit, paidPrincipal, paidProfit, dueDate } = schedule;

  const principalOverpaid = paidPrincipal > expectedPrincipal;
  const profitOverpaid = paidProfit > expectedProfit;
  const overpaymentDetected = principalOverpaid || profitOverpaid;

  const principalPending = principalOverpaid
    ? 0n
    : expectedPrincipal - paidPrincipal;
  const profitPending = profitOverpaid ? 0n : expectedProfit - paidProfit;
  const totalPending = principalPending + profitPending;

  let status: ScheduleStatus;

  if (totalPending === 0n) {
    status = "PAID";
  } else if (paidPrincipal > 0n || paidProfit > 0n) {
    status = "PARTIALLY_PAID";
  } else if (dueDate < today) {
    status = "OVERDUE";
  } else if (dueDate === today) {
    status = "DUE";
  } else {
    status = "UPCOMING";
  }

  return {
    principalPending,
    profitPending,
    totalPending,
    status,
    overpaymentDetected,
  };
}

// ─── Total pending ────────────────────────────────────────────────────────────

export function calculateTotalPending(
  principalOutstanding: MoneyPaise,
  profitPending: MoneyPaise,
): MoneyPaise {
  return principalOutstanding + profitPending;
}

// ─── Ledger totals ────────────────────────────────────────────────────────────

/**
 * Calculate aggregate ledger KPIs across all parties.
 */
export function calculateLedgerTotals(
  transactions: readonly TransactionRecord[],
): LedgerTotals {
  return {
    totalCapitalIn: sum(
      transactions
        .filter((t) => t.transactionType === "PARTNER_CAPITAL_RECEIVED")
        .map((t) => t.principalAmount),
    ),
    totalCapitalOut: sum(
      transactions
        .filter((t) => t.transactionType === "CEO_CAPITAL_PROVIDED")
        .map((t) => t.principalAmount),
    ),
    totalPrincipalFromCEOs: sum(
      transactions
        .filter((t) => t.transactionType === "CEO_PRINCIPAL_RECEIVED")
        .map((t) => t.principalAmount),
    ),
    totalProfitFromCEOs: sum(
      transactions
        .filter((t) => t.transactionType === "CEO_PROFIT_RECEIVED")
        .map((t) => t.profitAmount),
    ),
    totalPrincipalToCEOs: sum(
      transactions
        .filter((t) => t.transactionType === "CEO_CAPITAL_PROVIDED")
        .map((t) => t.principalAmount),
    ),
    totalPrincipalToPartners: sum(
      transactions
        .filter((t) => t.transactionType === "PARTNER_PRINCIPAL_PAID")
        .map((t) => t.principalAmount),
    ),
    totalProfitToPartners: sum(
      transactions
        .filter((t) => t.transactionType === "PARTNER_PROFIT_PAID")
        .map((t) => t.profitAmount),
    ),
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sum(values: MoneyPaise[]): MoneyPaise {
  return values.reduce((total, v) => total + v, 0n);
}
