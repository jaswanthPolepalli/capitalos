import { describe, expect, it } from "vitest";

import {
  agreementBelongsTo,
  agreementInputSchema,
  ceoInputSchema,
  ceoInvestmentInputSchema,
  documentMetadataInputSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneyPaiseSchema,
  partnerContributionInputSchema,
  partnerInputSchema,
  portalAccessInputSchema,
  positiveMoneyPaiseSchema,
  profitScheduleInputSchema,
  transactionInputSchema,
} from "../shared/src/validation/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_AGREEMENT = {
  agreementCode: "AGR-P-001",
  partyType: "PARTNER",
  agreementType: "PARTNER",
  partnerId: "1001",
  ceoId: null,
  capitalAmount: "100000000",
  startDate: "2026-04-01",
  endDate: "2027-03-31",
  profitCalculationType: "PERCENTAGE",
  profitRate: "12.5",
  fixedProfitAmount: null,
  customProfitTerms: null,
  profitFrequency: "QUARTERLY",
  customFrequencyTerms: null,
  principalRepaymentTerms: "Principal due at agreement maturity.",
  profitPaymentTerms: "Profit due within five business days of each quarter.",
  status: "ACTIVE",
  notes: null,
  documentId: null,
} as const;

const TRANSACTION_CASES = [
  ["PARTNER_CAPITAL_RECEIVED", "PARTNER", "IN", "100000000", "0"],
  ["CEO_CAPITAL_PROVIDED", "CEO", "OUT", "100000000", "0"],
  ["CEO_PRINCIPAL_RECEIVED", "CEO", "IN", "20000000", "0"],
  ["CEO_PROFIT_RECEIVED", "CEO", "IN", "0", "5000000"],
  ["PARTNER_PRINCIPAL_PAID", "PARTNER", "OUT", "10000000", "0"],
  ["PARTNER_PROFIT_PAID", "PARTNER", "OUT", "0", "3000000"],
] as const;

function buildTransaction(overrides: {
  transactionType: (typeof TRANSACTION_CASES)[number][0];
  partnerId: string | null;
  ceoId: string | null;
  direction: (typeof TRANSACTION_CASES)[number][2];
  principalAmount: string;
  profitAmount: string;
}) {
  return {
    transactionCode: "TXN-2026-0001",
    transactionDate: "2026-08-31",
    agreementId: "3001",
    totalAmount: (BigInt(overrides.principalAmount) + BigInt(overrides.profitAmount)).toString(),
    paymentMethod: "NEFT",
    referenceNumber: "N260831001",
    notes: null,
    documentId: null,
    ...overrides,
  };
}

// ─── moneyPaiseSchema ─────────────────────────────────────────────────────────

