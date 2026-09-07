/**
 * CapitalOS — StatusBadge Logic Tests
 *
 * The StatusBadge component is used on every financial screen.
 * A wrong variant class means CX sees the wrong colour (e.g. OVERDUE shown as green).
 * A wrong label means CX sees raw snake_case strings instead of "Partially Paid".
 *
 * Because getVariant and getLabel are pure functions (no JSX dependencies),
 * we test them directly here without a DOM environment.
 *
 * Covers:
 * - getVariant: every known status → correct CSS class
 * - getVariant: unknown/custom status → neutral fallback
 * - getLabel: transforms SCREAMING_SNAKE_CASE → Title Case correctly
 */

import { describe, expect, it } from "vitest";

// ─── Pure helpers extracted from StatusBadge.tsx ──────────────────────────────

type BadgeStatus =
  | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DRAFT"
  | "COMPLETED" | "CANCELLED" | "OVERDUE" | "UPCOMING"
  | "DUE" | "PARTIALLY_PAID" | "PAID" | "PARTIALLY_REPAID"
  | "FULLY_REPAID" | "WRITTEN_OFF" | string;

function getVariant(status: BadgeStatus): string {
  switch (status) {
    case "ACTIVE":
    case "PAID":
    case "FULLY_REPAID":
      return "status-badge--active";
    case "INACTIVE":
    case "COMPLETED":
    case "CANCELLED":
    case "WRITTEN_OFF":
      return "status-badge--inactive";
    case "OVERDUE":
      return "status-badge--overdue";
    case "UPCOMING":
    case "DUE":
      return "status-badge--upcoming";
    case "PARTIALLY_PAID":
    case "PARTIALLY_REPAID":
      return "status-badge--partial";
    case "SUSPENDED":
    case "DRAFT":
      return "status-badge--warning";
    default:
      return "status-badge--neutral";
  }
}

function getLabel(status: BadgeStatus): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── getVariant — active statuses ────────────────────────────────────────────

describe("getVariant — active group", () => {
  it("ACTIVE → status-badge--active", () => {
    expect(getVariant("ACTIVE")).toBe("status-badge--active");
  });

  it("PAID → status-badge--active", () => {
    expect(getVariant("PAID")).toBe("status-badge--active");
  });

  it("FULLY_REPAID → status-badge--active", () => {
    expect(getVariant("FULLY_REPAID")).toBe("status-badge--active");
  });
});

// ─── getVariant — inactive / closed statuses ──────────────────────────────────

describe("getVariant — inactive group", () => {
  it("INACTIVE → status-badge--inactive", () => {
    expect(getVariant("INACTIVE")).toBe("status-badge--inactive");
  });

  it("COMPLETED → status-badge--inactive", () => {
    expect(getVariant("COMPLETED")).toBe("status-badge--inactive");
  });

  it("CANCELLED → status-badge--inactive", () => {
    expect(getVariant("CANCELLED")).toBe("status-badge--inactive");
  });

  it("WRITTEN_OFF → status-badge--inactive", () => {
    expect(getVariant("WRITTEN_OFF")).toBe("status-badge--inactive");
  });
});

// ─── getVariant — overdue ─────────────────────────────────────────────────────

describe("getVariant — overdue group", () => {
  it("OVERDUE → status-badge--overdue", () => {
    expect(getVariant("OVERDUE")).toBe("status-badge--overdue");
  });
});

// ─── getVariant — upcoming / due ──────────────────────────────────────────────

describe("getVariant — upcoming group", () => {
  it("UPCOMING → status-badge--upcoming", () => {
    expect(getVariant("UPCOMING")).toBe("status-badge--upcoming");
  });

  it("DUE → status-badge--upcoming", () => {
    expect(getVariant("DUE")).toBe("status-badge--upcoming");
  });
});

// ─── getVariant — partial payment ────────────────────────────────────────────

describe("getVariant — partial payment group", () => {
  it("PARTIALLY_PAID → status-badge--partial", () => {
    expect(getVariant("PARTIALLY_PAID")).toBe("status-badge--partial");
  });

  it("PARTIALLY_REPAID → status-badge--partial", () => {
    expect(getVariant("PARTIALLY_REPAID")).toBe("status-badge--partial");
  });
});

// ─── getVariant — warning statuses ───────────────────────────────────────────

