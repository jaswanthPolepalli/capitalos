/**
 * CapitalOS — Navigation Logic Tests
 *
 * `getNavigationItem()` is called on every route change to determine the active
 * navigation item. A bug here breaks the active-state highlight on the sidebar
 * and mobile nav for ALL users simultaneously.
 *
 * `mobilePrimaryPaths` controls which nav items appear in the mobile bottom bar.
 * Missing a path = nav item disappears on mobile; extra path = nav bar overflow.
 *
 * Covers:
 * - getNavigationItem: exact path matching
 * - getNavigationItem: sub-path (nested route) matching
 * - getNavigationItem: unknown path → Dashboard fallback
 * - getNavigationItem: root "/" does not match all paths (prefix bug prevention)
 * - navigationItems: all items have required shape (path, label, shortLabel, icon)
 * - mobilePrimaryPaths: contains exactly the expected 5 paths
 */

import { describe, expect, it } from "vitest";

import {
  getNavigationItem,
  mobilePrimaryPaths,
  navigationItems,
} from "../client/src/navigation/navigation.js";

// ─── getNavigationItem — exact matches ───────────────────────────────────────

describe("getNavigationItem — exact path matches", () => {
  it("'/' → Dashboard", () => {
    const item = getNavigationItem("/");
    expect(item.label).toBe("Dashboard");
    expect(item.path).toBe("/");
  });

  it("'/partners' → Partners", () => {
    const item = getNavigationItem("/partners");
    expect(item.label).toBe("Partners");
  });

  it("'/capital-contributions' → Capital Contributions", () => {
    const item = getNavigationItem("/capital-contributions");
    expect(item.label).toBe("Capital Contributions");
  });

  it("'/pending-profits' → Profits", () => {
    const item = getNavigationItem("/pending-profits");
    expect(item.label).toBe("Profits");
  });

  it("'/return-obligations' → Return Obligations", () => {
    const item = getNavigationItem("/return-obligations");
    expect(item.label).toBe("Return Obligations");
  });

  it("'/ledger' → Ledger", () => {
    const item = getNavigationItem("/ledger");
    expect(item.label).toBe("Ledger");
  });

  it("'/portal-links' → Portal Links", () => {
    const item = getNavigationItem("/portal-links");
    expect(item.label).toBe("Portal Links");
  });

  it("'/settings' → Settings", () => {
    const item = getNavigationItem("/settings");
    expect(item.label).toBe("Settings");
  });
});

// ─── getNavigationItem — sub-path (nested route) matching ────────────────────

describe("getNavigationItem — sub-path matching", () => {
  it("'/partners/1001' → Partners (detail page)", () => {
    const item = getNavigationItem("/partners/1001");
    expect(item.label).toBe("Partners");
  });

  it("'/partners/1001/agreements' → Partners (deep nested)", () => {
    const item = getNavigationItem("/partners/1001/agreements");
    expect(item.label).toBe("Partners");
  });

  it("'/ledger/txn-001' → Ledger (transaction detail)", () => {
    const item = getNavigationItem("/ledger/txn-001");
    expect(item.label).toBe("Ledger");
  });

  it("'/settings/preferences' → Settings (sub-page)", () => {
    const item = getNavigationItem("/settings/preferences");
    expect(item.label).toBe("Settings");
  });

  it("'/capital-contributions/new' → Capital Contributions", () => {
    const item = getNavigationItem("/capital-contributions/new");
    expect(item.label).toBe("Capital Contributions");
  });
});

// ─── getNavigationItem — critical: "/" must not match sub-paths ───────────────

describe("getNavigationItem — root '/' does not greedily match sub-paths", () => {
  it("'/partners' is NOT matched by the root '/' item", () => {
    const item = getNavigationItem("/partners");
    expect(item.path).not.toBe("/");
  });

  it("'/ledger' is NOT matched by the root '/' item", () => {
    const item = getNavigationItem("/ledger");
    expect(item.path).not.toBe("/");
  });

  it("'/settings' is NOT matched by the root '/' item", () => {
    const item = getNavigationItem("/settings");
    expect(item.path).not.toBe("/");
  });
});

// ─── getNavigationItem — unknown path fallback ────────────────────────────────

describe("getNavigationItem — unknown path fallback", () => {
  it("unknown path '/unknown-route' → falls back to Dashboard", () => {
    const item = getNavigationItem("/unknown-route");
    expect(item.label).toBe("Dashboard");
    expect(item.path).toBe("/");
  });

  it("empty-ish path '/not-a-page' → falls back to Dashboard", () => {
    const item = getNavigationItem("/not-a-page");
    expect(item.label).toBe("Dashboard");
  });

  it("deeply nested unknown path → falls back to Dashboard", () => {
    const item = getNavigationItem("/completely/unknown/nested/path");
    expect(item.label).toBe("Dashboard");
  });
});

// ─── navigationItems — structural completeness ────────────────────────────────

describe("navigationItems — structural completeness", () => {
  it("contains at least 8 navigation items", () => {
    expect(navigationItems.length).toBeGreaterThanOrEqual(8);
  });

  it("every item has a non-empty path starting with '/'", () => {
    for (const item of navigationItems) {
      expect(item.path.startsWith("/")).toBe(true);
      expect(item.path.length).toBeGreaterThan(0);
    }
  });

  it("every item has a non-empty label", () => {
    for (const item of navigationItems) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("every item has a non-empty shortLabel", () => {
    for (const item of navigationItems) {
      expect(item.shortLabel.length).toBeGreaterThan(0);
    }
  });

  it("every item has a non-empty description", () => {
    for (const item of navigationItems) {
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it("every item has an icon (truthy lucide icon component)", () => {
    for (const item of navigationItems) {
      expect(item.icon).toBeTruthy();
    }
  });

  it("all navigation paths are unique (no duplicate routes)", () => {
    const paths = navigationItems.map((i) => i.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it("all navigation labels are unique (no duplicate labels)", () => {
    const labels = navigationItems.map((i) => i.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it("Dashboard is the first item (index 0)", () => {
    expect(navigationItems[0]?.path).toBe("/");
    expect(navigationItems[0]?.label).toBe("Dashboard");
  });
});

// ─── mobilePrimaryPaths ───────────────────────────────────────────────────────

describe("mobilePrimaryPaths", () => {
  it("contains exactly 4 paths for the mobile bottom nav (5th slot is 'More')", () => {
    expect(mobilePrimaryPaths.length).toBe(4);
  });

  it("includes '/' (Dashboard)", () => {
    expect(mobilePrimaryPaths).toContain("/");
  });

  it("includes '/partners'", () => {
    expect(mobilePrimaryPaths).toContain("/partners");
  });

  it("includes '/capital-contributions'", () => {
    expect(mobilePrimaryPaths).toContain("/capital-contributions");
  });

  it("includes '/pending-profits'", () => {
    expect(mobilePrimaryPaths).toContain("/pending-profits");
  });

  it("does not include '/ledger' (moved to More drawer)", () => {
    expect(mobilePrimaryPaths).not.toContain("/ledger");
  });

  it("all mobilePrimaryPaths correspond to valid navigation items", () => {
    const validPaths = new Set(navigationItems.map((i) => i.path));
    for (const path of mobilePrimaryPaths) {
      expect(validPaths.has(path), `${path} is not a valid navigation path`).toBe(true);
    }
  });

  it("mobile paths are unique (no duplicates)", () => {
    const unique = new Set(mobilePrimaryPaths);
    expect(unique.size).toBe(mobilePrimaryPaths.length);
  });
});
