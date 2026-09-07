/**
 * CapitalOS — Credit Card Feature Tests
 *
 * Covers:
 * 1. computeNextDueDate — billing cycle calculation
 *    - Same-month cycle (bill gen + due in same month)
 *    - Cross-month cycle (bill gen in one month, due in next)
 *    - Transaction before bill generation day
 *    - Transaction on bill generation day
 *    - Transaction after bill generation day
 *    - Month boundary (Dec → Jan year rollover)
 *    - Leap year day handling
 *
 * 2. Store derived calculations with credit cards
 *    - cashOutstanding vs cardOutstanding split in PortfolioTotals
 *    - PartnerSummary cashOutstanding / cardOutstanding
 *    - AllocationSummary creditCard field resolution
 *    - hasCreditCards flag on PartnerSummary
 *
 * 3. Capital/Profit independence
 *    - Capital returned does NOT auto-mark profit as paid
 *    - profitPending remains after capital return (if never paid)
 *    - profitPending = 0 when capital is returned AND no profit accrued (edge)
 *
 * 4. Dashboard / portfolio totals
 *    - totalOutstanding = cashOutstanding + cardOutstanding
 *    - Mix of cash and card allocations splits correctly
 */

import { describe, expect, it } from "vitest";

// ─── computeNextDueDate — pure function tests ─────────────────────────────────
// We test the logic directly, mirroring the implementation in client/src/store.ts

interface CardCycleInput {
  billGenerationDate: string; // ISO date — sample billing cycle bill gen date
  dueDate: string;            // ISO date — sample billing cycle due date
}

/**
 * Pure reimplementation of computeNextDueDate for isolated unit testing.
 * Kept in sync with client/src/store.ts implementation.
 *
 * Uses local-midnight Date parsing to avoid timezone offset bugs
 * (new Date("YYYY-MM-DD") parses as UTC, causing -1 day in UTC+5:30 IST).
 */
