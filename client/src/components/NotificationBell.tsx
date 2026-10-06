/**
 * NotificationBell — in-app alert system (F2 + F7)
 *
 * Shows a bell icon in the TopBar with an unread count badge.
 * Clicking opens a slide-in drawer listing all alerts grouped by severity.
 * Each alert is clickable (navigates to the relevant page) and dismissable.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CreditCard,
  Info,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import {
  clearAllDismissed,
  deriveNotifications,
  dismissAll,
  dismissNotification,
  type AppNotification,
  type NotificationSeverity,
  type NotificationState,
} from "../lib/notifications";
import { useStore } from "../useStore";

// ─── Severity icon ────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  if (severity === "critical") return <AlertTriangle size={14} aria-hidden="true" />;
  if (severity === "warning") return <AlertTriangle size={14} aria-hidden="true" />;
  return <Info size={14} aria-hidden="true" />;
}

function CategoryIcon({ category }: { category: AppNotification["category"] }) {
  if (category === "credit_card_bill") return <CreditCard size={13} aria-hidden="true" />;
  if (category === "profit_overdue") return <TrendingUp size={13} aria-hidden="true" />;
  return <Bell size={13} aria-hidden="true" />;
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotificationRow({
  notification,
  onDismiss,
  onNavigate,
}: {
  notification: AppNotification;
  onDismiss: () => void;
  onNavigate: () => void;
}) {
  const severityClass =
    notification.severity === "critical"
      ? "notif-row--critical"
      : notification.severity === "warning"
      ? "notif-row--warning"
      : "notif-row--info";

  return (
    <div className={`notif-row ${severityClass}`}>
      <button
        className="notif-row__body"
        type="button"
        onClick={onNavigate}
        aria-label={`${notification.title} — click to view`}
      >
        <span className="notif-row__icon">
          <CategoryIcon category={notification.category} />
        </span>
        <div className="notif-row__text">
          <span className="notif-row__title">{notification.title}</span>
          <span className="notif-row__body-text">{notification.body}</span>
        </div>
      </button>
      <button
        className="notif-row__dismiss"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Notification Drawer ──────────────────────────────────────────────────────

function NotificationDrawer({
  onClose,
  state,
  onReadChange,
}: {
  onClose: () => void;
  state: NotificationState;
  onReadChange: () => void;
}) {
  const navigate = useNavigate();

  function handleDismiss(id: string) {
    dismissNotification(id);
    onReadChange();
  }

  function handleDismissAll() {
    dismissAll(state.unread.map((n) => n.id));
    onReadChange();
  }

  function handleClearDismissed() {
    clearAllDismissed();
    onReadChange();
  }

  function handleNavigate(link: string) {
    navigate(link);
    onClose();
  }

  const criticals = state.unread.filter((n) => n.severity === "critical");
  const warnings = state.unread.filter((n) => n.severity === "warning");
  const infos = state.unread.filter((n) => n.severity === "info");
  const dismissedCount = state.all.length - state.unread.length;

  return (
    <motion.aside
      className="notif-drawer"
      initial={{ opacity: 0, x: 320 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 320 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      aria-label="Notifications"
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="notif-drawer__header">
        <div className="notif-drawer__title">
          <Bell size={16} aria-hidden="true" />
          <span>Notifications</span>
          {state.unreadCount > 0 && (
            <span className="notif-badge notif-badge--header">{state.unreadCount}</span>
          )}
        </div>
        <div className="notif-drawer__header-actions">
          {state.unreadCount > 0 && (
            <button
              className="notif-action-btn"
              type="button"
              onClick={handleDismissAll}
              title="Mark all as read"
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>
          )}
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="notif-drawer__body">
        {state.unread.length === 0 ? (
          <div className="notif-empty">
            <Bell size={24} aria-hidden="true" />
            <p>All clear! No pending alerts.</p>
            {dismissedCount > 0 && (
              <button
                className="notif-action-btn"
                type="button"
                onClick={handleClearDismissed}
                style={{ marginTop: 8 }}
              >
                Show {dismissedCount} dismissed
              </button>
            )}
          </div>
        ) : (
          <>
            {criticals.length > 0 && (
              <div className="notif-group">
                <div className="notif-group__label notif-group__label--critical">
                  <SeverityIcon severity="critical" />
                  Critical ({criticals.length})
                </div>
                {criticals.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onDismiss={() => handleDismiss(n.id)}
                    onNavigate={() => handleNavigate(n.link)}
                  />
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="notif-group">
                <div className="notif-group__label notif-group__label--warning">
                  <SeverityIcon severity="warning" />
                  Warnings ({warnings.length})
                </div>
                {warnings.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onDismiss={() => handleDismiss(n.id)}
                    onNavigate={() => handleNavigate(n.link)}
                  />
                ))}
              </div>
            )}
            {infos.length > 0 && (
              <div className="notif-group">
                <div className="notif-group__label notif-group__label--info">
                  <SeverityIcon severity="info" />
                  Info ({infos.length})
                </div>
                {infos.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onDismiss={() => handleDismiss(n.id)}
                    onNavigate={() => handleNavigate(n.link)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.aside>
  );
}

// ─── Bell button ──────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { partnerSummaries, creditCards, allocationSummaries } = useStore();
  const [readVersion, setReadVersion] = useState(0);

  const state = useMemo(
    () => deriveNotifications(partnerSummaries, creditCards, allocationSummaries),
    [partnerSummaries, creditCards, allocationSummaries, readVersion],
  );

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  return (
    <div className="notif-bell-wrap">
      <button
        className={`icon-button notif-bell-btn${state.criticalCount > 0 ? " notif-bell-btn--critical" : ""}`}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={`Notifications${state.unreadCount > 0 ? ` (${state.unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
      >
        <Bell size={18} aria-hidden="true" />
        {state.unreadCount > 0 && (
          <span className={`notif-badge ${state.criticalCount > 0 ? "notif-badge--critical" : "notif-badge--warning"}`} aria-hidden="true">
            {state.unreadCount > 9 ? "9+" : state.unreadCount}
          </span>
        )}
      </button>

      {/* Escape the top bar’s backdrop-filter containing block. */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="notif-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
              />
              <NotificationDrawer
                state={state}
                onReadChange={() => setReadVersion((version) => version + 1)}
                onClose={() => setIsOpen(false)}
              />
            </>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </div>
  );
}
