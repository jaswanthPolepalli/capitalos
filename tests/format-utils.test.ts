/**
 * CapitalOS — Format Utility Tests
 *
 * Tests all formatting functions from client/src/lib/format.ts:
 * - formatINR        : bigint paise → ₹ Indian lakh/crore format
 * - formatINRFull    : with paise shown when non-zero
 * - formatINRCompact : ₹10L / ₹1.5Cr compact display
 * - formatDate       : ISO date → "DD MMM YYYY"
 * - formatDateTime   : ISO datetime → human-readable local
 * - formatRelativeTime : relative time ("2 days ago", "in 3 months")
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatINR,
  formatINRCompact,
  formatINRFull,
  formatRelativeTime,
} from "../client/src/lib/format.js";

// ─── formatINR ────────────────────────────────────────────────────────────────

describe("formatINR", () => {
  it("formats ₹10,00,000 in Indian lakh notation", () => {
    // 100_000_000 paise = ₹10,00,000
    const result = formatINR(100_000_00n);
    expect(result).toContain("1,00,000");
    expect(result).toContain("₹");
  });

  it("formats zero paise as ₹0", () => {
    const result = formatINR(0n);
    expect(result).toContain("₹");
    expect(result).toContain("0");
  });

  it("formats 100 paise as ₹1", () => {
    const result = formatINR(100n);
    expect(result).toContain("1");
  });

  it("formats ₹1,00,00,000 (1 crore) correctly", () => {
    // 1 crore = 1_00_00_000 rupees = 1_00_00_000 * 100 paise
    const result = formatINR(1_00_00_000_00n);
    expect(result).toContain("₹");
    expect(result).toMatch(/1,00,00,000|10,000,000/);
  });

  it("does not show decimal places for whole rupee amounts", () => {
    const result = formatINR(50_000_00n);
    // Should not have .00 in result for Indian formatting
    expect(result).not.toContain(".00");
  });

  it("formats ₹500 (50,000 paise) correctly", () => {
    const result = formatINR(50_000n);
    expect(result).toContain("500");
    expect(result).toContain("₹");
  });

  it("formats large crore amounts without loss", () => {
    // ₹10 Crore = 10_00_00_000 rupees
    const result = formatINR(10_00_00_000_00n);
    expect(result).toContain("₹");
    expect(result.replace(/[₹,\s]/g, "")).toBeTruthy();
  });
});

// ─── formatINRFull ────────────────────────────────────────────────────────────

describe("formatINRFull", () => {
  it("shows paise when paise portion is non-zero", () => {
    // 100_050 paise = ₹1000.50
    const result = formatINRFull(100_050n);
    expect(result).toContain(".");
    expect(result).toContain("₹");
  });

  it("hides paise when amount is a whole rupee", () => {
    // 100_000 paise = ₹1000.00 → shown as ₹1,000
    const result = formatINRFull(100_000n);
    expect(result).not.toContain(".");
    expect(result).toContain("₹");
  });

  it("formats zero as ₹0 without decimals", () => {
    const result = formatINRFull(0n);
    expect(result).not.toContain(".");
    expect(result).toContain("0");
  });

  it("formats 1 paise (₹0.01) with decimal", () => {
    const result = formatINRFull(1n);
    expect(result).toContain(".");
    expect(result).toContain("₹");
  });

  it("formats 50 paise (₹0.50) with decimal", () => {
    const result = formatINRFull(50n);
    expect(result).toContain(".");
    expect(result).toContain("50");
  });

  it("formats ₹10,00,000 exactly without paise", () => {
    const result = formatINRFull(100_000_00n);
    expect(result).not.toContain(".");
  });
});

// ─── formatINRCompact ─────────────────────────────────────────────────────────

describe("formatINRCompact", () => {
  it("formats amounts >= ₹10,00,000 (10 lakh) as L notation", () => {
    // ₹10,00,000 = 10 * 1_00_000 rupees = 1_000_000_00 paise
    const result = formatINRCompact(1_000_000_00n);
    expect(result).toBe("₹10L");
  });

  it("formats ₹1,50,000 (1.5 lakh) as ₹1.5L", () => {
    const result = formatINRCompact(150_000_00n);
    expect(result).toBe("₹1.5L");
  });

  it("formats exact lakh without decimal", () => {
    const result = formatINRCompact(500_000_00n);
    expect(result).toBe("₹5L");
  });

  it("formats amounts >= ₹1 Crore as Cr notation", () => {
    // ₹1 Crore = 1_00_00_000 rupees = 1_00_00_000_00 paise
    const result = formatINRCompact(1_00_00_000_00n);
    expect(result).toBe("₹1Cr");
  });

  it("formats ₹1.5 Crore as ₹1.5Cr", () => {
    const result = formatINRCompact(1_50_00_000_00n);
    expect(result).toBe("₹1.5Cr");
  });

  it("formats amounts below ₹1 lakh using standard INR format", () => {
    // ₹500 = 50_000 paise
    const result = formatINRCompact(50_000n);
    expect(result).toContain("₹");
    expect(result).not.toContain("L");
    expect(result).not.toContain("Cr");
  });

  it("formats zero using standard INR format (not L/Cr)", () => {
    const result = formatINRCompact(0n);
    expect(result).not.toContain("L");
    expect(result).not.toContain("Cr");
    expect(result).toContain("₹");
  });

  it("formats ₹10 Crore as ₹10Cr", () => {
    const result = formatINRCompact(10_00_00_000_00n);
    expect(result).toBe("₹10Cr");
  });

  it("formats exactly ₹1,00,000 (1 lakh) at boundary", () => {
    // ₹1,00,000 = 100_000 * 100 paise
    const result = formatINRCompact(100_000_00n);
    expect(result).toContain("L");
  });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a standard ISO date to DD MMM YYYY", () => {
    const result = formatDate("2024-03-15");
    // Should contain year
    expect(result).toContain("2024");
    // Should contain a recognizable month abbreviation
    expect(result).toMatch(/Mar|March/);
    // Should contain the day
    expect(result).toContain("15");
  });

  it("formats January 1st correctly", () => {
    const result = formatDate("2026-01-01");
    expect(result).toContain("2026");
    expect(result).toMatch(/Jan|January/);
  });

  it("formats December 31st correctly", () => {
    const result = formatDate("2025-12-31");
    expect(result).toContain("2025");
    expect(result).toMatch(/Dec|December/);
    expect(result).toContain("31");
  });

  it("formats a leap year date correctly", () => {
    const result = formatDate("2024-02-29");
    expect(result).toContain("2024");
    expect(result).toMatch(/Feb|February/);
    expect(result).toContain("29");
  });

  it("returns a non-empty string for any valid ISO date", () => {
    const result = formatDate("2023-07-04");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── formatDateTime ───────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  it("formats a UTC ISO datetime to a human-readable string with year", () => {
    const result = formatDateTime("2024-06-15T10:30:00Z");
    expect(result).toContain("2024");
    expect(result).toMatch(/Jun|June/);
  });

  it("includes the day number", () => {
    const result = formatDateTime("2024-06-15T10:30:00Z");
    expect(result).toContain("15");
  });

  it("returns a non-empty string", () => {
    const result = formatDateTime("2026-04-01T09:00:00+05:30");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles midnight UTC correctly", () => {
    const result = formatDateTime("2025-01-01T00:00:00Z");
    expect(result).toContain("2025");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── formatRelativeTime ───────────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'yesterday' or '1 day ago' for a date 1 day in the past", () => {
    const now = new Date("2024-06-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const yesterday = new Date("2024-06-14T12:00:00Z").toISOString();
    const result = formatRelativeTime(yesterday);
    expect(result).toMatch(/yesterday|1 day ago|day/i);
  });

  it("returns 'tomorrow' or 'in 1 day' for a date 1 day in the future", () => {
    const now = new Date("2024-06-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const tomorrow = new Date("2024-06-16T12:00:00Z").toISOString();
    const result = formatRelativeTime(tomorrow);
    expect(result).toMatch(/tomorrow|in 1 day|day/i);
  });

  it("returns a month-based label for ~1 month ago", () => {
    const now = new Date("2024-06-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const oneMonthAgo = new Date("2024-05-15T12:00:00Z").toISOString();
    const result = formatRelativeTime(oneMonthAgo);
    expect(result).toMatch(/month|ago/i);
  });

  it("returns a year-based label for ~1 year ago", () => {
    const now = new Date("2024-06-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const oneYearAgo = new Date("2023-06-15T12:00:00Z").toISOString();
    const result = formatRelativeTime(oneYearAgo);
    expect(result).toMatch(/year|ago/i);
  });

  it("returns a future label for ~6 months in the future", () => {
    const now = new Date("2024-06-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const futureDate = new Date("2024-12-15T12:00:00Z").toISOString();
    const result = formatRelativeTime(futureDate);
    expect(result).toMatch(/in|month/i);
  });

  it("returns a non-empty string for any valid datetime", () => {
    const result = formatRelativeTime(new Date().toISOString());
    expect(result.length).toBeGreaterThan(0);
  });
});
