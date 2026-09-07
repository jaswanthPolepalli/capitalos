/**
 * Toast notification system for CapitalOS.
 *
 * Usage:
 *   import { toast } from "./Toast";
 *   toast.success("Contribution recorded for Ramesh Nair — ₹5,00,000");
 *   toast.error("Failed to save. Please try again.");
 *   toast.info("Partner portal link copied.");
 */

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  duration?: number;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ToastContextValue {
  addToast: (message: string, tone: ToastTone, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Singleton imperative API ─────────────────────────────────────────────────
// Allows calling toast.success() from anywhere without hooks.

type ToastFn = (message: string, duration?: number) => void;

let _addToast: ToastContextValue["addToast"] | null = null;

export const toast = {
  success: ((message, duration) => _addToast?.(message, "success", duration)) as ToastFn,
  error: ((message, duration) => _addToast?.(message, "error", duration ?? 6000)) as ToastFn,
  info: ((message, duration) => _addToast?.(message, "info", duration)) as ToastFn,
  warning: ((message, duration) => _addToast?.(message, "warning", duration)) as ToastFn,
};

// ─── Single Toast ─────────────────────────────────────────────────────────────

function ToastNotification({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const duration = item.duration ?? 4000;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), duration);
    return () => clearTimeout(timer);
  }, [item.id, duration, onDismiss]);

  const Icon =
    item.tone === "success" ? CheckCircle2
    : item.tone === "error" ? AlertCircle
    : item.tone === "warning" ? AlertCircle
    : Info;

  return (
    <motion.div
      className={`toast toast--${item.tone}`}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      role="alert"
      aria-live="polite"
    >
      <Icon size={16} className="toast__icon" aria-hidden="true" />
      <span className="toast__message">{item.message}</span>
      <button
        className="toast__close"
        onClick={() => onDismiss(item.id)}
        type="button"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message: string, tone: ToastTone, duration?: number) => {
    const id = `toast-${++counterRef.current}`;
    const item: ToastItem = duration !== undefined
      ? { id, message, tone, duration }
      : { id, message, tone };
    setToasts((prev) => [...prev, item]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Register singleton
  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {createPortal(
        <div className="toast-container" aria-label="Notifications">
          <AnimatePresence initial={false}>
            {toasts.map((item) => (
              <ToastNotification key={item.id} item={item} onDismiss={dismiss} />
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
