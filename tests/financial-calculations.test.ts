/**
 * CapitalOS — Financial Calculation Tests (Stage 7)
 *
 * Covers the complete business rule matrix from Section 50 of the product spec:
 * - Partner contribution → capital increase
 * - CEO capital provided → outstanding increases
 * - CEO principal received → outstanding decreases
 * - CEO profit received → profit received increases
 * - Partner principal paid → outstanding decreases
 * - Partner profit paid → profit pending decreases
 * - Partial repayment → PARTIALLY_PAID
 * - Full repayment → PAID
 * - Past unpaid due date → OVERDUE
 * - Future due date → UPCOMING
 * - Due today → DUE
 * - Overpayment detection
 * - Scenario 1 from spec (₹10,00,000 cycle)
 * - Aggregate ledger totals
 */

import { describe, expect, it } from "vitest";
import {
  calculateCEOPosition,
  calculateLedgerTotals,
  calculateOutstandingPrincipal,
  calculateOutstandingProfit,
  calculatePartnerPosition,
  calculateScheduleStatus,
  calculateTotalPending,
  type ScheduleRecord,
  type TransactionRecord,
} from "../shared/src/financial/calculations.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function txn(
  type: TransactionRecord["transactionType"],
  direction: "IN" | "OUT",
  principal: bigint,
  profit: bigint,
  partnerId: string | null = null,
  ceoId: string | null = null,
  date = "2024-01-01",
): TransactionRecord {
  return {
    transactionType: type,
    principalAmount: principal,
    profitAmount: profit,
    totalAmount: principal + profit,
    direction,
    partnerId,
    ceoId,
    transactionDate: date,
  };
}

function schedule(
  dueDate: string,
  expectedPrincipal: bigint,
  expectedProfit: bigint,
  paidPrincipal: bigint,
  paidProfit: bigint,
): ScheduleRecord {
  return { dueDate, expectedPrincipal, expectedProfit, paidPrincipal, paidProfit };
}

// ─── calculateOutstandingPrincipal ────────────────────────────────────────────

describe("calculateOutstandingPrincipal", () => {
  it("returns difference when provided > returned", () => {
    expect(calculateOutstandingPrincipal(1000_000_00n, 300_000_00n)).toBe(700_000_00n);
  });

  it("returns zero when fully repaid", () => {
    expect(calculateOutstandingPrincipal(1000_000_00n, 1000_000_00n)).toBe(0n);
  });

  it("returns zero (not negative) on overpayment", () => {
    expect(calculateOutstandingPrincipal(1000_000_00n, 1100_000_00n)).toBe(0n);
  });

  it("returns full amount when nothing returned", () => {
    expect(calculateOutstandingPrincipal(500_000_00n, 0n)).toBe(500_000_00n);
  });

  // NEW: Edge cases
  it("returns zero when both are zero", () => {
    expect(calculateOutstandingPrincipal(0n, 0n)).toBe(0n);
  });

  it("returns full amount for a tiny 1-paise principal with nothing returned", () => {
    expect(calculateOutstandingPrincipal(1n, 0n)).toBe(1n);
  });

  it("handles very large crore-scale amounts correctly", () => {
    // ₹10 Crore = 100_000_000 * 100 paise
    expect(calculateOutstandingPrincipal(100_000_000_00n, 50_000_000_00n)).toBe(50_000_000_00n);
  });
});

// ─── calculateOutstandingProfit ───────────────────────────────────────────────

describe("calculateOutstandingProfit", () => {
  it("returns correct pending profit", () => {
    expect(calculateOutstandingProfit(750_000_00n, 375_000_00n)).toBe(375_000_00n);
  });

  it("returns zero when fully paid", () => {
    expect(calculateOutstandingProfit(100_000_00n, 100_000_00n)).toBe(0n);
  });

  it("returns zero (not negative) on overpayment", () => {
    expect(calculateOutstandingProfit(100_000_00n, 150_000_00n)).toBe(0n);
  });

  // NEW: Edge cases
  it("returns full amount when nothing paid", () => {
    expect(calculateOutstandingProfit(50_000_00n, 0n)).toBe(50_000_00n);
  });

  it("returns zero when both expected and paid are zero", () => {
    expect(calculateOutstandingProfit(0n, 0n)).toBe(0n);
  });

  it("handles 1-paise profit correctly", () => {
    expect(calculateOutstandingProfit(1n, 0n)).toBe(1n);
  });
});

// ─── calculateTotalPending ────────────────────────────────────────────────────

