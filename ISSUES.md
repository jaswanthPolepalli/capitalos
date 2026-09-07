# CapitalOS — Issues Log

A running record of bugs encountered, root causes, and fixes applied.
This helps prevent recurring mistakes during development.

---

## Issue #1 — Table headers broken by `display: flex` on `.table-th`

**Date:** 2026-06-09  
**Severity:** High — visual regression across all pages  
**Status:** ✅ Fixed

### Symptoms
All table column headers rendered as a vertical list instead of inline header cells. The `<th>` elements stacked column labels (PARTNER, TOTAL CAPITAL, RETURNED…) as separate flex items in a single column, destroying the table layout.

### Root Cause
During a CSS `replace_in_file` operation to add sort button styles, a malformed duplicate block was accidentally inserted:

```css
/* BROKEN — the block was opened but never closed properly */
.sort-btn {
/* ─── Column sort buttons ─── */
.table-th {
  display: flex;          ← THIS was the culprit
  align-items: center;
  gap: 4px;
}
.sort-btn {
  display: inline-grid;
  ...
}
```

The `display: flex` on `.table-th` overrode the browser's native `display: table-cell`, causing `<th>` elements to become flex containers that stacked their children vertically.

### Fix
1. Removed all duplicate/malformed CSS blocks.
2. `.table-th` keeps its **native `display: table-cell`** — never override it with flex.
3. `SortButton` uses `display: inline-grid` with `verticalAlign: "middle"` to sit inline within the th text content.

### Prevention Rule
> ❌ **NEVER add `display: flex` or `display: block` to `.table-th`.**  
> Table header cells must retain their native `display: table-cell`.  
> Sort buttons inside `<th>` should use `display: inline-grid` or `display: inline-flex` with `verticalAlign: middle`.

---

## Issue #2 — Duplicate CSS block created by `replace_in_file`

**Date:** 2026-06-09  
**Severity:** Medium — CSS parse error  
**Status:** ✅ Fixed

### Symptoms
The styles.css file had a section that contained an unclosed `.sort-btn {` block with the entire sort button CSS section duplicated inside it. The CSS was technically invalid at that point.

### Root Cause
A `replace_in_file` diff was constructed incorrectly — the SEARCH block matched a partial segment and the REPLACE block started a new CSS rule without closing the current one, resulting in nested/duplicate declarations.

### Fix
Manually located and removed the duplicate block using `sed -n` to inspect the exact line numbers, then used a precise `replace_in_file` to collapse the duplicate into a single clean block.

### Prevention Rules
> 1. After any large CSS `replace_in_file` operation, verify the file with `grep -n "sort-btn\|.table-th {"` to check for duplicates.
> 2. When replacing CSS blocks, always include enough surrounding context in the SEARCH block to uniquely identify the exact location.
> 3. For CSS files larger than 2000 lines, prefer smaller, targeted replacements over large block inserts.

---

## Issue #3 — `replace_in_file` SEARCH block matched duplicate content

**Date:** 2026-06-09  
**Severity:** Low — created duplicate entries  
**Status:** ✅ Fixed

### Symptoms
After an initial CSS addition, a follow-up `replace_in_file` to fix the sort button section accidentally matched the first occurrence of the block and inserted a second copy of the content, creating two nearly-identical comment blocks and CSS rules.

### Root Cause
The SEARCH pattern was not unique enough — it matched the first instance of a comment pattern that appeared twice in the file.

### Fix
Used `sed -n` to inspect the exact line numbers, identified the malformed duplicate, and removed it with a carefully constructed SEARCH that included enough surrounding unique context.

### Prevention Rule
> Before any `replace_in_file` on a file that has been recently edited in the same session, use `grep -n` to verify the exact line count and uniqueness of the SEARCH pattern.

---

## Issue #4 — `icon-button` used as sortable column header (UX)

**Date:** 2026-06-09  
**Severity:** Low — UX inconsistency  
**Status:** ✅ Fixed

### Symptoms
Sort buttons in table headers were originally `icon-button` class (40×40px bordered squares), making headers look like action buttons rather than sort controls.

### Fix
Replaced with a lightweight `sort-btn` class — transparent background, 18×18px, inline rendering, only shows a sort icon without a border/box.

### Prevention Rule
> Sort controls inside `<th>` elements should be icon-only, transparent, small, and inline. Never use `icon-button` (which has a border and fixed 40px size) for column sort controls.

---

## General Development Rules (learned from the above)

| Rule | Context |
|---|---|
| Never `display: flex` on `.table-th` | Breaks native table layout |
| Always verify CSS uniqueness before `replace_in_file` | Prevents duplicate blocks |
| Use `grep -n` after large CSS edits | Quick duplicate check |
| `sort-btn` must be `inline-grid` / `inline-flex` inside `<th>` | Sort icons sit inline with header text |
| Use `SortButton` with `e.stopPropagation()` | Prevents accidental row click events |
| `display: table-cell` is implicit on `<th>` — never override | Keep table semantics intact |
| Test table rendering after any CSS addition that mentions `display` | Catch display-mode regressions early |

---

*Last updated: 2026-06-09 by Sahaa AI*
