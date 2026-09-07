/**
 * Dashboard hooks that compute live KPIs from the mock transaction ledger.
 *
 * These derive every value deterministically from MOCK_TRANSACTIONS using the
 * shared financial calculation functions — no manually stored balances are used.
 *
 * Replace with real Catalyst Function calls (GET /api/dashboard/cfo) in Stage 8
 * without changing the consuming Dashboard component.
 */

import { useEffect, useState } from "react";

import {
  calculateCEOPosition,
  calculateLedgerTotals,
  calculatePartnerPosition,
  type CEOPosition,
  type LedgerTotals,
  type PartnerPosition,
} from "../../../shared/src/financial/calculations.js";
import {
  MOCK_CEOS,
  MOCK_PARTNERS,
  MOCK_SCHEDULES,
  MOCK_TRANSACTIONS,
} from "./data";
import type { QueryResult } from "./hooks";

const MOCK_DELAY_MS = 140;

// ─── CFO Dashboard KPI types ──────────────────────────────────────────────────

export interface CFODashboardKPIs {
  ledgerTotals: LedgerTotals;
  partnerPositions: PartnerPosition[];
  ceoPositions: CEOPosition[];
  // Aggregate partner summary
  totalPartnerCapital: bigint;
  totalPartnerPrincipalReturned: bigint;
  totalPartnerPrincipalOutstanding: bigint;
  totalPartnerProfitPaid: bigint;
  totalPartnerProfitPending: bigint;
  totalPartnerPending: bigint;
  // Aggregate CEO summary
  totalCEOCapitalDeployed: bigint;
  totalCEOPrincipalReturned: bigint;
  totalCEOPrincipalOutstanding: bigint;
  totalCEOProfitReceived: bigint;
  // Net positions
  nextPaymentDate: string | null;
  overdueScheduleCount: number;
  upcomingScheduleCount: number;
}

// ─── Utility: sum bigints ─────────────────────────────────────────────────────

function bigSum(values: bigint[]): bigint {
  return values.reduce((a, b) => a + b, 0n);
}

// ─── Earned profit per partner (simplified: from schedules) ───────────────────

function getPartnerEarnedProfit(partnerId: string): bigint {
  return bigSum(
    MOCK_SCHEDULES
      .filter((s) => s.partnerId === partnerId)
      .map((s) => s.expectedProfit),
  );
}

// ─── Next upcoming/due payment date ──────────────────────────────────────────

function getNextPaymentDate(): string | null {
  const upcoming = MOCK_SCHEDULES
    .filter((s) => s.status === "UPCOMING" || s.status === "DUE")
    .map((s) => s.dueDate)
    .sort();
  return upcoming[0] ?? null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCFODashboard(): QueryResult<CFODashboardKPIs> {
  const [state, setState] = useState<QueryResult<CFODashboardKPIs>>({
    data: undefined,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;

      const ledgerTotals = calculateLedgerTotals(MOCK_TRANSACTIONS);

      const partnerPositions = MOCK_PARTNERS.map((p) =>
        calculatePartnerPosition(p.id, MOCK_TRANSACTIONS, getPartnerEarnedProfit(p.id)),
      );

      const ceoPositions = MOCK_CEOS.map((c) =>
        calculateCEOPosition(c.id, MOCK_TRANSACTIONS),
      );

      const totalPartnerCapital = bigSum(partnerPositions.map((p) => p.totalCapitalContributed));
      const totalPartnerPrincipalReturned = bigSum(partnerPositions.map((p) => p.totalPrincipalReturned));
      const totalPartnerPrincipalOutstanding = bigSum(partnerPositions.map((p) => p.principalOutstanding));
      const totalPartnerProfitPaid = bigSum(partnerPositions.map((p) => p.totalProfitPaid));
      const totalPartnerProfitPending = bigSum(partnerPositions.map((p) => p.profitPending));
      const totalPartnerPending = totalPartnerPrincipalOutstanding + totalPartnerProfitPending;

      const totalCEOCapitalDeployed = bigSum(ceoPositions.map((c) => c.totalCapitalProvided));
      const totalCEOPrincipalReturned = bigSum(ceoPositions.map((c) => c.totalPrincipalReturned));
      const totalCEOPrincipalOutstanding = bigSum(ceoPositions.map((c) => c.principalOutstanding));
      const totalCEOProfitReceived = bigSum(ceoPositions.map((c) => c.totalProfitReceived));

      const overdueScheduleCount = MOCK_SCHEDULES.filter((s) => s.status === "OVERDUE").length;
      const upcomingScheduleCount = MOCK_SCHEDULES.filter((s) => s.status === "UPCOMING" || s.status === "DUE").length;

      setState({
        data: {
          ledgerTotals,
          partnerPositions,
          ceoPositions,
          totalPartnerCapital,
          totalPartnerPrincipalReturned,
          totalPartnerPrincipalOutstanding,
          totalPartnerProfitPaid,
          totalPartnerProfitPending,
          totalPartnerPending,
          totalCEOCapitalDeployed,
          totalCEOPrincipalReturned,
          totalCEOPrincipalOutstanding,
          totalCEOProfitReceived,
          nextPaymentDate: getNextPaymentDate(),
          overdueScheduleCount,
          upcomingScheduleCount,
        },
        isLoading: false,
        error: null,
      });
    }, MOCK_DELAY_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  return state;
}
