/**
 * SearchableSelect — Custom dropdown with search + keyboard navigation.
 * Replaces native <select> elements in modals for a much better UX.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  id?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
}

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled = false,
  hasError = false,
  className = "",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.sublabel?.toLowerCase().includes(query.toLowerCase()) ?? false),
      )
    : options;

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 10);
      setFocusedIndex(-1);
    }
  }, [open]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      const opt = filtered[focusedIndex];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
        setQuery("");
      }
    }
  }

  function selectOption(opt: SelectOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative" }}
      className={className}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "9px 12px",
          background: "var(--surface)",
          border: `1px solid ${hasError ? "var(--outgoing)" : open ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 6,
          color: selected ? "var(--text)" : "var(--muted)",
          fontSize: 14,
          fontWeight: selected ? 500 : 400,
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          outline: "none",
          transition: "border-color 0.15s",
          opacity: disabled ? 0.5 : 1,
          boxShadow: open ? "0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)" : "none",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
          {selected?.icon && <span style={{ flexShrink: 0 }}>{selected.icon}</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected ? selected.label : placeholder}
          </span>
          {selected?.sublabel && (
            <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{selected.sublabel}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          style={{
            flexShrink: 0,
            color: "var(--muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 999,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            overflow: "hidden",
            animation: "fadeInDown 0.12s ease",
          }}
          role="listbox"
        >
          {/* Search box */}
          {options.length > 4 && (
            <div
              style={{
                padding: "8px 10px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Search size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setFocusedIndex(0); }}
                placeholder={searchPlaceholder}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--text)",
                  fontSize: 13,
                  padding: 0,
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            style={{
              listStyle: "none",
              margin: 0,
              padding: "4px 0",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {filtered.length === 0 && (
              <li style={{ padding: "10px 14px", color: "var(--muted)", fontSize: 13, textAlign: "center" }}>
                No options found
              </li>
            )}
            {filtered.map((opt, i) => {
              const isSelected = opt.value === value;
              const isFocused = i === focusedIndex;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setFocusedIndex(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "9px 14px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? "var(--accent)" : "var(--text)",
                    background: isFocused
                      ? "color-mix(in srgb, var(--accent) 8%, var(--surface))"
                      : isSelected
                        ? "color-mix(in srgb, var(--accent) 5%, var(--surface))"
                        : "transparent",
                    borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                    transition: "background 0.08s",
                  }}
                >
                  {opt.icon && <span style={{ flexShrink: 0 }}>{opt.icon}</span>}
                  <span style={{ flex: 1, overflow: "hidden" }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {opt.label}
                    </span>
                    {opt.sublabel && (
                      <span style={{ fontSize: 11, color: isSelected ? "var(--accent)" : "var(--muted)", marginTop: 1, display: "block" }}>
                        {opt.sublabel}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: "var(--accent)" }}>
                      <path d="M2 7L5.5 10.5L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* CSS animation */}
      <style>{`@keyframes fadeInDown{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
