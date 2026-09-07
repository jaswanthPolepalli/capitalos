/**
 * PinModal — CFO workspace unlock dialog.
 *
 * A minimal PIN entry modal. The submitted PIN is hashed client-side
 * and compared against the stored SHA-256 hash — never sent over the wire.
 */

import { KeyRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useRole } from "../context/RoleContext";

interface PinModalProps {
  onClose: () => void;
}

export function PinModal({ onClose }: PinModalProps) {
  const { unlock } = useRole();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError("");
    const success = await unlock(pin);
    setLoading(false);
    if (success) {
      onClose();
    } else {
      setError("Incorrect PIN. Try again.");
      setPin("");
      inputRef.current?.focus();
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 340 }}>
        <div className="modal__header">
          <h2 id="pin-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <KeyRound size={18} aria-hidden="true" />
            CFO Workspace
          </h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          <p style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 16 }}>
            Enter your CFO PIN to unlock full workspace access.
          </p>

          <div className="form-field">
            <label htmlFor="cfo-pin" className="form-label">PIN</label>
            <input
              id="cfo-pin"
              ref={inputRef}
              className={`form-input${error ? " form-input--error" : ""}`}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError("");
              }}
              placeholder="Enter PIN"
              autoComplete="current-password"
            />
            {error && <span className="form-error">{error}</span>}
          </div>

          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={loading || !pin.trim()}
            >
              {loading ? "Verifying…" : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
