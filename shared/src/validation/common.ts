import { z } from "zod";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_RATE_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const STATUS_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function isCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function toBigInt(value: bigint | number | string): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

const moneyInputSchema = z.union([
  z.bigint(),
  z.number().int().safe(),
  z.string().regex(/^\d+$/, "Use a non-negative integer number of paise"),
]);

export const catalystRowIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Expected a Catalyst ROWID")
  .brand<"CatalystRowId">();

export const isoDateSchema = z
  .string()
  .refine(isCalendarDate, "Expected a valid date in YYYY-MM-DD format")
  .brand<"IsoDate">();

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .brand<"IsoDateTime">();

export const moneyPaiseSchema = moneyInputSchema.transform(toBigInt).pipe(z.bigint().nonnegative());

export const positiveMoneyPaiseSchema = moneyInputSchema
  .transform(toBigInt)
  .pipe(z.bigint().positive());

export const decimalRateSchema = z
  .string()
  .regex(DECIMAL_RATE_PATTERN, "Expected a non-negative decimal with at most 6 decimal places")
  .refine((value) => Number(value) > 0, "Profit rate must be greater than zero");

export const statusCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(STATUS_CODE_PATTERN, "Status codes must use uppercase letters, digits, and underscores");

export const requiredTextSchema = z.string().trim().min(1).max(10_000);
export const shortTextSchema = z.string().trim().min(1).max(255);
export const optionalShortTextSchema = z.string().trim().min(1).max(255).nullable();
export const optionalLongTextSchema = z.string().trim().min(1).max(10_000).nullable();
export const optionalRowIdSchema = catalystRowIdSchema.nullable();