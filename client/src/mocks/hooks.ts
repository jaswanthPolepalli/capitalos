/**
 * Mock data hooks that simulate TanStack Query's return shape.
 *
 * These are intentionally lightweight — they return objects that look like
 * `{ data, isLoading, error }` so every consuming component can be migrated
 * to real TanStack Query hooks (backed by Catalyst Functions) without changing
 * the component code.
 *
 * A 120 ms artificial delay is introduced to exercise loading states.
 */

import { useEffect, useState } from "react";

import type { Partner, PartnerFinancialSummary, CEO, CEOFinancialSummary, Agreement, PartnerContribution, CEOInvestment, LedgerTransaction, ProfitSchedule, PortalAccess } from "../types/domain";
import {
  MOCK_AGREEMENTS,
  MOCK_CEO_SUMMARIES,
  MOCK_CEOS,
  MOCK_CONTRIBUTIONS,
  MOCK_INVESTMENTS,
  MOCK_PARTNER_SUMMARIES,
  MOCK_PARTNERS,
  MOCK_PORTAL_ACCESS,
  MOCK_SCHEDULES,
  MOCK_TRANSACTIONS,
} from "./data";

// ─── Hook result shape ─────────────────────────────────────────────────────────

export interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
}

export interface ListQueryResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  total: number;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

const MOCK_DELAY_MS = 120;

function useMockQuery<T>(factory: () => T | undefined): QueryResult<T> {
  const [state, setState] = useState<QueryResult<T>>({
    data: undefined,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      const result = factory();
      setState({ data: result, isLoading: false, error: null });
    }, MOCK_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

function useMockListQuery<T>(
  factory: () => T[],
): ListQueryResult<T> {
  const [state, setState] = useState<ListQueryResult<T>>({
    data: [],
    isLoading: true,
    error: null,
    total: 0,
  });

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      const items = factory();
      setState({ data: items, isLoading: false, error: null, total: items.length });
    }, MOCK_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

// ─── Partner hooks ────────────────────────────────────────────────────────────

export interface PartnerFilters {
  search?: string;
  status?: string;
}

export function usePartners(filters: PartnerFilters = {}): ListQueryResult<Partner> {
  const [state, setState] = useState<ListQueryResult<Partner>>({
    data: [],
    isLoading: true,
    error: null,
    total: 0,
  });

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      const search = (filters.search ?? "").toLowerCase().trim();
      const statusFilter = filters.status ?? "";

      let items = [...MOCK_PARTNERS];

      if (search) {
        items = items.filter(
          (p) =>
            p.name.toLowerCase().includes(search) ||
            p.partnerCode.toLowerCase().includes(search) ||
            (p.email?.toLowerCase().includes(search) ?? false),
        );
      }

      if (statusFilter && statusFilter !== "ALL") {
        items = items.filter((p) => p.status === statusFilter);
      }

      setState({ data: items, isLoading: false, error: null, total: items.length });
    }, MOCK_DELAY_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters.search, filters.status]);

  return state;
}

export function usePartner(id: string | undefined): QueryResult<Partner> {
  return useMockQuery(() =>
    id ? MOCK_PARTNERS.find((p) => p.id === id) : undefined,
  );
}

export function usePartnerSummary(
  partnerId: string | undefined,
): QueryResult<PartnerFinancialSummary> {
  return useMockQuery(() =>
    partnerId ? MOCK_PARTNER_SUMMARIES[partnerId] : undefined,
  );
}

export function usePartnerAgreements(partnerId: string | undefined): ListQueryResult<Agreement> {
  return useMockListQuery(() =>
    partnerId
      ? MOCK_AGREEMENTS.filter((a) => a.partnerId === partnerId)
      : [],
  );
}

export function usePartnerContributions(partnerId: string | undefined): ListQueryResult<PartnerContribution> {
  return useMockListQuery(() =>
    partnerId
      ? MOCK_CONTRIBUTIONS.filter((c) => c.partnerId === partnerId)
      : [],
  );
}