describe("calculateTotalPending", () => {
  it("sums principal outstanding and profit pending", () => {
    expect(calculateTotalPending(500_000_00n, 75_000_00n)).toBe(575_000_00n);
  });

  it("returns zero when both are zero", () => {
    expect(calculateTotalPending(0n, 0n)).toBe(0n);
  });

  // NEW: Edge cases
  it("returns only principal when profit is zero", () => {
    expect(calculateTotalPending(200_000_00n, 0n)).toBe(200_000_00n);
  });

  it("returns only profit when principal is zero", () => {
    expect(calculateTotalPending(0n, 25_000_00n)).toBe(25_000_00n);
  });

  it("handles large combined amounts without overflow", () => {
    expect(calculateTotalPending(500_000_000_00n, 50_000_000_00n)).toBe(550_000_000_00n);
  });
});

// ─── calculateScheduleStatus ─────────────────────────────────────────────────

describe("calculateScheduleStatus", () => {
  it("returns PAID when nothing pending", () => {
    const s = schedule("2024-06-01", 0n, 75_000_00n, 0n, 75_000_00n);
    const { status, totalPending, overpaymentDetected } = calculateScheduleStatus(s, "2024-07-01");
    expect(status).toBe("PAID");
    expect(totalPending).toBe(0n);
    expect(overpaymentDetected).toBe(false);
  });

  it("returns PARTIALLY_PAID when some profit paid but not all", () => {
    const s = schedule("2024-06-01", 0n, 75_000_00n, 0n, 37_500_00n);
    const { status, profitPending } = calculateScheduleStatus(s, "2024-07-01");
    expect(status).toBe("PARTIALLY_PAID");
    expect(profitPending).toBe(37_500_00n);
  });

  it("returns PARTIALLY_PAID when some principal paid but not all", () => {
    const s = schedule("2024-06-01", 100_000_00n, 0n, 50_000_00n, 0n);
    const { status } = calculateScheduleStatus(s, "2024-07-01");
    expect(status).toBe("PARTIALLY_PAID");
  });

  it("returns OVERDUE when past due date and nothing paid", () => {
    const s = schedule("2024-01-01", 0n, 50_000_00n, 0n, 0n);
    const { status } = calculateScheduleStatus(s, "2024-06-01");
    expect(status).toBe("OVERDUE");
  });

  it("returns DUE when due date is today", () => {
    const s = schedule("2024-06-15", 0n, 50_000_00n, 0n, 0n);
    const { status } = calculateScheduleStatus(s, "2024-06-15");
    expect(status).toBe("DUE");
  });

  it("returns UPCOMING when due date is in the future", () => {
    const s = schedule("2026-03-01", 0n, 187_500_00n, 0n, 0n);
    const { status } = calculateScheduleStatus(s, "2026-01-01");
    expect(status).toBe("UPCOMING");
  });

  it("detects principal overpayment", () => {
    const s = schedule("2024-06-01", 100_000_00n, 0n, 110_000_00n, 0n);
    const { overpaymentDetected, principalPending } = calculateScheduleStatus(s, "2024-07-01");
    expect(overpaymentDetected).toBe(true);
    expect(principalPending).toBe(0n);
  });

  it("detects profit overpayment", () => {
    const s = schedule("2024-06-01", 0n, 50_000_00n, 0n, 60_000_00n);
    const { overpaymentDetected, profitPending } = calculateScheduleStatus(s, "2024-07-01");
    expect(overpaymentDetected).toBe(true);
    expect(profitPending).toBe(0n);
  });

  // NEW: Additional schedule status edge cases

  it("returns PARTIALLY_PAID even when due date has not yet passed", () => {
    // Any partial payment locks status into PARTIALLY_PAID regardless of date
    const s = schedule("2099-12-31", 100_000_00n, 10_000_00n, 50_000_00n, 0n);
    const { status } = calculateScheduleStatus(s, "2024-01-01");
    expect(status).toBe("PARTIALLY_PAID");
  });

  it("returns PARTIALLY_PAID when only profit is partial and principal fully paid", () => {
    const s = schedule("2024-06-01", 100_000_00n, 50_000_00n, 100_000_00n, 10_000_00n);
    const { status, principalPending, profitPending } = calculateScheduleStatus(s, "2024-07-01");
    expect(status).toBe("PARTIALLY_PAID");
    expect(principalPending).toBe(0n);
    expect(profitPending).toBe(40_000_00n);
  });

  it("totalPending is sum of principalPending and profitPending", () => {
    const s = schedule("2099-12-31", 100_000_00n, 50_000_00n, 20_000_00n, 10_000_00n);
    const { totalPending, principalPending, profitPending } = calculateScheduleStatus(s, "2024-01-01");
    expect(totalPending).toBe(principalPending + profitPending);
  });

  it("detects both principal and profit overpayment simultaneously", () => {
    const s = schedule("2024-06-01", 100_000_00n, 50_000_00n, 110_000_00n, 60_000_00n);
    const { overpaymentDetected, principalPending, profitPending } = calculateScheduleStatus(s, "2024-07-01");
    expect(overpaymentDetected).toBe(true);
    expect(principalPending).toBe(0n);
    expect(profitPending).toBe(0n);
  });

  it("OVERDUE takes priority over UPCOMING for zero-payment past-due schedules", () => {
    // dueDate in the past, nothing paid
    const s = schedule("2020-01-01", 0n, 1_000_00n, 0n, 0n);
    const { status } = calculateScheduleStatus(s, "2024-01-01");
    expect(status).toBe("OVERDUE");
  });

  it("schedule with zero expected amounts and zero paid is PAID", () => {
    // Edge: both expected zero → totalPending = 0 → PAID
    const s = schedule("2024-06-01", 0n, 0n, 0n, 0n);
    const { status, totalPending } = calculateScheduleStatus(s, "2024-07-01");
    expect(status).toBe("PAID");
    expect(totalPending).toBe(0n);
  });
});

