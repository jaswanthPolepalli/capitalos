/**
 * Global Command Palette — Cmd+K / Ctrl+K
 *
 * Enables quick navigation to any partner, page, or action.
 * Also searches across partners, allocations, and ledger entries (F8).
 * Opens from anywhere in the app.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeIndianRupee,
  BarChart2,
  BookOpen,
  CalendarClock,
  CreditCard,
  IndianRupee,
  LayoutDashboard,
  Link2,
  ListChecks,
  Search,
  Settings,
  TrendingUp,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useStore } from "../useStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  action: () => void;
  group: string;
}

// ─── Singleton open trigger ───────────────────────────────────────────────────

let _openPalette: (() => void) | null = null;

export function openCommandPalette() {
  _openPalette?.();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { partners, allocationSummaries, ledger } = useStore();

  // Register singleton
  useEffect(() => {
    _openPalette = () => setIsOpen(true);
    return () => { _openPalette = null; };
  }, []);

  // Global keyboard shortcut — Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
        setQuery("");
        setActiveIndex(0);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function go(path: string) {
    navigate(path);
    close();
  }

  // ─── INR formatter for sublabels ─────────────────────────────────────────
  function fmtCompact(rupees: number): string {
    if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)}Cr`;
    if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)}L`;
    return `₹${rupees.toLocaleString("en-IN")}`;
  }

  // Build all command items
  const allItems = useMemo<CommandItem[]>(() => {
    const pages: CommandItem[] = [
      { id: "nav-dashboard", label: "Dashboard", sublabel: "Financial overview", icon: LayoutDashboard, action: () => go("/"), group: "Pages" },
      { id: "nav-partners", label: "Partners", sublabel: "Capital partner records", icon: User, action: () => go("/partners"), group: "Pages" },
      { id: "nav-contributions", label: "Capital Contributions", sublabel: "Partner capital contributions", icon: BadgeIndianRupee, action: () => go("/capital-contributions"), group: "Pages" },
      { id: "nav-pending", label: "Profits", sublabel: "Profit obligations and payments, by month", icon: TrendingUp, action: () => go("/pending-profits"), group: "Pages" },
      { id: "nav-returns", label: "Return Obligations", sublabel: "Capital return schedule", icon: CalendarClock, action: () => go("/return-obligations"), group: "Pages" },
      { id: "nav-bulk", label: "Bulk Payment", sublabel: "Pay all pending in one cycle", icon: ListChecks, action: () => go("/bulk-payment"), group: "Pages" },
      { id: "nav-ledger", label: "Ledger", sublabel: "Transactions and change history", icon: BookOpen, action: () => go("/ledger"), group: "Pages" },
      { id: "nav-cards", label: "Credit Cards", sublabel: "Partner credit cards", icon: CreditCard, action: () => go("/credit-cards"), group: "Pages" },
      { id: "nav-reports", label: "Reports", sublabel: "Financial summary & CSV export", icon: BarChart2, action: () => go("/reports"), group: "Pages" },
      { id: "nav-portals", label: "Portal Links", sublabel: "Secure partner portal access", icon: Link2, action: () => go("/portal-links"), group: "Pages" },
      { id: "nav-settings", label: "Settings", sublabel: "Workspace preferences", icon: Settings, action: () => go("/settings"), group: "Pages" },
    ];

    const partnerItems: CommandItem[] = partners.map((p) => ({
      id: `partner-${p.id}`,
      label: p.name,
      sublabel: p.phone || p.email || "Capital partner",
      icon: User,
      action: () => go(`/partners/${p.id}`),
      group: "Partners",
    }));

    // Allocation search — only shown when there's a query
    const allocationItems: CommandItem[] = allocationSummaries.map((a) => ({
      id: `alloc-${a.id}`,
      label: `${a.partner?.name ?? a.partnerId} — ${fmtCompact(a.amountRupees)}`,
      sublabel: `${a.profitPercent}% p.m. · ${a.isFullyReturned ? "Returned" : `Outstanding: ${fmtCompact(a.capitalOutstanding)}`}`,
      icon: IndianRupee,
      action: () => go(`/partners/${a.partnerId}`),
      group: "Allocations",
    }));

    // Recent ledger entries — only shown when there's a query
    const ledgerItems: CommandItem[] = ledger.slice(0, 100).map((e) => ({
      id: `ledger-${e.id}`,
      label: `${e.eventType.replace(/_/g, " ")} — ${fmtCompact(e.amountRupees)}`,
      sublabel: `${e.date} · ${e.notes || "No notes"}`,
      icon: BookOpen,
      action: () => go("/ledger"),
      group: "Transactions",
    }));

    return [...pages, ...partnerItems, ...allocationItems, ...ledgerItems];
  }, [partners, allocationSummaries, ledger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems.filter((i) => i.group === "Pages").slice(0, 8);
    const q = query.toLowerCase();
    // For entity groups, only show results with actual matches
    const results = allItems.filter((item) => {
      if (!query.trim()) return item.group === "Pages";
      return (
        item.label.toLowerCase().includes(q) ||
        (item.sublabel || "").toLowerCase().includes(q)
      );
    });
    // Limit per group: 3 partners, 3 allocations, 3 transactions, all page matches
    const pages = results.filter((i) => i.group === "Pages");
    const partners_ = results.filter((i) => i.group === "Partners").slice(0, 3);
    const allocations_ = results.filter((i) => i.group === "Allocations").slice(0, 3);
    const transactions_ = results.filter((i) => i.group === "Transactions").slice(0, 3);
    return [...pages, ...partners_, ...allocations_, ...transactions_].slice(0, 12);
  }, [allItems, query]);

  // Group filtered items
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group]!.push(item);
    }
    return groups;
  }, [filtered]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIndex]?.action();
    }
  };

  // Reset active index when filtered changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div className="cmd-backdrop" onClick={close} role="dialog" aria-modal="true" aria-label="Command palette">
      <AnimatePresence>
        <motion.div
          className="cmd-palette"
          initial={{ opacity: 0, scale: 0.96, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -12 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="cmd-palette__search">
            <Search size={16} className="cmd-palette__search-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              className="cmd-palette__input"
              type="text"
              placeholder="Search pages, partners, actions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Command search"
              aria-autocomplete="list"
              aria-controls="cmd-palette-list"
              aria-activedescendant={filtered[activeIndex] ? `cmd-item-${filtered[activeIndex]!.id}` : undefined}
            />
            <kbd className="cmd-palette__kbd">Esc</kbd>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            id="cmd-palette-list"
            className="cmd-palette__results"
            role="listbox"
            aria-label="Command results"
          >
            {filtered.length === 0 ? (
              <div className="cmd-palette__empty">
                <Search size={18} aria-hidden="true" />
                <span>No results for "{query}"</span>
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="cmd-group">
                  <div className="cmd-group__label">{group}</div>
                  {items.map((item) => {
                    const currentIndex = flatIndex++;
                    const isActive = currentIndex === activeIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        id={`cmd-item-${item.id}`}
                        className={`cmd-item${isActive ? " cmd-item--active" : ""}`}
                        role="option"
                        aria-selected={isActive}
                        onClick={item.action}
                        type="button"
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                      >
                        <span className="cmd-item__icon">
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <span className="cmd-item__content">
                          <span className="cmd-item__label">{item.label}</span>
                          {item.sublabel && (
                            <span className="cmd-item__sublabel">{item.sublabel}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="cmd-palette__footer">
            <span className="cmd-hint"><kbd>↑↓</kbd> navigate</span>
            <span className="cmd-hint"><kbd>↵</kbd> open</span>
            <span className="cmd-hint"><kbd>Esc</kbd> close</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
