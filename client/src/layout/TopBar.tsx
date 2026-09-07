import { ChevronDown, Lock, LockOpen, Moon, Search, Sun } from "lucide-react";
import { useState } from "react";

import { openCommandPalette } from "../components/CommandPalette";
import { NotificationBell } from "../components/NotificationBell";
import { PinModal } from "../components/PinModal";
import { useRole } from "../context/RoleContext";
import type { NavigationItem } from "../navigation/navigation";
import { useTheme } from "../theme/ThemeProvider";

interface TopBarProps {
  activeItem: NavigationItem;
}

export function TopBar({ activeItem }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const { isCFO, lock } = useRole();
  const [showPinModal, setShowPinModal] = useState(false);
  const [_isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  void setIsUserMenuOpen; // suppress unused warning

  function handleLockToggle() {
    if (isCFO) {
      lock();
    } else {
      setShowPinModal(true);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar__context">
          <div className="breadcrumbs" aria-label="Breadcrumb">
            <span>CapitalOS</span>
            <span aria-hidden="true">/</span>
            <strong>{activeItem.label}</strong>
          </div>
          <p>{activeItem.description}</p>
        </div>

        <div className="topbar__actions">
          <button
            className="topbar__search-btn"
            onClick={openCommandPalette}
            title="Search (⌘K)"
            type="button"
            aria-label="Open command palette"
          >
            <Search size={15} aria-hidden="true" />
            <span>Search…</span>
            <kbd className="topbar__search-kbd">⌘K</kbd>
          </button>

          <button
            className="icon-button"
            onClick={toggleTheme}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            type="button"
          >
            {theme === "light" ? (
              <Moon size={18} aria-hidden="true" />
            ) : (
              <Sun size={18} aria-hidden="true" />
            )}
            <span className="sr-only">Toggle color theme</span>
          </button>

          <NotificationBell />

          {/* ── Lock / Unlock button ──────────────────────────────────────── */}
          <button
            className="icon-button"
            onClick={handleLockToggle}
            title={isCFO ? "Lock workspace (switch to read-only)" : "Unlock CFO workspace"}
            type="button"
            aria-label={isCFO ? "Lock workspace" : "Unlock CFO workspace"}
          >
            {isCFO ? (
              <LockOpen size={17} aria-hidden="true" />
            ) : (
              <Lock size={17} aria-hidden="true" />
            )}
          </button>

          <div className="user-menu">
            <button
              className="user-menu__trigger"
              type="button"
              aria-label={isCFO ? "CFO workspace" : "CEO read-only view"}
            >
              <span className="avatar" aria-hidden="true">
                {isCFO ? "CF" : "CE"}
              </span>
              <span className="user-menu__identity">
                <strong>{isCFO ? "CFO" : "CEO"}</strong>
                <small>{isCFO ? "Owner" : "Read-only"}</small>
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {showPinModal && <PinModal onClose={() => setShowPinModal(false)} />}
    </>
  );
}