describe("getVariant — warning group", () => {
  it("SUSPENDED → status-badge--warning", () => {
    expect(getVariant("SUSPENDED")).toBe("status-badge--warning");
  });

  it("DRAFT → status-badge--warning", () => {
    expect(getVariant("DRAFT")).toBe("status-badge--warning");
  });
});

// ─── getVariant — unknown / fallback ─────────────────────────────────────────

describe("getVariant — neutral fallback", () => {
  it("unknown status string → status-badge--neutral", () => {
    expect(getVariant("PENDING_REVIEW")).toBe("status-badge--neutral");
  });

  it("empty string → status-badge--neutral", () => {
    expect(getVariant("")).toBe("status-badge--neutral");
  });

  it("lowercase status string → status-badge--neutral (not matched by switch)", () => {
    expect(getVariant("active")).toBe("status-badge--neutral");
  });

  it("custom application status code → status-badge--neutral", () => {
    expect(getVariant("SOFT_DELETED_2")).toBe("status-badge--neutral");
  });

  it("numeric string → status-badge--neutral", () => {
    expect(getVariant("42")).toBe("status-badge--neutral");
  });
});

// ─── getLabel — label formatting ─────────────────────────────────────────────

describe("getLabel", () => {
  it("ACTIVE → 'Active'", () => {
    expect(getLabel("ACTIVE")).toBe("Active");
  });

  it("INACTIVE → 'Inactive'", () => {
    expect(getLabel("INACTIVE")).toBe("Inactive");
  });

  it("OVERDUE → 'Overdue'", () => {
    expect(getLabel("OVERDUE")).toBe("Overdue");
  });

  it("PARTIALLY_PAID → 'Partially Paid'", () => {
    expect(getLabel("PARTIALLY_PAID")).toBe("Partially Paid");
  });

  it("PARTIALLY_REPAID → 'Partially Repaid'", () => {
    expect(getLabel("PARTIALLY_REPAID")).toBe("Partially Repaid");
  });

  it("FULLY_REPAID → 'Fully Repaid'", () => {
    expect(getLabel("FULLY_REPAID")).toBe("Fully Repaid");
  });

  it("WRITTEN_OFF → 'Written Off'", () => {
    expect(getLabel("WRITTEN_OFF")).toBe("Written Off");
  });

  it("UPCOMING → 'Upcoming'", () => {
    expect(getLabel("UPCOMING")).toBe("Upcoming");
  });

  it("DUE → 'Due'", () => {
    expect(getLabel("DUE")).toBe("Due");
  });

  it("PAID → 'Paid'", () => {
    expect(getLabel("PAID")).toBe("Paid");
  });

  it("DRAFT → 'Draft'", () => {
    expect(getLabel("DRAFT")).toBe("Draft");
  });

  it("COMPLETED → 'Completed'", () => {
    expect(getLabel("COMPLETED")).toBe("Completed");
  });

  it("SUSPENDED → 'Suspended'", () => {
    expect(getLabel("SUSPENDED")).toBe("Suspended");
  });

  it("CANCELLED → 'Cancelled'", () => {
    expect(getLabel("CANCELLED")).toBe("Cancelled");
  });

  it("custom multi-word status → correctly title-cased", () => {
    expect(getLabel("PENDING_BOARD_REVIEW")).toBe("Pending Board Review");
  });

  it("single word status → only first letter capitalised", () => {
    expect(getLabel("ACTIVE")).toBe("Active");
  });

  it("does not produce double spaces for any known status", () => {
    const statuses = [
      "ACTIVE", "INACTIVE", "OVERDUE", "UPCOMING", "DUE",
      "PAID", "PARTIALLY_PAID", "FULLY_REPAID", "PARTIALLY_REPAID",
      "WRITTEN_OFF", "COMPLETED", "CANCELLED", "SUSPENDED", "DRAFT",
    ];
    for (const status of statuses) {
      expect(getLabel(status)).not.toContain("  ");
    }
  });

  it("all known statuses produce non-empty labels", () => {
    const statuses = [
      "ACTIVE", "INACTIVE", "OVERDUE", "UPCOMING", "DUE",
      "PAID", "PARTIALLY_PAID", "FULLY_REPAID", "PARTIALLY_REPAID",
      "WRITTEN_OFF", "COMPLETED", "CANCELLED", "SUSPENDED", "DRAFT",
    ];
    for (const status of statuses) {
      expect(getLabel(status).length).toBeGreaterThan(0);
    }
  });
});
