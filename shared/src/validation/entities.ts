import { z } from "zod";

import {
  PARTY_TYPES,
  PROFIT_CALCULATION_TYPES,
  PROFIT_FREQUENCIES,
  SCHEDULE_STATUSES,
  TRANSACTION_DIRECTIONS,
  TRANSACTION_TYPES,
  type Agreement,
  type PartyType,
} from "../domain.js";
import {
  catalystRowIdSchema,
  decimalRateSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneyPaiseSchema,
  optionalLongTextSchema,
  optionalRowIdSchema,
  optionalShortTextSchema,
  positiveMoneyPaiseSchema,
  requiredTextSchema,
  shortTextSchema,
  statusCodeSchema,
} from "./common.js";

const partyTypeSchema = z.enum(PARTY_TYPES);
const nullableEmailSchema = z.string().trim().email().max(255).nullable();

export const partnerInputSchema = z
  .object({
    partnerCode: shortTextSchema,
    name: shortTextSchema,
    phone: optionalShortTextSchema,
    email: nullableEmailSchema,
    address: optionalLongTextSchema,
    status: statusCodeSchema,
    notes: optionalLongTextSchema,
  })
  .strict();

export const ceoInputSchema = z
  .object({
    ceoCode: shortTextSchema,
    ceoName: shortTextSchema,
    businessName: shortTextSchema,
    phone: optionalShortTextSchema,
    email: nullableEmailSchema,
    address: optionalLongTextSchema,
    status: statusCodeSchema,
    notes: optionalLongTextSchema,
  })
  .strict();

export const agreementInputSchema = z
  .object({
    agreementCode: shortTextSchema,
    partyType: partyTypeSchema,
    agreementType: partyTypeSchema,
    partnerId: optionalRowIdSchema,
    ceoId: optionalRowIdSchema,
    capitalAmount: positiveMoneyPaiseSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
    profitCalculationType: z.enum(PROFIT_CALCULATION_TYPES),
    profitRate: decimalRateSchema.nullable(),
    fixedProfitAmount: positiveMoneyPaiseSchema.nullable(),
    customProfitTerms: optionalLongTextSchema,
    profitFrequency: z.enum(PROFIT_FREQUENCIES),
    customFrequencyTerms: optionalLongTextSchema,
    principalRepaymentTerms: requiredTextSchema,
    profitPaymentTerms: requiredTextSchema,
    status: statusCodeSchema,
    notes: optionalLongTextSchema,
    documentId: optionalRowIdSchema,
  })
  .strict()
  .superRefine((agreement, context) => {
    if (agreement.partyType !== agreement.agreementType) {
      context.addIssue({
        code: "custom",
        path: ["agreementType"],
        message: "Agreement type must match party type",
      });
    }

    addPartyOwnershipIssues(agreement, context);

    if (agreement.endDate !== null && agreement.endDate < agreement.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot be before start date",
      });
    }

    if (agreement.profitCalculationType === "FIXED") {
      requireValue(agreement.fixedProfitAmount, "fixedProfitAmount", "Fixed profit requires an amount", context);
      forbidValue(agreement.profitRate, "profitRate", "Fixed profit cannot include a percentage rate", context);
      forbidValue(agreement.customProfitTerms, "customProfitTerms", "Fixed profit cannot include custom terms", context);
    }

    if (agreement.profitCalculationType === "PERCENTAGE") {
      requireValue(agreement.profitRate, "profitRate", "Percentage profit requires a rate", context);
      forbidValue(agreement.fixedProfitAmount, "fixedProfitAmount", "Percentage profit cannot include a fixed amount", context);
      forbidValue(agreement.customProfitTerms, "customProfitTerms", "Percentage profit cannot include custom terms", context);
    }

    if (agreement.profitCalculationType === "CUSTOM") {
      requireValue(agreement.customProfitTerms, "customProfitTerms", "Custom profit requires explicit terms", context);
      forbidValue(agreement.fixedProfitAmount, "fixedProfitAmount", "Custom profit cannot include a fixed amount", context);
      forbidValue(agreement.profitRate, "profitRate", "Custom profit cannot include a percentage rate", context);
    }

    if (agreement.profitFrequency === "CUSTOM") {
      requireValue(
        agreement.customFrequencyTerms,
        "customFrequencyTerms",
        "Custom frequency requires explicit terms",
        context,
      );
    } else {
      forbidValue(
        agreement.customFrequencyTerms,
        "customFrequencyTerms",
        "Only a custom frequency can include custom frequency terms",
        context,
      );
    }
  });

export const partnerContributionInputSchema = z
  .object({
    contributionCode: shortTextSchema,
    partnerId: catalystRowIdSchema,
    agreementId: catalystRowIdSchema,
    ledgerTransactionId: optionalRowIdSchema,
    contributionDate: isoDateSchema,
    amount: positiveMoneyPaiseSchema,
    paymentMethod: shortTextSchema,
    referenceNumber: optionalShortTextSchema,
    notes: optionalLongTextSchema,
    documentId: optionalRowIdSchema,
  })
  .strict();

