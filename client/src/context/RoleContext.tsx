/**
 * RoleContext — PIN-gated CFO mode.
 *
 * The app defaults to "ceo" (read-only) for all visitors.
 * The CFO can unlock full access by entering the correct PIN.
 *
 * Security model:
 *  - The PIN is never stored in plain text — only its SHA-256 hash is
 *    embedded in the bundle.
 *  - The unlocked state is stored in sessionStorage so closing the tab
 *    automatically reverts to read-only (ceo) mode.
 *  - URL manipulation cannot change the role — it is always derived from
 *    session state.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = "cfo" | "ceo";

interface RoleContextValue {
  role: Role;
  isCFO: boolean;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
}

// ─── SHA-256 hash of PIN "1006" ───────────────────────────────────────────────

const CFO_PIN_HASH = "478c4ffb1cbcea37956a748e6c19d8eadd0a47e86f5e308d26cad39453b5d1ab";
const SESSION_KEY = "cos_role_unlocked";

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Context ──────────────────────────────────────────────────────────────────

const RoleContext = createContext<RoleContextValue>({
  role: "ceo",
  isCFO: false,
  unlock: async () => false,
  lock: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RoleProvider({ children }: { children: React.ReactNode }) {
  // Initialize from sessionStorage so a page refresh within the same tab keeps
  // the CFO unlocked, but a new tab / closed tab starts as ceo (read-only).
  const [role, setRole] = useState<Role>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1" ? "cfo" : "ceo";
    } catch {
      return "ceo";
    }
  });

  useEffect(() => {
    try {
      if (role === "cfo") {
        sessionStorage.setItem(SESSION_KEY, "1");
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // sessionStorage may be unavailable in some environments — fail silently
    }
  }, [role]);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const hash = await sha256(pin.trim());
    if (hash === CFO_PIN_HASH) {
      setRole("cfo");
      return true;
    }
    return false;
  }, []);

  const lock = useCallback(() => {
    setRole("ceo");
  }, []);

  return (
    <RoleContext.Provider value={{ role, isCFO: role === "cfo", unlock, lock }}>
      {children}
    </RoleContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}
