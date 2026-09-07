/**
 * CapitalOS — Calculation Integration Tests
 *
 * These tests validate the cross-cutting data pipeline:
 *   validate (Zod schema) → calculate (BigInt functions) → format (Intl)
 *
 * They catch bugs that only appear when the layers interact — for example:
 * - A validated transaction feeds the correct BigInt into a calculation
 * - A schedule's pending amounts (from the schema) match calculateScheduleStatus output
 * - Overpayment detected in calculation matches schema rejection
 * - Format layer correctly represents calculated financial positions
 *
 * Also covers:
 * - agreementBelongsTo security function (portal auth guard)
 * - profitScheduleInputSchema ↔ calculateScheduleStatus consistency
 * - Full end-to-end: parse → compute → format chain
 */

import { describe, expect, it } from "vitest";

import {
  calculateCEOPosition,
  calculateLedgerTotals,
  calculatePartnerPosition,
  calculateScheduleStatus,
  type TransactionRecord,
} from "../shared/src/financial/calculations.js";

import { formatINR, formatINRCompact, formatINRFull } from "../client/src/lib/format.js";

import {
  agreementBelongsTo,
  profitScheduleInputSchema,
  transactionInputSchema,
} from "../shared/src/validation/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTxnInput(overrides: {
  transactionType: string;
  partnerId: string | null;
  ceoId: string | null;
  direction: "IN" | "OUT";
  principalAmount: string;
  profitAmount: string;
}) {
  const principal = BigInt(overrides.principalAmount);
  const profit = BigInt(overrides.profitAmount);
  return {
    transactionCode: "TXN-2026-9999",
    transactionDate: "2026-06-01",
    agreementId: "3001",
    totalAmount: (principal + profit).toString(),
    paymentMethod: "NEFT",
    referenceNumber: null,
    notes: null,
    documentId: null,
    ...overrides,
  };
}

function txnRecord(
  type: TransactionRecord["transactionType"],
  direction: "IN" | "OUT",
  principal: bigint,
  profit: bigint,
  partnerId: string | null = null,
  ceoId: string | null = null,
): TransactionRecord {
  return {
    transactionType: type,
    principalAmount: principal,
    profitAmount: profit,
    totalAmount: principal + profit,
    direction,
    partnerId,
    ceoId,
    transactionDate: "2026-01-01",
  };
}

// ─── Validate → Calculate pipeline ───────────────────────────────────────────