// ─── calculatePartnerPosition ─────────────────────────────────────────────────

describe("calculatePartnerPosition", () => {
  const p1 = "partner-1";
  const p2 = "partner-2";

  it("computes correct position with one contribution and no returns", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, p1),
    ];
    const pos = calculatePartnerPosition(p1, txns, 0n);
    expect(pos.totalCapitalContributed).toBe(1000_000_00n);
    expect(pos.principalOutstanding).toBe(1000_000_00n);
    expect(pos.totalPrincipalReturned).toBe(0n);
    expect(pos.totalProfitPaid).toBe(0n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("computes correct position after partial principal return", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, p1),
      txn("PARTNER_PRINCIPAL_PAID", "OUT", 300_000_00n, 0n, p1),
    ];
    const pos = calculatePartnerPosition(p1, txns, 0n);
    expect(pos.totalCapitalContributed).toBe(1000_000_00n);
    expect(pos.totalPrincipalReturned).toBe(300_000_00n);
    expect(pos.principalOutstanding).toBe(700_000_00n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("computes profit pending from earned profit", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, p1),
      txn("PARTNER_PROFIT_PAID", "OUT", 0n, 30_000_00n, p1),
    ];
    const earned = 75_000_00n;
    const pos = calculatePartnerPosition(p1, txns, earned);
    expect(pos.totalProfitPaid).toBe(30_000_00n);
    expect(pos.profitPending).toBe(45_000_00n);
  });

  it("does not cross-contaminate positions between partners", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 500_000_00n, 0n, p1),
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 800_000_00n, 0n, p2),
    ];
    const pos1 = calculatePartnerPosition(p1, txns, 0n);
    const pos2 = calculatePartnerPosition(p2, txns, 0n);
    expect(pos1.totalCapitalContributed).toBe(500_000_00n);
    expect(pos2.totalCapitalContributed).toBe(800_000_00n);
  });

  it("detects principal overpayment", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 500_000_00n, 0n, p1),
      txn("PARTNER_PRINCIPAL_PAID", "OUT", 600_000_00n, 0n, p1),
    ];
    const pos = calculatePartnerPosition(p1, txns, 0n);
    expect(pos.overpaymentDetected).toBe(true);
    expect(pos.principalOutstanding).toBe(0n);
  });

  it("handles multiple contributions", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1500_000_00n, 0n, p1),
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, p1),
    ];
    const pos = calculatePartnerPosition(p1, txns, 0n);
    expect(pos.totalCapitalContributed).toBe(2500_000_00n);
    expect(pos.principalOutstanding).toBe(2500_000_00n);
  });

  // NEW: Additional partner position cases

  it("returns zero profitPending when earnedProfit is zero", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, p1),
    ];
    const pos = calculatePartnerPosition(p1, txns, 0n);
    expect(pos.profitPending).toBe(0n);
  });

  it("profitPending is zero when profit paid equals earned profit exactly", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, p1),
      txn("PARTNER_PROFIT_PAID", "OUT", 0n, 50_000_00n, p1),
    ];
    const pos = calculatePartnerPosition(p1, txns, 50_000_00n);
    expect(pos.profitPending).toBe(0n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("detects profit overpayment when paid > earned", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, p1),
      txn("PARTNER_PROFIT_PAID", "OUT", 0n, 60_000_00n, p1),
    ];
    const pos = calculatePartnerPosition(p1, txns, 50_000_00n);
    expect(pos.overpaymentDetected).toBe(true);
    expect(pos.profitPending).toBe(0n);
  });

  it("handles multiple profit payments summed correctly", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, p1),
      txn("PARTNER_PROFIT_PAID", "OUT", 0n, 10_000_00n, p1),
      txn("PARTNER_PROFIT_PAID", "OUT", 0n, 15_000_00n, p1),
      txn("PARTNER_PROFIT_PAID", "OUT", 0n, 5_000_00n, p1),
    ];
    const pos = calculatePartnerPosition(p1, txns, 50_000_00n);
    expect(pos.totalProfitPaid).toBe(30_000_00n);
    expect(pos.profitPending).toBe(20_000_00n);
  });

  it("returns all-zero position for a partner with no transactions", () => {
    const pos = calculatePartnerPosition("new-partner", [], 0n);
    expect(pos.totalCapitalContributed).toBe(0n);
    expect(pos.totalPrincipalReturned).toBe(0n);
    expect(pos.principalOutstanding).toBe(0n);
    expect(pos.totalProfitPaid).toBe(0n);
    expect(pos.profitPending).toBe(0n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("fully repaid principal shows zero outstanding with no overpayment", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 500_000_00n, 0n, p1),
      txn("PARTNER_PRINCIPAL_PAID", "OUT", 500_000_00n, 0n, p1),
    ];
    const pos = calculatePartnerPosition(p1, txns, 0n);
    expect(pos.principalOutstanding).toBe(0n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("partnerId is preserved in the returned position object", () => {
    const pos = calculatePartnerPosition("test-partner-xyz", [], 0n);
    expect(pos.partnerId).toBe("test-partner-xyz");
  });
});

// ─── calculateCEOPosition ─────────────────────────────────────────────────────

describe("calculateCEOPosition", () => {
  const c1 = "ceo-1";
  const c2 = "ceo-2";

  it("computes correct position with one investment and no repayments", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 1500_000_00n, 0n, null, c1),
    ];
    const pos = calculateCEOPosition(c1, txns);
    expect(pos.totalCapitalProvided).toBe(1500_000_00n);
    expect(pos.principalOutstanding).toBe(1500_000_00n);
    expect(pos.totalPrincipalReturned).toBe(0n);
    expect(pos.totalProfitReceived).toBe(0n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("CEO principal received decreases outstanding", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 1000_000_00n, 0n, null, c1),
      txn("CEO_PRINCIPAL_RECEIVED", "IN", 200_000_00n, 0n, null, c1),
    ];
    const pos = calculateCEOPosition(c1, txns);
    expect(pos.totalPrincipalReturned).toBe(200_000_00n);
    expect(pos.principalOutstanding).toBe(800_000_00n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("CEO profit received increases totalProfitReceived", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 1000_000_00n, 0n, null, c1),
      txn("CEO_PROFIT_RECEIVED", "IN", 0n, 56_250_00n, null, c1),
    ];
    const pos = calculateCEOPosition(c1, txns);
    expect(pos.totalProfitReceived).toBe(56_250_00n);
  });

  it("does not cross-contaminate positions between CEOs", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 1500_000_00n, 0n, null, c1),
      txn("CEO_CAPITAL_PROVIDED", "OUT", 800_000_00n, 0n, null, c2),
      txn("CEO_PRINCIPAL_RECEIVED", "IN", 300_000_00n, 0n, null, c2),
    ];
    const pos1 = calculateCEOPosition(c1, txns);
    const pos2 = calculateCEOPosition(c2, txns);
    expect(pos1.principalOutstanding).toBe(1500_000_00n);
    expect(pos2.principalOutstanding).toBe(500_000_00n);
  });

  it("detects overpayment when returned > provided", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 500_000_00n, 0n, null, c1),
      txn("CEO_PRINCIPAL_RECEIVED", "IN", 600_000_00n, 0n, null, c1),
    ];
    const pos = calculateCEOPosition(c1, txns);
    expect(pos.overpaymentDetected).toBe(true);
    expect(pos.principalOutstanding).toBe(0n);
  });

  it("fully repaid position shows zero outstanding", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 600_000_00n, 0n, null, c1),
      txn("CEO_PRINCIPAL_RECEIVED", "IN", 600_000_00n, 0n, null, c1),
    ];
    const pos = calculateCEOPosition(c1, txns);
    expect(pos.principalOutstanding).toBe(0n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  // NEW: Additional CEO position cases

  it("returns all-zero position for a CEO with no transactions", () => {
    const pos = calculateCEOPosition("new-ceo", []);
    expect(pos.totalCapitalProvided).toBe(0n);
    expect(pos.totalPrincipalReturned).toBe(0n);
    expect(pos.principalOutstanding).toBe(0n);
    expect(pos.totalProfitReceived).toBe(0n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("handles multiple CEO capital provisions summed correctly", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 500_000_00n, 0n, null, c1),
      txn("CEO_CAPITAL_PROVIDED", "OUT", 300_000_00n, 0n, null, c1),
    ];
    const pos = calculateCEOPosition(c1, txns);
    expect(pos.totalCapitalProvided).toBe(800_000_00n);
    expect(pos.principalOutstanding).toBe(800_000_00n);
  });

  it("handles multiple profit receipts summed correctly", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 1000_000_00n, 0n, null, c1),
      txn("CEO_PROFIT_RECEIVED", "IN", 0n, 20_000_00n, null, c1),
      txn("CEO_PROFIT_RECEIVED", "IN", 0n, 30_000_00n, null, c1),
    ];
    const pos = calculateCEOPosition(c1, txns);
    expect(pos.totalProfitReceived).toBe(50_000_00n);
  });

  it("handles multiple principal repayments summed correctly", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 1000_000_00n, 0n, null, c1),
      txn("CEO_PRINCIPAL_RECEIVED", "IN", 100_000_00n, 0n, null, c1),
      txn("CEO_PRINCIPAL_RECEIVED", "IN", 200_000_00n, 0n, null, c1),
    ];
    const pos = calculateCEOPosition(c1, txns);
    expect(pos.totalPrincipalReturned).toBe(300_000_00n);
    expect(pos.principalOutstanding).toBe(700_000_00n);
  });

  it("ceoId is preserved in the returned position object", () => {
    const pos = calculateCEOPosition("test-ceo-xyz", []);
    expect(pos.ceoId).toBe("test-ceo-xyz");
  });

  it("profit received does not affect outstanding principal", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 1000_000_00n, 0n, null, c1),
      txn("CEO_PROFIT_RECEIVED", "IN", 0n, 100_000_00n, null, c1),
    ];
    const pos = calculateCEOPosition(c1, txns);
    // Principal outstanding must NOT be reduced by profit received
    expect(pos.principalOutstanding).toBe(1000_000_00n);
  });
});

