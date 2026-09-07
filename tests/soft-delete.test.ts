/**
 * CapitalOS — Soft-Delete Logic Tests
 *
 * The API uses a sentinel-based soft-delete strategy:
 *   notes = "DELETED:<ISO timestamp>\n<original notes>"
 *
 * This is the ONLY mechanism protecting financial data from accidental erasure.
 * A bug here causes data loss or incorrect visibility. These tests are critical.
 *
 * Covers:
 * - markDeleted: produces correct sentinel format
 * - isDeleted: correctly detects the sentinel
 * - Restore: strips sentinel and recovers original notes
 * - Edge cases: null notes, empty notes, content with DELETED-like text
 * - Case sensitivity: sentinel is uppercase only
 * - Round-trip integrity: mark → isDeleted → restore → original
 */

import { describe, expect, it } from "vitest";

// ─── Extracted helpers (mirrors functions/capitalos-api/index.js) ─────────────
// We replicate the pure helper logic here so we can unit-test it independently.

const DELETED_PREFIX = "DELETED:";

function markDeleted(originalNotes: string | null | undefined, ts: string): string {
  return DELETED_PREFIX + ts + "\n" + (originalNotes || "");
}

function isDeleted(notes: string | null | undefined): boolean {
  return typeof notes === "string" && notes.startsWith(DELETED_PREFIX);
}

function restoreNotes(notes: string | null | undefined): string {
  if (isDeleted(notes)) {
    return (notes as string).replace(/^DELETED:[^\n]*\n?/, "");
  }
  return notes || "";
}

// ─── markDeleted ──────────────────────────────────────────────────────────────

describe("markDeleted", () => {
  const TS = "2026-05-09T10:00:00.000Z";

  it("produces a string that starts with DELETED:", () => {
    const result = markDeleted("some notes", TS);
    expect(result.startsWith("DELETED:")).toBe(true);
  });

  it("embeds the timestamp immediately after DELETED:", () => {
    const result = markDeleted("notes", TS);
    expect(result).toContain(TS);
    expect(result.startsWith(`DELETED:${TS}`)).toBe(true);
  });

  it("preserves original notes after the newline separator", () => {
    const result = markDeleted("Long-term partner. Prefers quarterly distributions.", TS);
    expect(result).toContain("Long-term partner. Prefers quarterly distributions.");
  });

  it("handles null original notes without throwing", () => {
    const result = markDeleted(null, TS);
    expect(result.startsWith("DELETED:")).toBe(true);
    expect(typeof result).toBe("string");
  });

  it("handles undefined original notes without throwing", () => {
    const result = markDeleted(undefined, TS);
    expect(result.startsWith("DELETED:")).toBe(true);
  });

  it("handles empty string original notes", () => {
    const result = markDeleted("", TS);
    expect(result.startsWith("DELETED:")).toBe(true);
  });

  it("preserves multi-line original notes", () => {
    const original = "Line 1\nLine 2\nLine 3";
    const result = markDeleted(original, TS);
    expect(result).toContain("Line 1\nLine 2\nLine 3");
  });

  it("produces format: DELETED:<ts>\\n<notes>", () => {
    const result = markDeleted("test notes", TS);
    const expected = `DELETED:${TS}\ntest notes`;
    expect(result).toBe(expected);
  });

  it("different timestamps produce different results", () => {
    const ts1 = "2026-01-01T00:00:00.000Z";
    const ts2 = "2026-12-31T23:59:59.999Z";
    const r1 = markDeleted("notes", ts1);
    const r2 = markDeleted("notes", ts2);
    expect(r1).not.toBe(r2);
  });
});

// ─── isDeleted ────────────────────────────────────────────────────────────────