describe("validate → calculate pipeline", () => {
  it("a validated PARTNER_CAPITAL_RECEIVED transaction feeds correct BigInt to calculatePartnerPosition", () => {
    const input = buildTxnInput({
      transactionType: "PARTNER_CAPITAL_RECEIVED",
      partnerId: "1001",
      ceoId: null,
      direction: "IN",
      principalAmount: "100000000", // ₹10,00,000
      profitAmount: "0",
    });

    const parsed = transactionInputSchema.parse(input);

    // Build a TransactionRecord from parsed data
    const record: TransactionRecord = {
      transactionType: parsed.transactionType,
      principalAmount: parsed.principalAmount,
      profitAmount: parsed.profitAmount,
      totalAmount: parsed.totalAmount,
      direction: parsed.direction,
      partnerId: parsed.partnerId,
      ceoId: parsed.ceoId,
      transactionDate: parsed.transactionDate,
    };

    const pos = calculatePartnerPosition("1001", [record], 0n);
    expect(pos.totalCapitalContributed).toBe(100000000n);
    expect(pos.principalOutstanding).toBe(100000000n);
    expect(pos.overpaymentDetected).toBe(false);
  });

  it("a validated CEO_CAPITAL_PROVIDED transaction feeds correct BigInt to calculateCEOPosition", () => {
    const input = buildTxnInput({
      transactionType: "CEO_CAPITAL_PROVIDED",
      partnerId: null,
      ceoId: "2001",
      direction: "OUT",
      principalAmount: "150000000", // ₹15,00,000
      profitAmount: "0",
    });

    const parsed = transactionInputSchema.parse(input);

    const record: TransactionRecord = {
      transactionType: parsed.transactionType,
      principalAmount: parsed.principalAmount,
      profitAmount: parsed.profitAmount,
      totalAmount: parsed.totalAmount,
      direction: parsed.direction,
      partnerId: parsed.partnerId,
      ceoId: parsed.ceoId,
      transactionDate: parsed.transactionDate,
    };

    const pos = calculateCEOPosition("2001", [record]);
    expect(pos.totalCapitalProvided).toBe(150000000n);
    expect(pos.principalOutstanding).toBe(150000000n);
  });

  it("validated CEO_PROFIT_RECEIVED increases totalProfitReceived — does NOT reduce principal", () => {
    const capitalInput = buildTxnInput({
      transactionType: "CEO_CAPITAL_PROVIDED",
      partnerId: null,
      ceoId: "2001",
      direction: "OUT",
      principalAmount: "100000000",
      profitAmount: "0",
    });

    const profitInput = buildTxnInput({
      transactionType: "CEO_PROFIT_RECEIVED",
      partnerId: null,
      ceoId: "2001",
      direction: "IN",
      principalAmount: "0",
      profitAmount: "5625000", // ₹56,250
    });

    const capitalParsed = transactionInputSchema.parse(capitalInput);
    const profitParsed = transactionInputSchema.parse(profitInput);

    const records: TransactionRecord[] = [capitalParsed, profitParsed].map((p) => ({
      transactionType: p.transactionType,
      principalAmount: p.principalAmount,
      profitAmount: p.profitAmount,
      totalAmount: p.totalAmount,
      direction: p.direction,
      partnerId: p.partnerId,
      ceoId: p.ceoId,
      transactionDate: p.transactionDate,
    }));

    const pos = calculateCEOPosition("2001", records);
    expect(pos.principalOutstanding).toBe(100000000n); // unchanged
    expect(pos.totalProfitReceived).toBe(5625000n);
  });

  it("multiple validated transactions aggregate correctly in ledger totals", () => {
    const inputs = [
      buildTxnInput({ transactionType: "PARTNER_CAPITAL_RECEIVED", partnerId: "1001", ceoId: null, direction: "IN", principalAmount: "100000000", profitAmount: "0" }),
      buildTxnInput({ transactionType: "PARTNER_CAPITAL_RECEIVED", partnerId: "1002", ceoId: null, direction: "IN", principalAmount: "50000000", profitAmount: "0" }),
      buildTxnInput({ transactionType: "CEO_CAPITAL_PROVIDED", partnerId: null, ceoId: "2001", direction: "OUT", principalAmount: "80000000", profitAmount: "0" }),
    ];

    const records: TransactionRecord[] = inputs.map((input) => {
      const p = transactionInputSchema.parse(input);
      return {
        transactionType: p.transactionType,
        principalAmount: p.principalAmount,
        profitAmount: p.profitAmount,
        totalAmount: p.totalAmount,
        direction: p.direction,
        partnerId: p.partnerId,
        ceoId: p.ceoId,
        transactionDate: p.transactionDate,
      };
    });

    const totals = calculateLedgerTotals(records);
    expect(totals.totalCapitalIn).toBe(150000000n); // 100L + 50L
    expect(totals.totalCapitalOut).toBe(80000000n);
  });
});

// ─── profitScheduleInputSchema ↔ calculateScheduleStatus consistency ──────────