// ─── calculateLedgerTotals ────────────────────────────────────────────────────

describe("calculateLedgerTotals", () => {
  it("sums all transaction types correctly", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, "p1"),
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 500_000_00n, 0n, "p2"),
      txn("CEO_CAPITAL_PROVIDED", "OUT", 800_000_00n, 0n, null, "c1"),
      txn("CEO_PRINCIPAL_RECEIVED", "IN", 200_000_00n, 0n, null, "c1"),
      txn("CEO_PROFIT_RECEIVED", "IN", 0n, 40_000_00n, null, "c1"),
      txn("PARTNER_PRINCIPAL_PAID", "OUT", 300_000_00n, 0n, "p1"),
      txn("PARTNER_PROFIT_PAID", "OUT", 0n, 30_000_00n, "p1"),
    ];
    const totals = calculateLedgerTotals(txns);
    expect(totals.totalCapitalIn).toBe(1500_000_00n);
    expect(totals.totalCapitalOut).toBe(800_000_00n);
    expect(totals.totalPrincipalFromCEOs).toBe(200_000_00n);
    expect(totals.totalProfitFromCEOs).toBe(40_000_00n);
    expect(totals.totalPrincipalToPartners).toBe(300_000_00n);
    expect(totals.totalProfitToPartners).toBe(30_000_00n);
  });

  it("returns all zeros on empty ledger", () => {
    const totals = calculateLedgerTotals([]);
    expect(totals.totalCapitalIn).toBe(0n);
    expect(totals.totalCapitalOut).toBe(0n);
    expect(totals.totalPrincipalFromCEOs).toBe(0n);
    expect(totals.totalProfitFromCEOs).toBe(0n);
  });

  // NEW: Additional ledger totals cases

  it("totalPrincipalToCEOs equals totalCapitalOut (same source)", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 1000_000_00n, 0n, null, "c1"),
      txn("CEO_CAPITAL_PROVIDED", "OUT", 500_000_00n, 0n, null, "c2"),
    ];
    const totals = calculateLedgerTotals(txns);
    expect(totals.totalPrincipalToCEOs).toBe(totals.totalCapitalOut);
    expect(totals.totalPrincipalToCEOs).toBe(1500_000_00n);
  });

  it("ledger with only partner capital shows only totalCapitalIn populated", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 200_000_00n, 0n, "p1"),
    ];
    const totals = calculateLedgerTotals(txns);
    expect(totals.totalCapitalIn).toBe(200_000_00n);
    expect(totals.totalCapitalOut).toBe(0n);
    expect(totals.totalPrincipalFromCEOs).toBe(0n);
    expect(totals.totalProfitFromCEOs).toBe(0n);
    expect(totals.totalPrincipalToPartners).toBe(0n);
    expect(totals.totalProfitToPartners).toBe(0n);
  });

  it("ledger with only CEO capital shows only totalCapitalOut populated", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_CAPITAL_PROVIDED", "OUT", 300_000_00n, 0n, null, "c1"),
    ];
    const totals = calculateLedgerTotals(txns);
    expect(totals.totalCapitalIn).toBe(0n);
    expect(totals.totalCapitalOut).toBe(300_000_00n);
  });

  it("CFO net profit: profit from CEOs minus profit to partners", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_PROFIT_RECEIVED", "IN", 0n, 100_000_00n, null, "c1"),
      txn("PARTNER_PROFIT_PAID", "OUT", 0n, 70_000_00n, "p1"),
    ];
    const totals = calculateLedgerTotals(txns);
    const netProfit = totals.totalProfitFromCEOs - totals.totalProfitToPartners;
    expect(netProfit).toBe(30_000_00n);
  });

  it("accumulates multiple partners and CEOs correctly", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 100_000_00n, 0n, "p1"),
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 200_000_00n, 0n, "p2"),
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 300_000_00n, 0n, "p3"),
      txn("CEO_CAPITAL_PROVIDED", "OUT", 150_000_00n, 0n, null, "c1"),
      txn("CEO_CAPITAL_PROVIDED", "OUT", 250_000_00n, 0n, null, "c2"),
    ];
    const totals = calculateLedgerTotals(txns);
    expect(totals.totalCapitalIn).toBe(600_000_00n);
    expect(totals.totalCapitalOut).toBe(400_000_00n);
  });
});