export const ceoInvestmentInputSchema = z
  .object({
    investmentCode: shortTextSchema,
    ceoId: catalystRowIdSchema,
    agreementId: catalystRowIdSchema,
    ledgerTransactionId: optionalRowIdSchema,
    investmentDate: isoDateSchema,
    principalAmount: positiveMoneyPaiseSchema,
    purpose: requiredTextSchema,
    paymentMethod: shortTextSchema,
    referenceNumber: optionalShortTextSchema,
    status: statusCodeSchema,
    notes: optionalLongTextSchema,
    documentId: optionalRowIdSchema,
  })
  .strict();

export const transactionInputSchema = z
  .object({
    transactionCode: shortTextSchema,
    transactionDate: isoDateSchema,
    transactionType: z.enum(TRANSACTION_TYPES),
    partnerId: optionalRowIdSchema,
    ceoId: optionalRowIdSchema,
    agreementId: optionalRowIdSchema,
    principalAmount: moneyPaiseSchema,
    profitAmount: moneyPaiseSchema,
    totalAmount: moneyPaiseSchema,
    direction: z.enum(TRANSACTION_DIRECTIONS),
    paymentMethod: shortTextSchema,
    referenceNumber: optionalShortTextSchema,
    notes: optionalLongTextSchema,
    documentId: optionalRowIdSchema,
  })
  .strict()
  .superRefine((transaction, context) => {
    if (transaction.totalAmount !== transaction.principalAmount + transaction.profitAmount) {
      context.addIssue({
        code: "custom",
        path: ["totalAmount"],
        message: "Total amount must equal principal plus profit",
      });
    }

    const expected = TRANSACTION_RULES[transaction.transactionType];
    if (transaction.direction !== expected.direction) {
      context.addIssue({
        code: "custom",
        path: ["direction"],
        message: `${transaction.transactionType} must use direction ${expected.direction}`,
      });
    }

    if (expected.partyType === "PARTNER") {
      requireValue(transaction.partnerId, "partnerId", "A Partner transaction requires a Partner", context);
      forbidValue(transaction.ceoId, "ceoId", "A Partner transaction cannot reference a CEO", context);
    } else {
      requireValue(transaction.ceoId, "ceoId", "A CEO transaction requires a CEO", context);
      forbidValue(transaction.partnerId, "partnerId", "A CEO transaction cannot reference a Partner", context);
    }

    validateAmountComponent(transaction.principalAmount, expected.principal, "principalAmount", context);
    validateAmountComponent(transaction.profitAmount, expected.profit, "profitAmount", context);
  });

export const profitScheduleInputSchema = z
  .object({
    agreementId: catalystRowIdSchema,
    partnerId: optionalRowIdSchema,
    ceoId: optionalRowIdSchema,
    dueDate: isoDateSchema,
    expectedPrincipal: moneyPaiseSchema,
    expectedProfit: moneyPaiseSchema,
    paidPrincipal: moneyPaiseSchema,
    paidProfit: moneyPaiseSchema,
    principalPending: moneyPaiseSchema,
    profitPending: moneyPaiseSchema,
    status: z.enum(SCHEDULE_STATUSES),
  })
  .strict()
  .superRefine((schedule, context) => {
    addExactlyOnePartyIssue(schedule.partnerId, schedule.ceoId, context);

    if (schedule.paidPrincipal > schedule.expectedPrincipal) {
      context.addIssue({
        code: "custom",
        path: ["paidPrincipal"],
        message: "Principal overpayment requires an explicit correction workflow",
      });
    } else if (schedule.principalPending !== schedule.expectedPrincipal - schedule.paidPrincipal) {
      context.addIssue({
        code: "custom",
        path: ["principalPending"],
        message: "Principal pending must equal expected principal minus paid principal",
      });
    }

    if (schedule.paidProfit > schedule.expectedProfit) {
      context.addIssue({
        code: "custom",
        path: ["paidProfit"],
        message: "Profit overpayment requires an explicit correction workflow",
      });
    } else if (schedule.profitPending !== schedule.expectedProfit - schedule.paidProfit) {
      context.addIssue({
        code: "custom",
        path: ["profitPending"],
        message: "Profit pending must equal expected profit minus paid profit",
      });
    }
  });