describe("profitScheduleInputSchema ↔ calculateScheduleStatus consistency", () => {
  it("a schema-validated UPCOMING schedule matches calculateScheduleStatus output", () => {
    const scheduleInput = {
      agreementId: "3001",
      partnerId: "1001",
      ceoId: null,
      dueDate: "2099-12-31",
      expectedPrincipal: "0",
      expectedProfit: "5000000",
      paidPrincipal: "0",
      paidProfit: "0",
      principalPending: "0",
      profitPending: "5000000",
      status: "UPCOMING",
    };

    expect(profitScheduleInputSchema.safeParse(scheduleInput).success).toBe(true);

    const { status, totalPending } = calculateScheduleStatus({
      dueDate: "2099-12-31",
      expectedPrincipal: 0n,
      expectedProfit: 5000000n,
      paidPrincipal: 0n,
      paidProfit: 0n,
    }, "2026-01-01");

    expect(status).toBe("UPCOMING");
    expect(totalPending).toBe(5000000n);
  });

  it("a schema-validated PAID schedule matches calculateScheduleStatus output", () => {
    const scheduleInput = {
      agreementId: "3001",
      partnerId: "1001",
      ceoId: null,
      dueDate: "2024-06-30",
      expectedPrincipal: "0",
      expectedProfit: "5000000",
      paidPrincipal: "0",
      paidProfit: "5000000",
      principalPending: "0",
      profitPending: "0",
      status: "PAID",
    };

    expect(profitScheduleInputSchema.safeParse(scheduleInput).success).toBe(true);

    const { status, totalPending } = calculateScheduleStatus({
      dueDate: "2024-06-30",
      expectedPrincipal: 0n,
      expectedProfit: 5000000n,
      paidPrincipal: 0n,
      paidProfit: 5000000n,
    }, "2026-01-01");

    expect(status).toBe("PAID");
    expect(totalPending).toBe(0n);
  });

  it("schema rejects overpayment that calculateScheduleStatus detects as an error", () => {
    // The schema rejects paidProfit > expectedProfit
    const overpaidSchedule = {
      agreementId: "3001",
      partnerId: "1001",
      ceoId: null,
      dueDate: "2024-06-30",
      expectedPrincipal: "0",
      expectedProfit: "5000000",
      paidPrincipal: "0",
      paidProfit: "6000000", // overpayment
      principalPending: "0",
      profitPending: "0",
      status: "PAID",
    };

    expect(profitScheduleInputSchema.safeParse(overpaidSchedule).success).toBe(false);

    // And calculateScheduleStatus also detects it
    const { overpaymentDetected } = calculateScheduleStatus({
      dueDate: "2024-06-30",
      expectedPrincipal: 0n,
      expectedProfit: 5000000n,
      paidPrincipal: 0n,
      paidProfit: 6000000n,
    }, "2026-01-01");

    expect(overpaymentDetected).toBe(true);
  });

  it("pending amounts in schema and calculateScheduleStatus are consistent for partial payment", () => {
    const partial = {
      agreementId: "3001",
      partnerId: "1001",
      ceoId: null,
      dueDate: "2024-06-30",
      expectedPrincipal: "10000000",
      expectedProfit: "5000000",
      paidPrincipal: "3000000",
      paidProfit: "2000000",
      principalPending: "7000000",  // 10000000 - 3000000
      profitPending: "3000000",     // 5000000 - 2000000
      status: "PARTIALLY_PAID",
    };

    expect(profitScheduleInputSchema.safeParse(partial).success).toBe(true);

    const { principalPending, profitPending, totalPending, status } = calculateScheduleStatus({
      dueDate: "2024-06-30",
      expectedPrincipal: 10000000n,
      expectedProfit: 5000000n,
      paidPrincipal: 3000000n,
      paidProfit: 2000000n,
    }, "2026-01-01");

    // Schema-stored pending amounts must equal calculated pending amounts
    expect(principalPending).toBe(7000000n);
    expect(profitPending).toBe(3000000n);
    expect(totalPending).toBe(10000000n);
    expect(status).toBe("PARTIALLY_PAID");
  });

  it("totalPending = principalPending + profitPending for all schedule states", () => {
    const scenarios = [
      { exp: 0n, expP: 5000000n, paid: 0n, paidP: 0n, date: "2099-01-01", today: "2026-01-01" },
      { exp: 10000000n, expP: 5000000n, paid: 3000000n, paidP: 2000000n, date: "2024-06-30", today: "2026-01-01" },
      { exp: 0n, expP: 5000000n, paid: 0n, paidP: 5000000n, date: "2024-06-30", today: "2026-01-01" },
      { exp: 10000000n, expP: 0n, paid: 0n, paidP: 0n, date: "2020-01-01", today: "2026-01-01" },
    ];

    for (const s of scenarios) {
      const result = calculateScheduleStatus({
        dueDate: s.date,
        expectedPrincipal: s.exp,
        expectedProfit: s.expP,
        paidPrincipal: s.paid,
        paidProfit: s.paidP,
      }, s.today);

      expect(result.totalPending).toBe(result.principalPending + result.profitPending);
    }
  });
});

