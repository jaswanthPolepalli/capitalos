/**
 * CapitalOS Notification System
 *
 * Derives in-app alerts from the current store state.
 * No backend required — all computed in-memory from live data.
 * Dismissed state persisted to localStorage.
 */

import type { AllocationSummary, CreditCard, PartnerSummary } from "../store";
import { computeNextDueDate } from "../store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationSeverity = "critical" | "warning" | "info";
export type NotificationCategory =
  | "profit_overdue"
  | "principal_due_soon"
  | "credit_card_bill"
  | "agreement_expiring"
  | "overpayment";

export interface AppNotification {
  id: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  title: string;
  body: string;
  /** Route to navigate to when clicked */
  link: string;
  /** ISO date the notification was generated */
  generatedAt: string;
}

// ─── localStorage key ─────────────────────────────────────────────────────────

const DISMISSED_KEY = "capitalos_dismissed_notifications";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function dismissNotification(id: string) {
  const dismissed = getDismissed();
  dismissed.add(id);
  saveDismissed(dismissed);
}

export function dismissAll(ids: string[]) {
  const dismissed = getDismissed();
  ids.forEach((id) => dismissed.add(id));
  saveDismissed(dismissed);
}

export function clearAllDismissed() {
  localStorage.removeItem(DISMISSED_KEY);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// ─── Notification generators ──────────────────────────────────────────────────

function profitOverdueAlerts(
  partnerSummaries: PartnerSummary[],
  today: string,
): AppNotification[] {
  const alerts: AppNotification[] = [];
  for (const ps of partnerSummaries) {
    if (ps.totalProfitPending <= 0) continue;
    // If profit is pending and next return date is in the past → overdue
    const isOverdue =
      ps.nextReturnDate != null && ps.nextReturnDate < today;
    // If pending profit is more than 1.5× monthly expected → likely multiple months overdue
    const isMultiMonth =
      ps.expectedMonthlyProfit > 0 &&
      ps.totalProfitPending > ps.expectedMonthlyProfit * 1.5;

    if (isOverdue || isMultiMonth) {
      alerts.push({
        id: `profit-overdue-${ps.partner.id}`,
        severity: "critical",
        category: "profit_overdue",
        title: `Profit overdue — ${ps.partner.name}`,
        body: `₹${ps.totalProfitPending.toLocaleString("en-IN")} profit pending${isMultiMonth ? " (multiple months)" : ""}`,
        link: "/pending-profits",
        generatedAt: today,
      });
    }
  }
  return alerts;
}

function principalDueSoonAlerts(
  partnerSummaries: PartnerSummary[],
  today: string,
): AppNotification[] {
  const alerts: AppNotification[] = [];
  for (const ps of partnerSummaries) {
    if (!ps.nextReturnDate || ps.capitalOutstanding <= 0) continue;
    const daysUntil = daysBetween(today, ps.nextReturnDate);
    if (daysUntil < 0) {
      alerts.push({
        id: `principal-overdue-${ps.partner.id}`,
        severity: "critical",
        category: "principal_due_soon",
        title: `Capital return overdue — ${ps.partner.name}`,
        body: `₹${ps.capitalOutstanding.toLocaleString("en-IN")} was due on ${ps.nextReturnDate}`,
        link: "/return-obligations",
        generatedAt: today,
      });
    } else if (daysUntil <= 7) {
      alerts.push({
        id: `principal-due-${ps.partner.id}-${ps.nextReturnDate}`,
        severity: "warning",
        category: "principal_due_soon",
        title: `Capital return due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} — ${ps.partner.name}`,
        body: `₹${ps.capitalOutstanding.toLocaleString("en-IN")} due on ${ps.nextReturnDate}`,
        link: "/return-obligations",
        generatedAt: today,
      });
    }
  }
  return alerts;
}

function creditCardAlerts(
  creditCards: CreditCard[],
  allocationSummaries: AllocationSummary[],
  today: string,
): AppNotification[] {
  const alerts: AppNotification[] = [];
  for (const card of creditCards) {
    // Only alert if card has active utilisation
    const hasUtilisation = allocationSummaries.some(
      (a) => a.creditCardId === card.id && !a.isFullyReturned,
    );
    if (!hasUtilisation && card.pendingLimit === 0) continue;

    const nextDue = computeNextDueDate(card, today);
    const daysUntil = daysBetween(today, nextDue);

    if (daysUntil <= 3) {
      alerts.push({
        id: `cc-urgent-${card.id}-${nextDue}`,
        severity: "critical",
        category: "credit_card_bill",
        title: `Credit card bill due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} — ${card.cardName}`,
        body: `Due date: ${nextDue}. Avoid late payment charges.`,
        link: "/credit-cards",
        generatedAt: today,
      });
    } else if (daysUntil <= 7) {
      alerts.push({
        id: `cc-warn-${card.id}-${nextDue}`,
        severity: "warning",
        category: "credit_card_bill",
        title: `Credit card bill due soon — ${card.cardName}`,
        body: `Due on ${nextDue} (${daysUntil} days away)`,
        link: "/credit-cards",
        generatedAt: today,
      });
    } else if (daysUntil <= 14) {
      alerts.push({
        id: `cc-info-${card.id}-${nextDue}`,
        severity: "info",
        category: "credit_card_bill",
        title: `Upcoming billing cycle — ${card.cardName}`,
        body: `Bill due on ${nextDue}`,
        link: "/credit-cards",
        generatedAt: today,
      });
    }
  }
  return alerts;
}

// ─── Main derivation function ─────────────────────────────────────────────────

export interface NotificationState {
  all: AppNotification[];
  unread: AppNotification[];
  unreadCount: number;
  criticalCount: number;
}

export function deriveNotifications(
  partnerSummaries: PartnerSummary[],
  creditCards: CreditCard[],
  allocationSummaries: AllocationSummary[],
): NotificationState {
  const today = new Date().toISOString().slice(0, 10);
  const dismissed = getDismissed();

  const all: AppNotification[] = [
    ...profitOverdueAlerts(partnerSummaries, today),
    ...principalDueSoonAlerts(partnerSummaries, today),
    ...creditCardAlerts(creditCards, allocationSummaries, today),
  ].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const unread = all.filter((n) => !dismissed.has(n.id));

  return {
    all,
    unread,
    unreadCount: unread.length,
    criticalCount: unread.filter((n) => n.severity === "critical").length,
  };
}