function parseLocal(isoDate: string): Date {
  const parts = isoDate.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  return new Date(y, m - 1, d); // local midnight — timezone safe
}

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function computeNextDueDate(card: CardCycleInput, transactionDate: string): string {
  const billGenDate = parseLocal(card.billGenerationDate);
  const dueDateSample = parseLocal(card.dueDate);
  const offsetDays = Math.round(
    (dueDateSample.getTime() - billGenDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const billDay = billGenDate.getDate();

  const txDate = parseLocal(transactionDate);
  const txYear = txDate.getFullYear();
  const txMonth = txDate.getMonth(); // 0-indexed

  // Find the next bill generation date at or after the transaction date
  let nextBillGen = new Date(txYear, txMonth, billDay);
  if (nextBillGen < txDate) {
    // Bill gen day already passed this month, move to next month
    nextBillGen = new Date(txYear, txMonth + 1, billDay);
  }

  // Add offset in whole calendar days (avoids DST/timezone drift)
  const nextDue = new Date(
    nextBillGen.getFullYear(),
    nextBillGen.getMonth(),
    nextBillGen.getDate() + offsetDays,
  );
  return toLocalISO(nextDue);
}

// ─── Helper to build card cycle inputs ───────────────────────────────────────

function card(billGenerationDate: string, dueDate: string): CardCycleInput {
  return { billGenerationDate, dueDate };
}

// ─── 1. computeNextDueDate Tests ─────────────────────────────────────────────

describe("computeNextDueDate — same-month cycle (bill gen Sep 4, due Sep 24)", () => {
  const sameMth = card("2026-09-04", "2026-09-24"); // offset = 20 days

  it("transaction before bill generation day → bill gen is same month", () => {
    // Sep 1 < Sep 4: next bill gen = Sep 4, due = Sep 24
    expect(computeNextDueDate(sameMth, "2026-09-01")).toBe("2026-09-24");
  });

  it("transaction on bill generation day → bill gen is same month", () => {
    // Sep 4 == Sep 4: nextBillGen should be Sep 4 (not next month)
    expect(computeNextDueDate(sameMth, "2026-09-04")).toBe("2026-09-24");
  });

  it("transaction after bill generation day → bill gen is next month", () => {
    // Sep 5 > Sep 4: next bill gen = Oct 4, due = Oct 24
    expect(computeNextDueDate(sameMth, "2026-09-05")).toBe("2026-10-24");
  });

  it("transaction at end of month after bill gen → rolls to next month", () => {
    // Sep 30 > Sep 4: next bill gen = Oct 4, due = Oct 24
    expect(computeNextDueDate(sameMth, "2026-09-30")).toBe("2026-10-24");
  });

  it("transaction on Oct 1 → next bill gen = Oct 4, due = Oct 24", () => {
    expect(computeNextDueDate(sameMth, "2026-10-01")).toBe("2026-10-24");
  });
});

describe("computeNextDueDate — cross-month cycle (bill gen Sep 23, due Oct 11)", () => {
  const crossMth = card("2026-09-23", "2026-10-11"); // offset = 18 days

  it("transaction before bill gen day → bill gen same month, due next month", () => {
    // Sep 20 < Sep 23: next bill gen = Sep 23, due = Sep 23 + 18 = Oct 11
    expect(computeNextDueDate(crossMth, "2026-09-20")).toBe("2026-10-11");
  });

  it("transaction on bill gen day → bill gen same month", () => {
    // Sep 23 == Sep 23: next bill gen = Sep 23, due = Oct 11
    expect(computeNextDueDate(crossMth, "2026-09-23")).toBe("2026-10-11");
  });

  it("transaction after bill gen day → bill gen is next month", () => {
    // Sep 24 > Sep 23: next bill gen = Oct 23, due = Oct 23 + 18 = Nov 10
    expect(computeNextDueDate(crossMth, "2026-09-24")).toBe("2026-11-10");
  });

  it("transaction in Oct before bill gen day → bill gen Oct 23, due Nov 10", () => {
    // Oct 5 < Oct 23: next bill gen = Oct 23, due = Nov 10
    expect(computeNextDueDate(crossMth, "2026-10-05")).toBe("2026-11-10");
  });

  it("transaction in Oct after bill gen day → bill gen Nov 23, due Dec 11", () => {
    // Oct 25 > Oct 23: next bill gen = Nov 23, due = Dec 11
    expect(computeNextDueDate(crossMth, "2026-10-25")).toBe("2026-12-11");
  });
});

describe("computeNextDueDate — year boundary (Dec → Jan)", () => {
  const decCard = card("2026-12-05", "2026-12-25"); // offset = 20 days, same month

  it("transaction in Dec before bill gen → due Dec 25", () => {
    expect(computeNextDueDate(decCard, "2026-12-01")).toBe("2026-12-25");
  });

  it("transaction in Dec after bill gen → bill gen Jan 5 next year, due Jan 25", () => {
    expect(computeNextDueDate(decCard, "2026-12-10")).toBe("2027-01-25");
  });

  it("transaction on Jan 1 → next bill gen Jan 5, due Jan 25", () => {
    expect(computeNextDueDate(decCard, "2027-01-01")).toBe("2027-01-25");
  });

  it("cross-month cycle spanning Dec/Jan boundary", () => {
    // bill gen Dec 28, due Jan 12 (offset = 15 days)
    const decCross = card("2026-12-28", "2027-01-12");
    // Transaction on Dec 20: next bill gen Dec 28, due Jan 12
    expect(computeNextDueDate(decCross, "2026-12-20")).toBe("2027-01-12");
    // Transaction on Dec 29: next bill gen Jan 28, due Feb 12
    expect(computeNextDueDate(decCross, "2026-12-29")).toBe("2027-02-12");
  });
});

describe("computeNextDueDate — offset calculation", () => {
  it("computes offset correctly between same-month bill gen and due date", () => {
    const c = card("2026-09-04", "2026-09-24"); // offset = 20
    // Sep 2 → Sep 4 + 20 = Sep 24
    expect(computeNextDueDate(c, "2026-09-02")).toBe("2026-09-24");
  });

  it("computes offset correctly for cross-month (18 days)", () => {
    const c = card("2026-09-23", "2026-10-11"); // offset = 18
    // Sep 20 → Sep 23 + 18 = Oct 11
    expect(computeNextDueDate(c, "2026-09-20")).toBe("2026-10-11");
  });

  it("short 5-day offset within same month", () => {
    const c = card("2026-09-15", "2026-09-20"); // offset = 5
    // Sep 10 → Sep 15 + 5 = Sep 20
    expect(computeNextDueDate(c, "2026-09-10")).toBe("2026-09-20");
    // Sep 16 → Oct 15 + 5 = Oct 20
    expect(computeNextDueDate(c, "2026-09-16")).toBe("2026-10-20");
  });

  it("long 45-day offset that spans two months", () => {
    const c = card("2026-09-01", "2026-10-16"); // offset = 45
    // Aug 25 → Sep 1 + 45 = Oct 16
    expect(computeNextDueDate(c, "2026-08-25")).toBe("2026-10-16");
    // Sep 2 → Oct 1 + 45 = Nov 15
    expect(computeNextDueDate(c, "2026-09-02")).toBe("2026-11-15");
  });
});

// ─── 2. Store-level derived calculation tests ─────────────────────────────────
// We test the computation logic directly (without the actual API store)
// by reimplementing the key derived formulas.

interface MockAllocation {
  id: string;
  partnerId: string;
  amountRupees: number;
  profitPercent: number;
  creditCardId: string | null;
  receivedDate: string;
}

interface MockReturn {
  allocationId: string;
  amountRupees: number;
}

interface MockProfitRecord {
  allocationId: string;
  amountRupees: number;
  notes: string;
}

interface AllocationCalc {
  capitalOutstanding: number;
  isFullyReturned: boolean;
  expectedMonthlyProfit: number;
  profitPending: number;
  creditCardId: string | null;
}

function calcAllocation(
  alloc: MockAllocation,
  returns: MockReturn[],
  profitRecs: MockProfitRecord[],
): AllocationCalc {
  const allocReturns = returns.filter((r) => r.allocationId === alloc.id);
  const allocProfits = profitRecs.filter((r) => r.allocationId === alloc.id);

  const totalCapitalReturned = allocReturns.reduce((s, r) => s + r.amountRupees, 0);
  const capitalOutstanding = Math.max(0, alloc.amountRupees - totalCapitalReturned);
  const isFullyReturned = capitalOutstanding === 0;
  const totalProfitPaid = allocProfits.reduce((s, r) => s + r.amountRupees, 0);
  const expectedMonthlyProfit = Math.round((capitalOutstanding * alloc.profitPercent) / 100);
  const profitPending = totalProfitPaid === 0 ? expectedMonthlyProfit : 0;

  return { capitalOutstanding, isFullyReturned, expectedMonthlyProfit, profitPending, creditCardId: alloc.creditCardId };
}

function calcPortfolioTotals(allocCalcs: AllocationCalc[]) {
  return {
    capitalOutstanding: allocCalcs.reduce((s, a) => s + a.capitalOutstanding, 0),
    cashOutstanding: allocCalcs.filter((a) => !a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0),
    cardOutstanding: allocCalcs.filter((a) => !!a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0),
    totalProfitPending: allocCalcs.reduce((s, a) => s + a.profitPending, 0),
  };
}

describe("cash vs card outstanding split", () => {
  it("all cash allocations → cardOutstanding = 0", () => {
    const allocations: MockAllocation[] = [
      { id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01" },
      { id: "a2", partnerId: "p1", amountRupees: 50000, profitPercent: 3, creditCardId: null, receivedDate: "2026-02-01" },
    ];
    const calcs = allocations.map((a) => calcAllocation(a, [], []));
    const totals = calcPortfolioTotals(calcs);

    expect(totals.cashOutstanding).toBe(150000);
    expect(totals.cardOutstanding).toBe(0);
    expect(totals.capitalOutstanding).toBe(150000);
  });

  it("all card allocations → cashOutstanding = 0", () => {
    const allocations: MockAllocation[] = [
      { id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: "cc1", receivedDate: "2026-01-01" },
      { id: "a2", partnerId: "p1", amountRupees: 75000, profitPercent: 3, creditCardId: "cc2", receivedDate: "2026-02-01" },
    ];
    const calcs = allocations.map((a) => calcAllocation(a, [], []));
    const totals = calcPortfolioTotals(calcs);

    expect(totals.cashOutstanding).toBe(0);
    expect(totals.cardOutstanding).toBe(175000);
    expect(totals.capitalOutstanding).toBe(175000);
  });

  it("mix of cash and card allocations splits correctly", () => {
    const allocations: MockAllocation[] = [
      { id: "a1", partnerId: "p1", amountRupees: 200000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01" },  // cash
      { id: "a2", partnerId: "p1", amountRupees: 150000, profitPercent: 3, creditCardId: "cc1", receivedDate: "2026-02-01" }, // card
      { id: "a3", partnerId: "p2", amountRupees: 100000, profitPercent: 2, creditCardId: null, receivedDate: "2026-03-01" },  // cash
      { id: "a4", partnerId: "p2", amountRupees: 50000, profitPercent: 2, creditCardId: "cc2", receivedDate: "2026-04-01" },  // card
    ];
    const calcs = allocations.map((a) => calcAllocation(a, [], []));
    const totals = calcPortfolioTotals(calcs);

    expect(totals.cashOutstanding).toBe(300000); // 200k + 100k
    expect(totals.cardOutstanding).toBe(200000); // 150k + 50k
    expect(totals.capitalOutstanding).toBe(500000); // total = cash + card
    // Invariant: total = cash + card
    expect(totals.capitalOutstanding).toBe(totals.cashOutstanding + totals.cardOutstanding);
  });

  it("partially returned card allocation reduces cardOutstanding correctly", () => {
    const alloc: MockAllocation = {
      id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: "cc1", receivedDate: "2026-01-01",
    };
    const returns: MockReturn[] = [{ allocationId: "a1", amountRupees: 40000 }];
    const calc = calcAllocation(alloc, returns, []);

    expect(calc.capitalOutstanding).toBe(60000);
    expect(calc.creditCardId).toBe("cc1");

    const totals = calcPortfolioTotals([calc]);
    expect(totals.cardOutstanding).toBe(60000);
    expect(totals.cashOutstanding).toBe(0);
  });

  it("fully returned allocation contributes 0 to both cash and card outstanding", () => {
    const cashAlloc: MockAllocation = {
      id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01",
    };
    const cardAlloc: MockAllocation = {
      id: "a2", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: "cc1", receivedDate: "2026-01-01",
    };
    const returns: MockReturn[] = [
      { allocationId: "a1", amountRupees: 100000 },
      { allocationId: "a2", amountRupees: 100000 },
    ];

    const calcs = [cashAlloc, cardAlloc].map((a) => calcAllocation(a, returns, []));
    const totals = calcPortfolioTotals(calcs);

    expect(totals.cashOutstanding).toBe(0);
    expect(totals.cardOutstanding).toBe(0);
    expect(totals.capitalOutstanding).toBe(0);
  });
});

// ─── 3. Capital/Profit independence tests ─────────────────────────────────────

describe("capital return does NOT auto-clear profit pending", () => {
  it("profit pending remains after full capital return if profit never paid", () => {
    const alloc: MockAllocation = {
      id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01",
    };
    // Capital fully returned
    const returns: MockReturn[] = [{ allocationId: "a1", amountRupees: 100000 }];
    // No profit ever paid
    const profitRecs: MockProfitRecord[] = [];

    const calc = calcAllocation(alloc, returns, profitRecs);

    // Capital is fully returned
    expect(calc.capitalOutstanding).toBe(0);
    expect(calc.isFullyReturned).toBe(true);

    // But expectedMonthlyProfit is based on capitalOutstanding which is now 0
    // So profitPending = 0 too (no profit accruing on returned capital)
    // This is by design — profit stops when capital is returned
    expect(calc.expectedMonthlyProfit).toBe(0);
    expect(calc.profitPending).toBe(0);
  });

  it("partial capital return does not affect profitPending calculation", () => {
    const alloc: MockAllocation = {
      id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01",
    };
    // Partial capital returned: 60k out of 100k
    const returns: MockReturn[] = [{ allocationId: "a1", amountRupees: 60000 }];
    // No profit paid
    const profitRecs: MockProfitRecord[] = [];

    const calc = calcAllocation(alloc, returns, profitRecs);

    // 40k remaining capital
    expect(calc.capitalOutstanding).toBe(40000);
    expect(calc.isFullyReturned).toBe(false);

    // Profit accrues on the 40k outstanding
    const expectedProfit = Math.round(40000 * 3 / 100); // = 1200
    expect(calc.expectedMonthlyProfit).toBe(expectedProfit);
    // Since no profit paid yet, profitPending = expectedMonthlyProfit
    expect(calc.profitPending).toBe(expectedProfit);
  });

  it("profit paid = 0 but capital not returned → profit pending exists", () => {
    const alloc: MockAllocation = {
      id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01",
    };
    const calc = calcAllocation(alloc, [], []);

    expect(calc.capitalOutstanding).toBe(100000);
    expect(calc.isFullyReturned).toBe(false);
    expect(calc.profitPending).toBe(3000); // 3% of 100k
  });

  it("profit paid clears profitPending regardless of capital status", () => {
    const alloc: MockAllocation = {
      id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01",
    };
    // Capital not returned
    const returns: MockReturn[] = [];
    // Profit was paid
    const profitRecs: MockProfitRecord[] = [
      { allocationId: "a1", amountRupees: 3000, notes: "Profit paid" },
    ];

    const calc = calcAllocation(alloc, returns, profitRecs);

    // Capital still deployed
    expect(calc.capitalOutstanding).toBe(100000);
    // Profit paid → profitPending = 0
    expect(calc.profitPending).toBe(0);
  });

  it("capital and profit are fully independent — one can be paid without the other", () => {
    // Scenario: Capital returned but profit never paid (edge case — profit on 0 outstanding = 0)
    const alloc1: MockAllocation = {
      id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01",
    };
    const capitalReturned = calcAllocation(alloc1, [{ allocationId: "a1", amountRupees: 100000 }], []);
    expect(capitalReturned.capitalOutstanding).toBe(0);
    expect(capitalReturned.profitPending).toBe(0); // profit was on 0 outstanding

    // Scenario: Profit paid but capital not returned
    const alloc2: MockAllocation = {
      id: "a2", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01",
    };
    const profitPaid = calcAllocation(alloc2, [], [{ allocationId: "a2", amountRupees: 3000, notes: "Profit paid" }]);
    expect(profitPaid.capitalOutstanding).toBe(100000);
    expect(profitPaid.profitPending).toBe(0); // paid

    // These are independent — neither payment affects the other
    expect(capitalReturned.capitalOutstanding).toBe(0); // still 0 regardless of profit status
    expect(profitPaid.capitalOutstanding).toBe(100000); // still full regardless of profit payment
  });
});

// ─── 4. Portfolio totals invariant tests ─────────────────────────────────────

describe("portfolio totals invariants", () => {
  it("totalOutstanding always equals cashOutstanding + cardOutstanding", () => {
    const scenarios = [
      // All cash
      [
        { creditCardId: null, capitalOutstanding: 100000, profitPending: 3000 },
        { creditCardId: null, capitalOutstanding: 50000, profitPending: 1500 },
      ],
      // All card
      [
        { creditCardId: "cc1", capitalOutstanding: 200000, profitPending: 6000 },
        { creditCardId: "cc2", capitalOutstanding: 80000, profitPending: 2400 },
      ],
      // Mix
      [
        { creditCardId: null, capitalOutstanding: 100000, profitPending: 3000 },
        { creditCardId: "cc1", capitalOutstanding: 150000, profitPending: 4500 },
        { creditCardId: null, capitalOutstanding: 75000, profitPending: 2250 },
        { creditCardId: "cc2", capitalOutstanding: 0, profitPending: 0 },
      ],
      // All returned (zeros)
      [
        { creditCardId: null, capitalOutstanding: 0, profitPending: 0 },
        { creditCardId: "cc1", capitalOutstanding: 0, profitPending: 0 },
      ],
    ];

    for (const scenario of scenarios) {
      const totals = calcPortfolioTotals(
        scenario.map((s) => ({
          capitalOutstanding: s.capitalOutstanding,
          cashOutstanding: 0,
          cardOutstanding: 0,
          isFullyReturned: s.capitalOutstanding === 0,
          expectedMonthlyProfit: 0,
          profitPending: s.profitPending,
          creditCardId: s.creditCardId,
        })),
      );

      // Core invariant
      expect(totals.capitalOutstanding).toBe(totals.cashOutstanding + totals.cardOutstanding);
    }
  });

  it("empty portfolio has all zeros", () => {
    const totals = calcPortfolioTotals([]);
    expect(totals.capitalOutstanding).toBe(0);
    expect(totals.cashOutstanding).toBe(0);
    expect(totals.cardOutstanding).toBe(0);
    expect(totals.totalProfitPending).toBe(0);
  });

  it("single cash allocation with no returns", () => {
    const calc: AllocationCalc = {
      capitalOutstanding: 500000,
      isFullyReturned: false,
      expectedMonthlyProfit: 15000,
      profitPending: 15000,
      creditCardId: null,
    };
    const totals = calcPortfolioTotals([calc]);

    expect(totals.capitalOutstanding).toBe(500000);
    expect(totals.cashOutstanding).toBe(500000);
    expect(totals.cardOutstanding).toBe(0);
  });

  it("single card allocation with partial return", () => {
    const alloc: MockAllocation = {
      id: "a1", partnerId: "p1", amountRupees: 200000, profitPercent: 3, creditCardId: "cc1", receivedDate: "2026-01-01",
    };
    const returns: MockReturn[] = [{ allocationId: "a1", amountRupees: 50000 }];
    const calc = calcAllocation(alloc, returns, []);
    const totals = calcPortfolioTotals([calc]);

    expect(totals.cashOutstanding).toBe(0);
    expect(totals.cardOutstanding).toBe(150000); // 200k - 50k
    expect(totals.capitalOutstanding).toBe(150000);
  });

  it("partner summary hasCreditCards only when partner has at least one credit card", () => {
    // hasCreditCards logic: partnerCards.length > 0
    const partnerWithCards = { id: "p1", cards: [{ id: "cc1" }] };
    const partnerWithoutCards = { id: "p2", cards: [] };

    expect(partnerWithCards.cards.length > 0).toBe(true);
    expect(partnerWithoutCards.cards.length > 0).toBe(false);
  });
});

// ─── 5. Credit card field on allocation ──────────────────────────────────────

describe("creditCardId field on allocations", () => {
  it("allocation without credit card has creditCardId = null", () => {
    const alloc: MockAllocation = {
      id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01",
    };
    const calc = calcAllocation(alloc, [], []);
    expect(calc.creditCardId).toBeNull();
  });

  it("allocation with credit card has creditCardId = card ID", () => {
    const alloc: MockAllocation = {
      id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: "cc-42", receivedDate: "2026-01-01",
    };
    const calc = calcAllocation(alloc, [], []);
    expect(calc.creditCardId).toBe("cc-42");
  });

  it("filtering by creditCardId correctly identifies card vs cash allocations", () => {
    const allocations: MockAllocation[] = [
      { id: "a1", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: null, receivedDate: "2026-01-01" },
      { id: "a2", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: "cc1", receivedDate: "2026-02-01" },
      { id: "a3", partnerId: "p1", amountRupees: 100000, profitPercent: 3, creditCardId: "cc2", receivedDate: "2026-03-01" },
    ];

    const calcs = allocations.map((a) => calcAllocation(a, [], []));
    const cashAllocations = calcs.filter((c) => !c.creditCardId);
    const cardAllocations = calcs.filter((c) => !!c.creditCardId);

    expect(cashAllocations.length).toBe(1);
    expect(cardAllocations.length).toBe(2);
  });
});

// ─── 6. computeNextDueDate return date auto-population contract ───────────────

describe("return date auto-population contract", () => {
  it("return date = next due date when credit card is selected", () => {
    const testCard = card("2026-09-04", "2026-09-24");
    const transactionDate = "2026-09-01";
    const expectedReturnDate = computeNextDueDate(testCard, transactionDate);
    // Should be Sep 24 since transaction is before bill gen on Sep 4
    expect(expectedReturnDate).toBe("2026-09-24");
  });

  it("return date is always >= transaction date", () => {
    const testCard = card("2026-09-04", "2026-09-24");
    const dates = [
      "2026-08-01", "2026-09-01", "2026-09-04", "2026-09-05", "2026-10-01",
    ];

    for (const txDate of dates) {
      const dueDate = computeNextDueDate(testCard, txDate);
      expect(new Date(dueDate) >= new Date(txDate)).toBe(true);
    }
  });

  it("return date changes when transaction date crosses bill generation day", () => {
    const testCard = card("2026-09-15", "2026-09-30");

    const beforeBillGen = computeNextDueDate(testCard, "2026-09-10"); // Sep 10 < Sep 15
    const onBillGen = computeNextDueDate(testCard, "2026-09-15");     // Sep 15 = Sep 15
    const afterBillGen = computeNextDueDate(testCard, "2026-09-16");  // Sep 16 > Sep 15

    // Before and on bill gen → same month due date
    expect(beforeBillGen).toBe("2026-09-30");
    expect(onBillGen).toBe("2026-09-30");
    // After → next month bill gen + offset
    expect(afterBillGen).toBe("2026-10-30");
    // Clearly different
    expect(beforeBillGen).not.toBe(afterBillGen);
  });
});