// ─── agreementBelongsTo — security guard tests ───────────────────────────────

describe("agreementBelongsTo — portal authorization guard", () => {
  it("PARTNER claiming their own agreement → true", () => {
    expect(
      agreementBelongsTo({ partyType: "PARTNER", partnerId: "1001", ceoId: null }, "PARTNER", "1001"),
    ).toBe(true);
  });

  it("PARTNER claiming another partner's agreement → false (prevents data leakage)", () => {
    expect(
      agreementBelongsTo({ partyType: "PARTNER", partnerId: "1001", ceoId: null }, "PARTNER", "1002"),
    ).toBe(false);
  });

  it("CEO claiming their own agreement → true", () => {
    expect(
      agreementBelongsTo({ partyType: "CEO", partnerId: null, ceoId: "2001" }, "CEO", "2001"),
    ).toBe(true);
  });

  it("CEO claiming another CEO's agreement → false", () => {
    expect(
      agreementBelongsTo({ partyType: "CEO", partnerId: null, ceoId: "2001" }, "CEO", "2002"),
    ).toBe(false);
  });

  it("PARTNER trying to access CEO agreement using their own ID → false", () => {
    expect(
      agreementBelongsTo({ partyType: "CEO", partnerId: null, ceoId: "2001" }, "PARTNER", "2001"),
    ).toBe(false);
  });

  it("CEO trying to access PARTNER agreement using their own ID → false", () => {
    expect(
      agreementBelongsTo({ partyType: "PARTNER", partnerId: "1001", ceoId: null }, "CEO", "1001"),
    ).toBe(false);
  });

  it("mismatched partyType even with correct ID → false", () => {
    // The partyType on the agreement is "PARTNER" but caller claims "CEO"
    expect(
      agreementBelongsTo({ partyType: "PARTNER", partnerId: "1001", ceoId: null }, "CEO", "1001"),
    ).toBe(false);
  });
});

// ─── Calculate → Format pipeline ──────────────────────────────────────────────