describe("moneyPaiseSchema", () => {
  it("parses integer paise without floating-point conversion", () => {
    expect(moneyPaiseSchema.parse("100000000")).toBe(100000000n);
    expect(moneyPaiseSchema.safeParse("100.50").success).toBe(false);
    expect(moneyPaiseSchema.safeParse(-1).success).toBe(false);
  });

  it("accepts bigint input directly", () => {
    expect(moneyPaiseSchema.parse(5000n)).toBe(5000n);
  });

  it("accepts integer number input", () => {
    expect(moneyPaiseSchema.parse(1000000)).toBe(1000000n);
  });

  it("accepts zero", () => {
    expect(moneyPaiseSchema.parse("0")).toBe(0n);
  });

  it("rejects negative string", () => {
    expect(moneyPaiseSchema.safeParse("-1").success).toBe(false);
  });

  it("rejects non-numeric string", () => {
    expect(moneyPaiseSchema.safeParse("abc").success).toBe(false);
  });

  it("rejects float string with decimal paise", () => {
    expect(moneyPaiseSchema.safeParse("999.99").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(moneyPaiseSchema.safeParse("").success).toBe(false);
  });
});

// ─── positiveMoneyPaiseSchema ─────────────────────────────────────────────────

describe("positiveMoneyPaiseSchema", () => {
  it("accepts positive integer string", () => {
    expect(positiveMoneyPaiseSchema.parse("1")).toBe(1n);
  });

  it("rejects zero", () => {
    expect(positiveMoneyPaiseSchema.safeParse("0").success).toBe(false);
  });

  it("rejects negative number", () => {
    expect(positiveMoneyPaiseSchema.safeParse(-100).success).toBe(false);
  });

  it("accepts large crore-level values", () => {
    expect(positiveMoneyPaiseSchema.parse("10000000000")).toBe(10000000000n);
  });
});

// ─── isoDateSchema ────────────────────────────────────────────────────────────

describe("isoDateSchema", () => {
  it("accepts a valid ISO date", () => {
    expect(() => isoDateSchema.parse("2026-04-01")).not.toThrow();
  });

  it("rejects a datetime string (with time component)", () => {
    expect(isoDateSchema.safeParse("2026-04-01T00:00:00Z").success).toBe(false);
  });

  it("rejects an invalid calendar date (Feb 30)", () => {
    expect(isoDateSchema.safeParse("2024-02-30").success).toBe(false);
  });

  it("rejects wrong format (DD/MM/YYYY)", () => {
    expect(isoDateSchema.safeParse("01/04/2026").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isoDateSchema.safeParse("").success).toBe(false);
  });

  it("rejects partial date (YYYY-MM)", () => {
    expect(isoDateSchema.safeParse("2026-04").success).toBe(false);
  });

  it("accepts last day of a month (2024-02-29, leap year)", () => {
    expect(() => isoDateSchema.parse("2024-02-29")).not.toThrow();
  });

  it("rejects Feb 29 in a non-leap year", () => {
    expect(isoDateSchema.safeParse("2023-02-29").success).toBe(false);
  });
});

// ─── isoDateTimeSchema ────────────────────────────────────────────────────────

describe("isoDateTimeSchema", () => {
  it("accepts a valid UTC datetime", () => {
    expect(() => isoDateTimeSchema.parse("2026-04-01T10:30:00Z")).not.toThrow();
  });

  it("accepts a datetime with offset", () => {
    expect(() => isoDateTimeSchema.parse("2026-04-01T10:30:00+05:30")).not.toThrow();
  });

  it("rejects a plain date string", () => {
    expect(isoDateTimeSchema.safeParse("2026-04-01").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isoDateTimeSchema.safeParse("").success).toBe(false);
  });
});

// ─── partnerInputSchema ───────────────────────────────────────────────────────

describe("partnerInputSchema", () => {
  const VALID_PARTNER = {
    partnerCode: "P-001",
    name: "Rajan Kumar",
    phone: "+91-9876543210",
    email: "rajan@example.com",
    address: "123 MG Road, Bangalore",
    status: "ACTIVE",
    notes: null,
  };

  it("accepts a valid partner", () => {
    expect(partnerInputSchema.safeParse(VALID_PARTNER).success).toBe(true);
  });

  it("accepts a partner with null optional fields", () => {
    const minimal = { ...VALID_PARTNER, phone: null, email: null, address: null, notes: null };
    expect(partnerInputSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects empty partnerCode", () => {
    expect(partnerInputSchema.safeParse({ ...VALID_PARTNER, partnerCode: "" }).success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(partnerInputSchema.safeParse({ ...VALID_PARTNER, name: "" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(partnerInputSchema.safeParse({ ...VALID_PARTNER, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects status code with lowercase letters", () => {
    expect(partnerInputSchema.safeParse({ ...VALID_PARTNER, status: "active" }).success).toBe(false);
  });

  it("rejects status code with spaces", () => {
    expect(partnerInputSchema.safeParse({ ...VALID_PARTNER, status: "IS ACTIVE" }).success).toBe(false);
  });

  it("accepts status with underscores and digits (e.g. SOFT_DELETED_2)", () => {
    expect(partnerInputSchema.safeParse({ ...VALID_PARTNER, status: "SOFT_DELETED_2" }).success).toBe(true);
  });

  it("rejects extra unknown fields (strict mode)", () => {
    expect(partnerInputSchema.safeParse({ ...VALID_PARTNER, extraField: "x" }).success).toBe(false);
  });

  it("rejects partnerCode longer than 255 characters", () => {
    expect(partnerInputSchema.safeParse({ ...VALID_PARTNER, partnerCode: "A".repeat(256) }).success).toBe(false);
  });
});

// ─── ceoInputSchema ───────────────────────────────────────────────────────────

describe("ceoInputSchema", () => {
  const VALID_CEO = {
    ceoCode: "CEO-001",
    ceoName: "Anand Sharma",
    businessName: "Sharma Enterprises",
    phone: "+91-9876543210",
    email: "anand@example.com",
    address: "456 Brigade Road, Bangalore",
    status: "ACTIVE",
    notes: null,
  };

  it("accepts a valid CEO", () => {
    expect(ceoInputSchema.safeParse(VALID_CEO).success).toBe(true);
  });

  it("rejects empty ceoName", () => {
    expect(ceoInputSchema.safeParse({ ...VALID_CEO, ceoName: "" }).success).toBe(false);
  });

  it("rejects empty businessName", () => {
    expect(ceoInputSchema.safeParse({ ...VALID_CEO, businessName: "" }).success).toBe(false);
  });

  it("rejects invalid email format", () => {
    expect(ceoInputSchema.safeParse({ ...VALID_CEO, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects extra unknown fields (strict mode)", () => {
    expect(ceoInputSchema.safeParse({ ...VALID_CEO, unknownField: true }).success).toBe(false);
  });

  it("accepts null email", () => {
    expect(ceoInputSchema.safeParse({ ...VALID_CEO, email: null }).success).toBe(true);
  });
});

// ─── agreementInputSchema ─────────────────────────────────────────────────────

describe("shared financial validation — agreementInputSchema", () => {
  it("accepts a valid percentage Partner agreement", () => {
    expect(agreementInputSchema.parse(BASE_AGREEMENT).capitalAmount).toBe(100000000n);
  });

  it("rejects ambiguous agreement ownership (both partnerId and ceoId set)", () => {
    const result = agreementInputSchema.safeParse({ ...BASE_AGREEMENT, ceoId: "2001" });
    expect(result.success).toBe(false);
  });

  it("requires explicit custom profit and frequency terms", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      profitCalculationType: "CUSTOM",
      profitRate: null,
      customProfitTerms: null,
      profitFrequency: "CUSTOM",
      customFrequencyTerms: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["customProfitTerms", "customFrequencyTerms"]),
      );
    }
  });

  it("accepts a valid FIXED profit CEO agreement", () => {
    const ceoAgreement = {
      ...BASE_AGREEMENT,
      agreementCode: "AGR-C-001",
      partyType: "CEO",
      agreementType: "CEO",
      partnerId: null,
      ceoId: "2001",
      profitCalculationType: "FIXED",
      profitRate: null,
      fixedProfitAmount: "500000",
      profitFrequency: "QUARTERLY",
    };
    expect(agreementInputSchema.safeParse(ceoAgreement).success).toBe(true);
  });

  it("FIXED profit type rejects when profitRate is also provided", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      profitCalculationType: "FIXED",
      fixedProfitAmount: "500000",
      profitRate: "12.5",
    });
    expect(result.success).toBe(false);
  });

  it("PERCENTAGE profit type rejects when fixedProfitAmount is also provided", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      profitCalculationType: "PERCENTAGE",
      profitRate: "10.0",
      fixedProfitAmount: "500000",
    });
    expect(result.success).toBe(false);
  });

  it("FIXED profit type requires fixedProfitAmount and rejects if missing", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      profitCalculationType: "FIXED",
      profitRate: null,
      fixedProfitAmount: null,
    });
    expect(result.success).toBe(false);
  });

  it("PERCENTAGE profit type requires profitRate and rejects if missing", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      profitCalculationType: "PERCENTAGE",
      profitRate: null,
    });
    expect(result.success).toBe(false);
  });

  it("CUSTOM profit type requires customProfitTerms and rejects if missing", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      profitCalculationType: "CUSTOM",
      profitRate: null,
      customProfitTerms: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects endDate before startDate", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      startDate: "2026-06-01",
      endDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0])).toContain("endDate");
    }
  });

  it("accepts null endDate (open-ended agreement)", () => {
    const result = agreementInputSchema.safeParse({ ...BASE_AGREEMENT, endDate: null });
    expect(result.success).toBe(true);
  });

  it("rejects agreement where partyType does not match agreementType", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      partyType: "PARTNER",
      agreementType: "CEO",
    });
    expect(result.success).toBe(false);
  });

  it("CUSTOM frequency requires customFrequencyTerms", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      profitFrequency: "CUSTOM",
      customFrequencyTerms: null,
    });
    expect(result.success).toBe(false);
  });

  it("non-CUSTOM frequency rejects customFrequencyTerms", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      profitFrequency: "QUARTERLY",
      customFrequencyTerms: "Every 3 months",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero capitalAmount", () => {
    const result = agreementInputSchema.safeParse({ ...BASE_AGREEMENT, capitalAmount: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects negative capitalAmount", () => {
    const result = agreementInputSchema.safeParse({ ...BASE_AGREEMENT, capitalAmount: "-100" });
    expect(result.success).toBe(false);
  });

  it("rejects missing partnerId for a PARTNER type agreement", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      partnerId: null,
      ceoId: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid CUSTOM profit agreement with all required fields", () => {
    const result = agreementInputSchema.safeParse({
      ...BASE_AGREEMENT,
      profitCalculationType: "CUSTOM",
      profitRate: null,
      fixedProfitAmount: null,
      customProfitTerms: "Profit calculated at board discretion quarterly.",
      profitFrequency: "CUSTOM",
      customFrequencyTerms: "As decided by the board.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects extra unknown fields (strict mode)", () => {
    const result = agreementInputSchema.safeParse({ ...BASE_AGREEMENT, legacyField: true });
    expect(result.success).toBe(false);
  });
});

// ─── transactionInputSchema ───────────────────────────────────────────────────

describe("shared financial validation — transactionInputSchema", () => {
  it.each(TRANSACTION_CASES)(
    "accepts %s with the required party, direction, and amount component",
    (transactionType, partyType, direction, principalAmount, profitAmount) => {
      const transaction = buildTransaction({
        transactionType,
        partnerId: partyType === "PARTNER" ? "1001" : null,
        ceoId: partyType === "CEO" ? "2001" : null,
        direction,
        principalAmount,
        profitAmount,
      });

      expect(transactionInputSchema.safeParse(transaction).success).toBe(true);
    },
  );

  it("rejects inconsistent totals and cross-party transaction links", () => {
    const result = transactionInputSchema.safeParse({
      ...buildTransaction({
        transactionType: "CEO_PROFIT_RECEIVED",
        partnerId: null,
        ceoId: "2001",
        direction: "IN",
        principalAmount: "0",
        profitAmount: "5000000",
      }),
      partnerId: "1001",
      totalAmount: "4999999",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["partnerId", "totalAmount"]),
      );
    }
  });

  it("rejects PARTNER_CAPITAL_RECEIVED with wrong direction (OUT)", () => {
    const result = transactionInputSchema.safeParse(
      buildTransaction({
        transactionType: "PARTNER_CAPITAL_RECEIVED",
        partnerId: "1001",
        ceoId: null,
        direction: "OUT",
        principalAmount: "100000000",
        profitAmount: "0",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects CEO_CAPITAL_PROVIDED with wrong direction (IN)", () => {
    const result = transactionInputSchema.safeParse(
      buildTransaction({
        transactionType: "CEO_CAPITAL_PROVIDED",
        partnerId: null,
        ceoId: "2001",
        direction: "IN",
        principalAmount: "100000000",
        profitAmount: "0",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects PARTNER transaction without partnerId", () => {
    const result = transactionInputSchema.safeParse(
      buildTransaction({
        transactionType: "PARTNER_CAPITAL_RECEIVED",
        partnerId: null,
        ceoId: null,
        direction: "IN",
        principalAmount: "100000000",
        profitAmount: "0",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects CEO transaction without ceoId", () => {
    const result = transactionInputSchema.safeParse(
      buildTransaction({
        transactionType: "CEO_CAPITAL_PROVIDED",
        partnerId: null,
        ceoId: null,
        direction: "OUT",
        principalAmount: "100000000",
        profitAmount: "0",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects PARTNER_CAPITAL_RECEIVED with non-zero profit amount", () => {
    const result = transactionInputSchema.safeParse(
      buildTransaction({
        transactionType: "PARTNER_CAPITAL_RECEIVED",
        partnerId: "1001",
        ceoId: null,
        direction: "IN",
        principalAmount: "100000000",
        profitAmount: "5000",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects CEO_PROFIT_RECEIVED with non-zero principal amount", () => {
    const result = transactionInputSchema.safeParse(
      buildTransaction({
        transactionType: "CEO_PROFIT_RECEIVED",
        partnerId: null,
        ceoId: "2001",
        direction: "IN",
        principalAmount: "5000",
        profitAmount: "5000000",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects PARTNER_CAPITAL_RECEIVED with zero principal amount", () => {
    const result = transactionInputSchema.safeParse(
      buildTransaction({
        transactionType: "PARTNER_CAPITAL_RECEIVED",
        partnerId: "1001",
        ceoId: null,
        direction: "IN",
        principalAmount: "0",
        profitAmount: "0",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects PARTNER transaction that also references a CEO", () => {
    const txn = buildTransaction({
      transactionType: "PARTNER_CAPITAL_RECEIVED",
      partnerId: "1001",
      ceoId: null,
      direction: "IN",
      principalAmount: "100000000",
      profitAmount: "0",
    });
    const result = transactionInputSchema.safeParse({ ...txn, ceoId: "2001" });
    expect(result.success).toBe(false);
  });

  it("rejects CEO transaction that also references a Partner", () => {
    const txn = buildTransaction({
      transactionType: "CEO_CAPITAL_PROVIDED",
      partnerId: null,
      ceoId: "2001",
      direction: "OUT",
      principalAmount: "100000000",
      profitAmount: "0",
    });
    const result = transactionInputSchema.safeParse({ ...txn, partnerId: "1001" });
    expect(result.success).toBe(false);
  });

  it("rejects totalAmount that is greater than principal + profit", () => {
    const result = transactionInputSchema.safeParse({
      ...buildTransaction({
        transactionType: "PARTNER_CAPITAL_RECEIVED",
        partnerId: "1001",
        ceoId: null,
        direction: "IN",
        principalAmount: "100000000",
        profitAmount: "0",
      }),
      totalAmount: "100000001",
    });
    expect(result.success).toBe(false);
  });
});

// ─── profitScheduleInputSchema ────────────────────────────────────────────────

describe("shared financial validation — profitScheduleInputSchema", () => {
  const VALID_SCHEDULE = {
    agreementId: "3001",
    partnerId: "1001",
    ceoId: null,
    dueDate: "2026-06-30",
    expectedPrincipal: "0",
    expectedProfit: "5000000",
    paidPrincipal: "0",
    paidProfit: "0",
    principalPending: "0",
    profitPending: "5000000",
    status: "UPCOMING",
  } as const;

  it("accepts a valid upcoming schedule", () => {
    expect(profitScheduleInputSchema.safeParse(VALID_SCHEDULE).success).toBe(true);
  });

  it("accepts a fully paid schedule", () => {
    const paid = {
      ...VALID_SCHEDULE,
      paidPrincipal: "0",
      paidProfit: "5000000",
      principalPending: "0",
      profitPending: "0",
      status: "PAID",
    };
    expect(profitScheduleInputSchema.safeParse(paid).success).toBe(true);
  });

  it("detects schedule overpayment instead of clamping it", () => {
    const result = profitScheduleInputSchema.safeParse({
      agreementId: "3001",
      partnerId: null,
      ceoId: "2001",
      dueDate: "2026-08-31",
      expectedPrincipal: "20000000",
      expectedProfit: "5000000",
      paidPrincipal: "20000001",
      paidProfit: "1000000",
      principalPending: "0",
      profitPending: "4000000",
      status: "PARTIALLY_PAID",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["paidPrincipal"]);
    }
  });

  it("rejects schedule with both partnerId and ceoId set", () => {
    const result = profitScheduleInputSchema.safeParse({
      ...VALID_SCHEDULE,
      ceoId: "2001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects schedule with neither partnerId nor ceoId set", () => {
    const result = profitScheduleInputSchema.safeParse({
      ...VALID_SCHEDULE,
      partnerId: null,
      ceoId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when profitPending does not match expectedProfit - paidProfit", () => {
    const result = profitScheduleInputSchema.safeParse({
      ...VALID_SCHEDULE,
      paidProfit: "1000000",
      profitPending: "9999999", // wrong: should be 4000000
    });
    expect(result.success).toBe(false);
  });

  it("rejects when principalPending does not match expectedPrincipal - paidPrincipal", () => {
    const result = profitScheduleInputSchema.safeParse({
      ...VALID_SCHEDULE,
      expectedPrincipal: "10000000",
      paidPrincipal: "3000000",
      principalPending: "9999999", // wrong: should be 7000000
    });
    expect(result.success).toBe(false);
  });

  it("detects profit overpayment", () => {
    const result = profitScheduleInputSchema.safeParse({
      ...VALID_SCHEDULE,
      paidProfit: "6000000", // more than expectedProfit = 5000000
      profitPending: "0",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a CEO schedule (partnerId null, ceoId set)", () => {
    const ceoSchedule = {
      ...VALID_SCHEDULE,
      partnerId: null,
      ceoId: "2001",
    };
    expect(profitScheduleInputSchema.safeParse(ceoSchedule).success).toBe(true);
  });
});

// ─── portalAccessInputSchema ──────────────────────────────────────────────────

describe("shared financial validation — portalAccessInputSchema", () => {
  const VALID_PORTAL = {
    accessCode: "PAL-001",
    accessType: "PARTNER",
    partnerId: "1001",
    ceoId: null,
    tokenHash: "a".repeat(64),
    active: true,
    revokedAt: null,
    lastAccessAt: null,
  } as const;

  it("requires a hashed token and exactly one portal owner", () => {
    expect(portalAccessInputSchema.safeParse(VALID_PORTAL).success).toBe(true);
    expect(portalAccessInputSchema.safeParse({ ...VALID_PORTAL, ceoId: "2001" }).success).toBe(false);
    expect(portalAccessInputSchema.safeParse({ ...VALID_PORTAL, tokenHash: "raw-token" }).success).toBe(false);
  });

  it("accepts a valid CEO portal access record", () => {
    const ceoPortal = {
      ...VALID_PORTAL,
      accessCode: "PAL-CEO-001",
      accessType: "CEO",
      partnerId: null,
      ceoId: "2001",
    };
    expect(portalAccessInputSchema.safeParse(ceoPortal).success).toBe(true);
  });

  it("rejects token hash that is not exactly 64 lowercase hex characters", () => {
    expect(portalAccessInputSchema.safeParse({ ...VALID_PORTAL, tokenHash: "a".repeat(63) }).success).toBe(false);
    expect(portalAccessInputSchema.safeParse({ ...VALID_PORTAL, tokenHash: "a".repeat(65) }).success).toBe(false);
    expect(portalAccessInputSchema.safeParse({ ...VALID_PORTAL, tokenHash: "A".repeat(64) }).success).toBe(false);
  });

  it("rejects active=true with a revokedAt date set", () => {
    const result = portalAccessInputSchema.safeParse({
      ...VALID_PORTAL,
      active: true,
      revokedAt: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects inactive token without a revokedAt date", () => {
    const result = portalAccessInputSchema.safeParse({
      ...VALID_PORTAL,
      active: false,
      revokedAt: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts inactive token with revokedAt set", () => {
    const result = portalAccessInputSchema.safeParse({
      ...VALID_PORTAL,
      active: false,
      revokedAt: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects PARTNER portal with no partnerId", () => {
    const result = portalAccessInputSchema.safeParse({
      ...VALID_PORTAL,
      partnerId: null,
      ceoId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects CEO portal with no ceoId", () => {
    const result = portalAccessInputSchema.safeParse({
      ...VALID_PORTAL,
      accessType: "CEO",
      partnerId: null,
      ceoId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra unknown fields (strict mode)", () => {
    const result = portalAccessInputSchema.safeParse({ ...VALID_PORTAL, extraField: "x" });
    expect(result.success).toBe(false);
  });
});

// ─── partnerContributionInputSchema ───────────────────────────────────────────

describe("partnerContributionInputSchema", () => {
  const VALID_CONTRIBUTION = {
    contributionCode: "CONT-001",
    partnerId: "1001",
    agreementId: "3001",
    ledgerTransactionId: null,
    contributionDate: "2026-04-15",
    amount: "100000000",
    paymentMethod: "NEFT",
    referenceNumber: "N2604150001",
    notes: null,
    documentId: null,
  };

  it("accepts a valid partner contribution", () => {
    expect(partnerContributionInputSchema.safeParse(VALID_CONTRIBUTION).success).toBe(true);
  });

  it("rejects zero amount", () => {
    expect(partnerContributionInputSchema.safeParse({ ...VALID_CONTRIBUTION, amount: "0" }).success).toBe(false);
  });

  it("rejects negative amount", () => {
    expect(partnerContributionInputSchema.safeParse({ ...VALID_CONTRIBUTION, amount: "-1000" }).success).toBe(false);
  });

  it("rejects empty contributionCode", () => {
    expect(partnerContributionInputSchema.safeParse({ ...VALID_CONTRIBUTION, contributionCode: "" }).success).toBe(false);
  });

  it("rejects invalid contributionDate format", () => {
    expect(partnerContributionInputSchema.safeParse({ ...VALID_CONTRIBUTION, contributionDate: "15-04-2026" }).success).toBe(false);
  });

  it("rejects extra unknown fields (strict mode)", () => {
    expect(partnerContributionInputSchema.safeParse({ ...VALID_CONTRIBUTION, extra: true }).success).toBe(false);
  });
});

// ─── ceoInvestmentInputSchema ─────────────────────────────────────────────────

describe("ceoInvestmentInputSchema", () => {
  const VALID_INVESTMENT = {
    investmentCode: "INV-001",
    ceoId: "2001",
    agreementId: "3001",
    ledgerTransactionId: null,
    investmentDate: "2026-04-20",
    principalAmount: "150000000",
    purpose: "Working capital for Q1 operations",
    paymentMethod: "RTGS",
    referenceNumber: "R2604200001",
    status: "ACTIVE",
    notes: null,
    documentId: null,
  };

  it("accepts a valid CEO investment", () => {
    expect(ceoInvestmentInputSchema.safeParse(VALID_INVESTMENT).success).toBe(true);
  });

  it("rejects zero principalAmount", () => {
    expect(ceoInvestmentInputSchema.safeParse({ ...VALID_INVESTMENT, principalAmount: "0" }).success).toBe(false);
  });

  it("rejects empty purpose", () => {
    expect(ceoInvestmentInputSchema.safeParse({ ...VALID_INVESTMENT, purpose: "" }).success).toBe(false);
  });

  it("rejects empty investmentCode", () => {
    expect(ceoInvestmentInputSchema.safeParse({ ...VALID_INVESTMENT, investmentCode: "" }).success).toBe(false);
  });

  it("rejects invalid status code (lowercase)", () => {
    expect(ceoInvestmentInputSchema.safeParse({ ...VALID_INVESTMENT, status: "active" }).success).toBe(false);
  });

  it("rejects extra unknown fields (strict mode)", () => {
    expect(ceoInvestmentInputSchema.safeParse({ ...VALID_INVESTMENT, extra: true }).success).toBe(false);
  });
});

// ─── documentMetadataInputSchema ──────────────────────────────────────────────

describe("documentMetadataInputSchema", () => {
  const VALID_DOC = {
    fileName: "agreement_001.pdf",
    fileType: "application/pdf",
    sizeBytes: "204800",
    storageReference: "bucket/agreements/001.pdf",
    uploadedBy: "admin-user",
  };

  it("accepts a valid document metadata record", () => {
    expect(documentMetadataInputSchema.safeParse(VALID_DOC).success).toBe(true);
  });

  it("accepts sizeBytes as a number", () => {
    expect(documentMetadataInputSchema.safeParse({ ...VALID_DOC, sizeBytes: 204800 }).success).toBe(true);
  });

  it("accepts sizeBytes as a bigint", () => {
    expect(documentMetadataInputSchema.safeParse({ ...VALID_DOC, sizeBytes: 204800n }).success).toBe(true);
  });

  it("rejects sizeBytes of zero", () => {
    expect(documentMetadataInputSchema.safeParse({ ...VALID_DOC, sizeBytes: "0" }).success).toBe(false);
  });

  it("rejects negative sizeBytes", () => {
    expect(documentMetadataInputSchema.safeParse({ ...VALID_DOC, sizeBytes: "-1" }).success).toBe(false);
  });

  it("rejects empty fileName", () => {
    expect(documentMetadataInputSchema.safeParse({ ...VALID_DOC, fileName: "" }).success).toBe(false);
  });

  it("rejects empty fileType", () => {
    expect(documentMetadataInputSchema.safeParse({ ...VALID_DOC, fileType: "" }).success).toBe(false);
  });

  it("rejects empty storageReference", () => {
    expect(documentMetadataInputSchema.safeParse({ ...VALID_DOC, storageReference: "" }).success).toBe(false);
  });

  it("rejects extra unknown fields (strict mode)", () => {
    expect(documentMetadataInputSchema.safeParse({ ...VALID_DOC, extra: true }).success).toBe(false);
  });
});

// ─── agreementBelongsTo ───────────────────────────────────────────────────────

describe("agreementBelongsTo", () => {
  it("checks agreement ownership without trusting a caller-supplied party ID", () => {
    expect(
      agreementBelongsTo(
        { partyType: "PARTNER", partnerId: "1001", ceoId: null },
        "PARTNER",
        "1001",
      ),
    ).toBe(true);
    expect(
      agreementBelongsTo(
        { partyType: "PARTNER", partnerId: "1001", ceoId: null },
        "PARTNER",
        "1002",
      ),
    ).toBe(false);
  });

  it("returns false when partyType mismatches caller's claimed type", () => {
    expect(
      agreementBelongsTo(
        { partyType: "CEO", partnerId: null, ceoId: "2001" },
        "PARTNER",
        "2001",
      ),
    ).toBe(false);
  });

  it("returns true for a CEO agreement when ceoId matches", () => {
    expect(
      agreementBelongsTo(
        { partyType: "CEO", partnerId: null, ceoId: "2001" },
        "CEO",
        "2001",
      ),
    ).toBe(true);
  });

  it("returns false for a CEO agreement when ceoId does not match", () => {
    expect(
      agreementBelongsTo(
        { partyType: "CEO", partnerId: null, ceoId: "2001" },
        "CEO",
        "9999",
      ),
    ).toBe(false);
  });

  it("returns false when PARTNER agreement is queried with a CEO id", () => {
    expect(
      agreementBelongsTo(
        { partyType: "PARTNER", partnerId: "1001", ceoId: null },
        "CEO",
        "1001",
      ),
    ).toBe(false);
  });
});