export function usePartnerTransactions(partnerId: string | undefined): ListQueryResult<LedgerTransaction> {
  return useMockListQuery(() =>
    partnerId
      ? MOCK_TRANSACTIONS.filter((t) => t.partnerId === partnerId)
      : [],
  );
}

export function usePartnerSchedules(partnerId: string | undefined): ListQueryResult<ProfitSchedule> {
  return useMockListQuery(() =>
    partnerId
      ? MOCK_SCHEDULES.filter((s) => s.partnerId === partnerId)
      : [],
  );
}

export function usePartnerPortalAccess(partnerId: string | undefined): QueryResult<PortalAccess> {
  return useMockQuery(() =>
    partnerId
      ? MOCK_PORTAL_ACCESS.find(
          (a) => a.partnerId === partnerId && a.accessType === "PARTNER",
        )
      : undefined,
  );
}

// ─── CEO hooks ────────────────────────────────────────────────────────────────

export interface CEOFilters {
  search?: string;
  status?: string;
}

export function useCEOs(filters: CEOFilters = {}): ListQueryResult<CEO> {
  const [state, setState] = useState<ListQueryResult<CEO>>({
    data: [],
    isLoading: true,
    error: null,
    total: 0,
  });

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      const search = (filters.search ?? "").toLowerCase().trim();
      const statusFilter = filters.status ?? "";

      let items = [...MOCK_CEOS];

      if (search) {
        items = items.filter(
          (c) =>
            c.ceoName.toLowerCase().includes(search) ||
            c.businessName.toLowerCase().includes(search) ||
            c.ceoCode.toLowerCase().includes(search) ||
            (c.email?.toLowerCase().includes(search) ?? false),
        );
      }

      if (statusFilter && statusFilter !== "ALL") {
        items = items.filter((c) => c.status === statusFilter);
      }

      setState({ data: items, isLoading: false, error: null, total: items.length });
    }, MOCK_DELAY_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters.search, filters.status]);

  return state;
}

export function useCEO(id: string | undefined): QueryResult<CEO> {
  return useMockQuery(() =>
    id ? MOCK_CEOS.find((c) => c.id === id) : undefined,
  );
}

export function useCEOSummary(
  ceoId: string | undefined,
): QueryResult<CEOFinancialSummary> {
  return useMockQuery(() =>
    ceoId ? MOCK_CEO_SUMMARIES[ceoId] : undefined,
  );
}

export function useCEOAgreements(ceoId: string | undefined): ListQueryResult<Agreement> {
  return useMockListQuery(() =>
    ceoId
      ? MOCK_AGREEMENTS.filter((a) => a.ceoId === ceoId)
      : [],
  );
}

export function useCEOInvestments(ceoId: string | undefined): ListQueryResult<CEOInvestment> {
  return useMockListQuery(() =>
    ceoId
      ? MOCK_INVESTMENTS.filter((i) => i.ceoId === ceoId)
      : [],
  );
}

export function useCEOTransactions(ceoId: string | undefined): ListQueryResult<LedgerTransaction> {
  return useMockListQuery(() =>
    ceoId
      ? MOCK_TRANSACTIONS.filter((t) => t.ceoId === ceoId)
      : [],
  );
}

export function useCEOSchedules(ceoId: string | undefined): ListQueryResult<ProfitSchedule> {
  return useMockListQuery(() =>
    ceoId
      ? MOCK_SCHEDULES.filter((s) => s.ceoId === ceoId)
      : [],
  );
}

export function useCEOPortalAccess(ceoId: string | undefined): QueryResult<PortalAccess> {
  return useMockQuery(() =>
    ceoId
      ? MOCK_PORTAL_ACCESS.find(
          (a) => a.ceoId === ceoId && a.accessType === "CEO",
        )
      : undefined,
  );
}