describe("calculate → format pipeline", () => {
  it("calculated principal outstanding formats to correct INR string", () => {
    const transactions = [
      txnRecord("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, "p1"),
      txnRecord("PARTNER_PRINCIPAL_PAID", "OUT", 300_000_00n, 0n, "p1"),
    ];
    const pos = calculatePartnerPosition("p1", transactions, 0n);

    // principalOutstanding = ₹7,00,000 = 700_000_00 paise
    const formatted = formatINR(pos.principalOutstanding);
    expect(formatted).toContain("₹");
    expect(formatted).toContain("7,00,000");
  });

  it("calculated CEO position formats total capital provided correctly", () => {
    const transactions = [
      txnRecord("CEO_CAPITAL_PROVIDED", "OUT", 1500_000_00n, 0n, null, "c1"),
    ];
    const pos = calculateCEOPosition("c1", transactions);

    // ₹15,00,000 in compact form = ₹15L
    const compact = formatINRCompact(pos.totalCapitalProvided);
    expect(compact).toBe("₹15L");
  });

  it("zero outstanding principal formats as ₹0", () => {
    const transactions = [
      txnRecord("PARTNER_CAPITAL_RECEIVED", "IN", 500_000_00n, 0n, "p1"),
      txnRecord("PARTNER_PRINCIPAL_PAID", "OUT", 500_000_00n, 0n, "p1"),
    ];
    const pos = calculatePartnerPosition("p1", transactions, 0n);

    expect(pos.principalOutstanding).toBe(0n);
    const formatted = formatINR(0n);
    expect(formatted).toContain("0");
    expect(formatted).toContain("₹");
  });

  it("crore-scale calculated value formats correctly in compact notation", () => {
    const transactions = [
      txnRecord("PARTNER_CAPITAL_RECEIVED", "IN", 5_00_00_000_00n, 0n, "p1"), // ₹5 Crore
    ];
    const pos = calculatePartnerPosition("p1", transactions, 0n);

    const compact = formatINRCompact(pos.principalOutstanding);
    expect(compact).toBe("₹5Cr");
  });

  it("profit with paise component formats with decimal using formatINRFull", () => {
    // ₹1,00,000.50 = 100_000_50 paise
    const formatted = formatINRFull(100_000_50n);
    expect(formatted).toContain(".");
    expect(formatted).toContain("₹");
  });

  it("ledger totals: net profit = totalProfitFromCEOs - totalProfitToPartners formats correctly", () => {
    const transactions = [
      txnRecord("CEO_PROFIT_RECEIVED", "IN", 0n, 50_000_00n, null, "c1"),
      txnRecord("PARTNER_PROFIT_PAID", "OUT", 0n, 30_000_00n, "p1"),
    ];
    const totals = calculateLedgerTotals(transactions);
    const net = totals.totalProfitFromCEOs - totals.totalProfitToPartners;
    expect(net).toBe(20_000_00n);

    const formatted = formatINR(net);
    expect(formatted).toContain("20,000");
    expect(formatted).toContain("₹");
  });
});

// ─── Business rule cross-checks ───────────────────────────────────────────────

describe("business rule cross-checks", () => {
  it("partner profit paid cannot exceed earned profit — schema rejects before calculation", () => {
    // If schema allows it through, calculation would clamp to 0 and set overpayment flag
    // This test confirms both layers agree

    // Schema side: profitScheduleInputSchema rejects paidProfit > expectedProfit
    const overpaidSchedule = {
      agreementId: "3001",
      partnerId: "1001",
      ceoId: null,
      dueDate: "2026-06-30",
      expectedPrincipal: "0",
      expectedProfit: "5000000",
      paidPrincipal: "0",
      paidProfit: "6000000",
      principalPending: "0",
      profitPending: "0",
      status: "PAID",
    };
    expect(profitScheduleInputSchema.safeParse(overpaidSchedule).success).toBe(false);

    // Calculation side: calculatePartnerPosition detects overpayment
    const transactions = [
      txnRecord("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, "p1"),
      txnRecord("PARTNER_PROFIT_PAID", "OUT", 0n, 60_000_00n, "p1"),
    ];
    const pos = calculatePartnerPosition("p1", transactions, 50_000_00n);
    expect(pos.overpaymentDetected).toBe(true);
    expect(pos.profitPending).toBe(0n);
  });

  it("CEO transaction rules: profit_received uses profit field, not principal field", () => {
    // This ensures the transaction type correctly routes to the right BigInt field
    const input = buildTxnInput({
      transactionType: "CEO_PROFIT_RECEIVED",
      partnerId: null,
      ceoId: "2001",
      direction: "IN",
      principalAmount: "0",
      profitAmount: "5000000",
    });

    const parsed = transactionInputSchema.parse(input);
    expect(parsed.profitAmount).toBe(5000000n);
    expect(parsed.principalAmount).toBe(0n);

    const record: TransactionRecord = {
      transactionType: parsed.transactionType,
      principalAmount: parsed.principalAmount,
      profitAmount: parsed.profitAmount,
      totalAmount: parsed.totalAmount,
      direction: parsed.direction,
      partnerId: parsed.partnerId,
      ceoId: parsed.ceoId,
      transactionDate: parsed.transactionDate,
    };

    const pos = calculateCEOPosition("2001", [record]);
    expect(pos.totalProfitReceived).toBe(5000000n);
    // Principal must remain 0 — profit received does NOT reduce outstanding principal
    expect(pos.principalOutstanding).toBe(0n);
  });

  it("partner position isolation: transactions for p2 do not affect p1 calculations", () => {
    const transactions = [
      txnRecord("PARTNER_CAPITAL_RECEIVED", "IN", 500_000_00n, 0n, "p1"),
      txnRecord("PARTNER_CAPITAL_RECEIVED", "IN", 800_000_00n, 0n, "p2"),
      txnRecord("PARTNER_PRINCIPAL_PAID", "OUT", 200_000_00n, 0n, "p2"),
      txnRecord("PARTNER_PROFIT_PAID", "OUT", 0n, 30_000_00n, "p2"),
    ];

    const pos1 = calculatePartnerPosition("p1", transactions, 0n);
    expect(pos1.totalCapitalContributed).toBe(500_000_00n);
    expect(pos1.totalPrincipalReturned).toBe(0n);
    expect(pos1.totalProfitPaid).toBe(0n);

    const pos2 = calculatePartnerPosition("p2", transactions, 30_000_00n);
    expect(pos2.totalCapitalContributed).toBe(800_000_00n);
    expect(pos2.totalPrincipalReturned).toBe(200_000_00n);
    expect(pos2.totalProfitPaid).toBe(30_000_00n);
  });

  it("schema total amount must equal principal + profit — prevents silent financial discrepancy", () => {
    // Incorrect total
    const input = {
      ...buildTxnInput({
        transactionType: "PARTNER_CAPITAL_RECEIVED",
        partnerId: "1001",
        ceoId: null,
        direction: "IN",
        principalAmount: "100000000",
        profitAmount: "0",
      }),
      totalAmount: "99999999", // wrong total
    };

    expect(transactionInputSchema.safeParse(input).success).toBe(false);
  });

  it("full Spec Scenario — validate, calculate, format all agree", () => {
    // ₹10,00,000 partner contribution + CEO deployment + partial repayments
    const ledger = [
      txnRecord("PARTNER_CAPITAL_RECEIVED", "IN", 1000_000_00n, 0n, "spec-p", null),
      txnRecord("CEO_CAPITAL_PROVIDED", "OUT", 1000_000_00n, 0n, null, "spec-c"),
      txnRecord("CEO_PRINCIPAL_RECEIVED", "IN", 200_000_00n, 0n, null, "spec-c"),
      txnRecord("CEO_PROFIT_RECEIVED", "IN", 0n, 50_000_00n, null, "spec-c"),
      txnRecord("PARTNER_PRINCIPAL_PAID", "OUT", 100_000_00n, 0n, "spec-p", null),
      txnRecord("PARTNER_PROFIT_PAID", "OUT", 0n, 30_000_00n, "spec-p", null),
    ];

    const partnerPos = calculatePartnerPosition("spec-p", ledger, 30_000_00n);
    const ceoPos = calculateCEOPosition("spec-c", ledger);
    const totals = calculateLedgerTotals(ledger);

    // Verify calculations
    expect(partnerPos.principalOutstanding).toBe(900_000_00n);
    expect(ceoPos.principalOutstanding).toBe(800_000_00n);
    expect(totals.totalCapitalIn).toBe(1000_000_00n);
    expect(totals.totalProfitFromCEOs - totals.totalProfitToPartners).toBe(20_000_00n);

    // Verify format pipeline doesn't throw
    const partnerFormatted = formatINR(partnerPos.principalOutstanding);
    const ceoFormatted = formatINRCompact(ceoPos.principalOutstanding);
    const retainedFormatted = formatINR(totals.totalProfitFromCEOs - totals.totalProfitToPartners);

    expect(partnerFormatted).toContain("9,00,000");
    expect(ceoFormatted).toContain("L");
    expect(retainedFormatted).toContain("20,000");
  });
});