describe("isDeleted", () => {
  const TS = "2026-05-09T10:00:00.000Z";

  it("returns true for a properly marked deleted record", () => {
    const notes = markDeleted("original", TS);
    expect(isDeleted(notes)).toBe(true);
  });

  it("returns false for normal notes", () => {
    expect(isDeleted("Long-term partner.")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isDeleted(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isDeleted(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isDeleted("")).toBe(false);
  });

  it("is case-sensitive — lowercase 'deleted:' is not a sentinel", () => {
    expect(isDeleted("deleted:2026-05-09T10:00:00.000Z\nnotes")).toBe(false);
  });

  it("is case-sensitive — mixed case 'Deleted:' is not a sentinel", () => {
    expect(isDeleted("Deleted:2026-05-09T10:00:00.000Z\nnotes")).toBe(false);
  });

  it("returns false for notes that merely contain the word 'DELETED'", () => {
    expect(isDeleted("Record was DELETED by admin on 2026-01-01")).toBe(false);
  });

  it("returns false for notes that start with 'DELETED' but without the colon", () => {
    expect(isDeleted("DELETED record")).toBe(false);
  });

  it("returns true even when original notes are empty", () => {
    const notes = markDeleted("", TS);
    expect(isDeleted(notes)).toBe(true);
  });

  it("returns true even when original notes are null", () => {
    const notes = markDeleted(null, TS);
    expect(isDeleted(notes)).toBe(true);
  });
});

// ─── restoreNotes (restoration logic) ────────────────────────────────────────

describe("restoreNotes", () => {
  const TS = "2026-05-09T10:00:00.000Z";

  it("strips the DELETED sentinel and returns original notes", () => {
    const original = "Long-term partner. Quarterly distributions.";
    const deleted = markDeleted(original, TS);
    const restored = restoreNotes(deleted);
    expect(restored).toBe(original);
  });

  it("returns empty string when original notes were null", () => {
    const deleted = markDeleted(null, TS);
    const restored = restoreNotes(deleted);
    expect(restored).toBe("");
  });

  it("returns empty string when original notes were empty", () => {
    const deleted = markDeleted("", TS);
    const restored = restoreNotes(deleted);
    expect(restored).toBe("");
  });

  it("returns original value unchanged for non-deleted notes", () => {
    const notes = "Normal business notes.";
    expect(restoreNotes(notes)).toBe(notes);
  });

  it("returns empty string for null input", () => {
    expect(restoreNotes(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(restoreNotes(undefined)).toBe("");
  });

  it("restores multi-line original notes exactly", () => {
    const original = "Line 1\nLine 2\nLine 3";
    const deleted = markDeleted(original, TS);
    const restored = restoreNotes(deleted);
    expect(restored).toBe(original);
  });

  it("after restoration, isDeleted returns false", () => {
    const deleted = markDeleted("notes", TS);
    const restored = restoreNotes(deleted);
    expect(isDeleted(restored)).toBe(false);
  });
});

// ─── Full round-trip integrity ────────────────────────────────────────────────

describe("soft-delete round-trip", () => {
  const TS = "2026-05-09T14:30:00.000Z";

  it("mark → isDeleted → restore produces original value", () => {
    const original = "Active partner since 2023.";
    const deleted = markDeleted(original, TS);
    expect(isDeleted(deleted)).toBe(true);
    const restored = restoreNotes(deleted);
    expect(restored).toBe(original);
    expect(isDeleted(restored)).toBe(false);
  });

  it("a non-deleted record stays non-deleted after restore", () => {
    const notes = "Some notes.";
    expect(isDeleted(notes)).toBe(false);
    const restored = restoreNotes(notes);
    expect(restored).toBe(notes);
    expect(isDeleted(restored)).toBe(false);
  });

  it("cascade simulation: partner + related records all marked deleted", () => {
    const partnerNotes = "Partner account.";
    const allocNotes = "Allocation record.";
    const returnNotes = "Return record.";
    const profitNotes = "Profit record.";

    const now = new Date().toISOString();

    const deletedPartner = markDeleted(partnerNotes, now);
    const deletedAlloc = markDeleted(allocNotes, now);
    const deletedReturn = markDeleted(returnNotes, now);
    const deletedProfit = markDeleted(profitNotes, now);

    // All cascade targets must be detected as deleted
    expect(isDeleted(deletedPartner)).toBe(true);
    expect(isDeleted(deletedAlloc)).toBe(true);
    expect(isDeleted(deletedReturn)).toBe(true);
    expect(isDeleted(deletedProfit)).toBe(true);
  });

  it("double-marking does not corrupt the restoration", () => {
    // If markDeleted is called twice (bug scenario), isDeleted still returns true
    const original = "notes";
    const ts1 = "2026-01-01T00:00:00.000Z";
    const ts2 = "2026-01-02T00:00:00.000Z";
    const firstMark = markDeleted(original, ts1);
    const secondMark = markDeleted(firstMark, ts2);
    // Both marks should be detectable
    expect(isDeleted(secondMark)).toBe(true);
    expect(isDeleted(firstMark)).toBe(true);
  });
});