export const portalAccessInputSchema = z
  .object({
    accessCode: shortTextSchema,
    accessType: partyTypeSchema,
    partnerId: optionalRowIdSchema,
    ceoId: optionalRowIdSchema,
    tokenHash: z.string().regex(/^[a-f0-9]{64}$/, "Expected a lowercase SHA-256 token hash"),
    active: z.boolean(),
    revokedAt: isoDateTimeSchema.nullable(),
    lastAccessAt: isoDateTimeSchema.nullable(),
  })
  .strict()
  .superRefine((access, context) => {
    addTypedPartyOwnershipIssues(access.accessType, access.partnerId, access.ceoId, context);

    if (access.active && access.revokedAt !== null) {
      context.addIssue({ code: "custom", path: ["revokedAt"], message: "An active token cannot be revoked" });
    }

    if (!access.active && access.revokedAt === null) {
      context.addIssue({
        code: "custom",
        path: ["revokedAt"],
        message: "An inactive token must record when it was revoked",
      });
    }
  });

export const documentMetadataInputSchema = z
  .object({
    fileName: shortTextSchema,
    fileType: shortTextSchema,
    sizeBytes: z.union([z.bigint(), z.number().int().safe(), z.string().regex(/^\d+$/)]).transform(BigInt).pipe(z.bigint().positive()),
    storageReference: shortTextSchema,
    uploadedBy: shortTextSchema,
  })
  .strict();

export function agreementBelongsTo(
  agreement: Pick<Agreement, "partyType" | "partnerId" | "ceoId">,
  partyType: PartyType,
  partyId: string,
): boolean {
  if (agreement.partyType !== partyType) {
    return false;
  }

  return partyType === "PARTNER" ? agreement.partnerId === partyId : agreement.ceoId === partyId;
}

type RefinementContext = z.core.$RefinementCtx<unknown>;
type AmountRule = "POSITIVE" | "ZERO";

interface TransactionRule {
  partyType: PartyType;
  direction: "IN" | "OUT";
  principal: AmountRule;
  profit: AmountRule;
}

const TRANSACTION_RULES = {
  PARTNER_CAPITAL_RECEIVED: { partyType: "PARTNER", direction: "IN", principal: "POSITIVE", profit: "ZERO" },
  CEO_CAPITAL_PROVIDED: { partyType: "CEO", direction: "OUT", principal: "POSITIVE", profit: "ZERO" },
  CEO_PRINCIPAL_RECEIVED: { partyType: "CEO", direction: "IN", principal: "POSITIVE", profit: "ZERO" },
  CEO_PROFIT_RECEIVED: { partyType: "CEO", direction: "IN", principal: "ZERO", profit: "POSITIVE" },
  PARTNER_PRINCIPAL_PAID: { partyType: "PARTNER", direction: "OUT", principal: "POSITIVE", profit: "ZERO" },
  PARTNER_PROFIT_PAID: { partyType: "PARTNER", direction: "OUT", principal: "ZERO", profit: "POSITIVE" },
} as const satisfies Record<(typeof TRANSACTION_TYPES)[number], TransactionRule>;

function addPartyOwnershipIssues(
  agreement: { partyType: PartyType; partnerId: string | null; ceoId: string | null },
  context: RefinementContext,
): void {
  addTypedPartyOwnershipIssues(agreement.partyType, agreement.partnerId, agreement.ceoId, context);
}

function addTypedPartyOwnershipIssues(
  partyType: PartyType,
  partnerId: string | null,
  ceoId: string | null,
  context: RefinementContext,
): void {
  if (partyType === "PARTNER") {
    requireValue(partnerId, "partnerId", "A Partner record requires a Partner", context);
    forbidValue(ceoId, "ceoId", "A Partner record cannot reference a CEO", context);
  } else {
    requireValue(ceoId, "ceoId", "A CEO record requires a CEO", context);
    forbidValue(partnerId, "partnerId", "A CEO record cannot reference a Partner", context);
  }
}

function addExactlyOnePartyIssue(
  partnerId: string | null,
  ceoId: string | null,
  context: RefinementContext,
): void {
  if ((partnerId === null) === (ceoId === null)) {
    context.addIssue({
      code: "custom",
      path: ["partnerId"],
      message: "Exactly one of partnerId or ceoId is required",
    });
  }
}

function requireValue(
  value: unknown,
  path: string,
  message: string,
  context: RefinementContext,
): void {
  if (value === null || value === undefined) {
    context.addIssue({ code: "custom", path: [path], message });
  }
}

function forbidValue(
  value: unknown,
  path: string,
  message: string,
  context: RefinementContext,
): void {
  if (value !== null && value !== undefined) {
    context.addIssue({ code: "custom", path: [path], message });
  }
}

function validateAmountComponent(
  value: bigint,
  rule: AmountRule,
  path: string,
  context: RefinementContext,
): void {
  const valid = rule === "POSITIVE" ? value > 0n : value === 0n;
  if (!valid) {
    context.addIssue({
      code: "custom",
      path: [path],
      message: rule === "POSITIVE" ? "Amount must be greater than zero" : "Amount must be zero",
    });
  }
}