// ─── Spec Scenario 1: full capital cycle ──────────────────────────────────────
// Section 39 of claude-code-prompt.md
//
// Partner contributes:     ₹10,00,000
// CEO receives:            ₹10,00,000
// CEO returns principal:   ₹2,00,000
// CEO pays profit:         ₹50,000
// Partner receives principal: ₹1,00,000
// Partner receives profit:    ₹30,000
//
// Expected verification across CFO, Partner, CEO views.

describe("Spec Scenario 1 — full capital cycle (Section 39)", () => {
  const pId = "spec-partner-1";
  const cId = "spec-ceo-1";

  const transactions: TransactionRecord[] = [
    txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, pId, null, "2024-01-10"),
    txn("CEO_CAPITAL_PROVIDED", "OUT", 1000_000_00n, 0n, null, cId, "2024-01-15"),
    txn("CEO_PRINCIPAL_RECEIVED", "IN", 200_000_00n, 0n, null, cId, "2024-07-01"),
    txn("CEO_PROFIT_RECEIVED", "IN", 0n, 50_000_00n, null, cId, "2024-07-01"),
    txn("PARTNER_PRINCIPAL_PAID", "OUT", 100_000_00n, 0n, pId, null, "2024-07-05"),
    txn("PARTNER_PROFIT_PAID", "OUT", 0n, 30_000_00n, pId, null, "2024-07-05"),
  ];

  it("CEO: principal outstanding = ₹10,00,000 - ₹2,00,000 = ₹8,00,000", () => {
    const pos = calculateCEOPosition(cId, transactions);
    expect(pos.totalCapitalProvided).toBe(1000_000_00n);
    expect(pos.totalPrincipalReturned).toBe(200_000_00n);
    expect(pos.principalOutstanding).toBe(800_000_00n);
    expect(pos.totalProfitReceived).toBe(50_000_00n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("Partner: principal outstanding = ₹10,00,000 - ₹1,00,000 = ₹9,00,000", () => {
    const pos = calculatePartnerPosition(pId, transactions, 30_000_00n);
    expect(pos.totalCapitalContributed).toBe(1000_000_00n);
    expect(pos.totalPrincipalReturned).toBe(100_000_00n);
    expect(pos.principalOutstanding).toBe(900_000_00n);
    expect(pos.totalProfitPaid).toBe(30_000_00n);
    expect(pos.profitPending).toBe(0n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("Ledger totals: capital in matches partner contribution", () => {
    const totals = calculateLedgerTotals(transactions);
    expect(totals.totalCapitalIn).toBe(1000_000_00n);
    expect(totals.totalCapitalOut).toBe(1000_000_00n);
    expect(totals.totalPrincipalFromCEOs).toBe(200_000_00n);
    expect(totals.totalProfitFromCEOs).toBe(50_000_00n);
    expect(totals.totalPrincipalToPartners).toBe(100_000_00n);
    expect(totals.totalProfitToPartners).toBe(30_000_00n);
  });

  it("CFO net: profit received minus profit paid = ₹20,000 retained", () => {
    const totals = calculateLedgerTotals(transactions);
    const cfoRetained = totals.totalProfitFromCEOs - totals.totalProfitToPartners;
    expect(cfoRetained).toBe(20_000_00n);
  });
});

// ─── Spec Scenario 2: Multiple Partners & CEOs ────────────────────────────────

describe("Spec Scenario 2 — multiple partners and CEOs", () => {
  const p1 = "multi-partner-1";
  const p2 = "multi-partner-2";
  const c1 = "multi-ceo-1";
  const c2 = "multi-ceo-2";

  const transactions: TransactionRecord[] = [
    // Two partners contribute
    txn("PARTNER_CAPITAL_RECEIVED", "IN", 500_000_00n, 0n, p1, null, "2024-01-01"),
    txn("PARTNER_CAPITAL_RECEIVED", "IN", 300_000_00n, 0n, p2, null, "2024-01-02"),
    // Two CEOs deploy capital
    txn("CEO_CAPITAL_PROVIDED", "OUT", 400_000_00n, 0n, null, c1, "2024-01-05"),
    txn("CEO_CAPITAL_PROVIDED", "OUT", 250_000_00n, 0n, null, c2, "2024-01-06"),
    // CEO1 repays
    txn("CEO_PRINCIPAL_RECEIVED", "IN", 100_000_00n, 0n, null, c1, "2024-06-01"),
    txn("CEO_PROFIT_RECEIVED", "IN", 0n, 30_000_00n, null, c1, "2024-06-01"),
    // CEO2 repays
    txn("CEO_PRINCIPAL_RECEIVED", "IN", 50_000_00n, 0n, null, c2, "2024-06-01"),
    txn("CEO_PROFIT_RECEIVED", "IN", 0n, 15_000_00n, null, c2, "2024-06-01"),
    // Partners receive
    txn("PARTNER_PRINCIPAL_PAID", "OUT", 80_000_00n, 0n, p1, null, "2024-06-15"),
    txn("PARTNER_PROFIT_PAID", "OUT", 0n, 25_000_00n, p1, null, "2024-06-15"),
    txn("PARTNER_PRINCIPAL_PAID", "OUT", 40_000_00n, 0n, p2, null, "2024-06-15"),
    txn("PARTNER_PROFIT_PAID", "OUT", 0n, 10_000_00n, p2, null, "2024-06-15"),
  ];

  it("partner 1 position is independent of partner 2", () => {
    const pos1 = calculatePartnerPosition(p1, transactions, 25_000_00n);
    expect(pos1.totalCapitalContributed).toBe(500_000_00n);
    expect(pos1.principalOutstanding).toBe(420_000_00n);
    expect(pos1.totalProfitPaid).toBe(25_000_00n);
    expect(pos1.profitPending).toBe(0n);
  });

  it("partner 2 position is independent of partner 1", () => {
    const pos2 = calculatePartnerPosition(p2, transactions, 10_000_00n);
    expect(pos2.totalCapitalContributed).toBe(300_000_00n);
    expect(pos2.principalOutstanding).toBe(260_000_00n);
    expect(pos2.totalProfitPaid).toBe(10_000_00n);
    expect(pos2.profitPending).toBe(0n);
  });

  it("CEO 1 position is independent of CEO 2", () => {
    const pos1 = calculateCEOPosition(c1, transactions);
    expect(pos1.totalCapitalProvided).toBe(400_000_00n);
    expect(pos1.principalOutstanding).toBe(300_000_00n);
    expect(pos1.totalProfitReceived).toBe(30_000_00n);
  });

  it("CEO 2 position is independent of CEO 1", () => {
    const pos2 = calculateCEOPosition(c2, transactions);
    expect(pos2.totalCapitalProvided).toBe(250_000_00n);
    expect(pos2.principalOutstanding).toBe(200_000_00n);
    expect(pos2.totalProfitReceived).toBe(15_000_00n);
  });

  it("ledger total profit from CEOs = 30k + 15k = 45k", () => {
    const totals = calculateLedgerTotals(transactions);
    expect(totals.totalProfitFromCEOs).toBe(45_000_00n);
  });

  it("ledger total profit to partners = 25k + 10k = 35k", () => {
    const totals = calculateLedgerTotals(transactions);
    expect(totals.totalProfitToPartners).toBe(35_000_00n);
  });

  it("CFO retains 10k profit (45k - 35k)", () => {
    const totals = calculateLedgerTotals(transactions);
    expect(totals.totalProfitFromCEOs - totals.totalProfitToPartners).toBe(10_000_00n);
  });
});

// ─── Token isolation (public portal security — non-calculation) ───────────────

describe("Position isolation — partner A cannot see partner B data", () => {
  const pA = "partner-A";
  const pB = "partner-B";

  const transactions: TransactionRecord[] = [
    txn("PARTNER_CAPITAL_RECEIVED", "IN", 500_000_00n, 0n, pA),
    txn("PARTNER_CAPITAL_RECEIVED", "IN", 800_000_00n, 0n, pB),
    txn("PARTNER_PROFIT_PAID", "OUT", 0n, 10_000_00n, pA),
  ];

  it("partner A position is not affected by partner B transactions", () => {
    const posA = calculatePartnerPosition(pA, transactions, 10_000_00n);
    const posB = calculatePartnerPosition(pB, transactions, 0n);
    expect(posA.totalCapitalContributed).toBe(500_000_00n);
    expect(posB.totalCapitalContributed).toBe(800_000_00n);
    expect(posA.totalProfitPaid).toBe(10_000_00n);
    expect(posB.totalProfitPaid).toBe(0n);
  });
});

describe("Position isolation — CEO A cannot see CEO B data", () => {
  const cA = "ceo-A";
  const cB = "ceo-B";

  const transactions: TransactionRecord[] = [
    txn("CEO_CAPITAL_PROVIDED", "OUT", 1000_000_00n, 0n, null, cA),
    txn("CEO_CAPITAL_PROVIDED", "OUT", 600_000_00n, 0n, null, cB),
    txn("CEO_PRINCIPAL_RECEIVED", "IN", 400_000_00n, 0n, null, cB),
  ];

  it("CEO A position is not reduced by CEO B repayments", () => {
    const posA = calculateCEOPosition(cA, transactions);
    const posB = calculateCEOPosition(cB, transactions);
    expect(posA.principalOutstanding).toBe(1000_000_00n);
    expect(posB.principalOutstanding).toBe(200_000_00n);
  });
});

// ─── Boundary / edge case scenarios ───────────────────────────────────────────

describe("Boundary and edge case scenarios", () => {
  it("single 1-paise transaction is handled without loss", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1n, 0n, "p-edge"),
    ];
    const pos = calculatePartnerPosition("p-edge", txns, 0n);
    expect(pos.totalCapitalContributed).toBe(1n);
    expect(pos.principalOutstanding).toBe(1n);
  });

  it("transactions for unknown party ID return zero position", () => {
    const txns: TransactionRecord[] = [
      txn("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, "known-partner"),
    ];
    const pos = calculatePartnerPosition("unknown-partner", txns, 0n);
    expect(pos.totalCapitalContributed).toBe(0n);
    expect(pos.principalOutstanding).toBe(0n);
  });

  it("a ledger with only CEO profit received does not affect capital totals", () => {
    const txns: TransactionRecord[] = [
      txn("CEO_PROFIT_RECEIVED", "IN", 0n, 5_000_00n, null, "c-only-profit"),
    ];
    const totals = calculateLedgerTotals(txns);
    expect(totals.totalCapitalIn).toBe(0n);
    expect(totals.totalCapitalOut).toBe(0n);
    expect(totals.totalProfitFromCEOs).toBe(5_000_00n);
  });

  it("calculateTotalPending: large values do not lose bigint precision", () => {
    // ₹100 Crore principal + ₹10 Crore profit
    const principal = 100_00_00_000_00n;
    const profit = 10_00_00_000_00n;
    expect(calculateTotalPending(principal, profit)).toBe(110_00_00_000_00n);
  });
});
