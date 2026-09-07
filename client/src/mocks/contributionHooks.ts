/**
 * Mock hooks for Capital Contributions and CEO Investments (Stage 5).
 *
 * Follows the same { data, isLoading, error } pattern as all other stage hooks.
 * Replace with real Catalyst Function calls without changing consuming components.
 */

import { useEffect, useState } from "react";

import type { CEOInvestment, PartnerContribution } from "../types/domain";
import { MOCK_CONTRIBUTIONS, MOCK_INVESTMENTS } from "./data";
import type { ListQueryResult, QueryResult } from "./hooks";

const MOCK_DELAY_MS = 120;

// ─── Partner Contribution hooks ───────────────────────────────────────────────

export interface ContributionFilters {
  search?: string;
  partnerId?: string;
  paymentMethod?: string;
}

export function useContributions(filters: ContributionFilters = {}): ListQueryResult<PartnerContribution> {
  const [state, setState] = useState<ListQueryResult<PartnerContribution>>({
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
      const partnerId = filters.partnerId ?? "";
      const method = filters.paymentMethod ?? "";

      let items = [...MOCK_CONTRIBUTIONS];

      if (search) {
        items = items.filter(
          (c) =>
            c.contributionCode.toLowerCase().includes(search) ||
            (c.referenceNumber?.toLowerCase().includes(search) ?? false) ||
            (c.notes?.toLowerCase().includes(search) ?? false),
        );
      }

      if (partnerId && partnerId !== "ALL") {
        items = items.filter((c) => c.partnerId === partnerId);
      }

      if (method && method !== "ALL") {
        items = items.filter((c) => c.paymentMethod === method);
      }

      setState({ data: items, isLoading: false, error: null, total: items.length });
    }, MOCK_DELAY_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters.search, filters.partnerId, filters.paymentMethod]);

  return state;
}

export function useContribution(id: string | undefined): QueryResult<PartnerContribution> {
  const [state, setState] = useState<QueryResult<PartnerContribution>>({
    data: undefined,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      const result = id ? MOCK_CONTRIBUTIONS.find((c) => c.id === id) : undefined;
      setState({ data: result, isLoading: false, error: null });
    }, MOCK_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);

  return state;
}

// ─── CEO Investment hooks ─────────────────────────────────────────────────────

export interface InvestmentFilters {
  search?: string;
  ceoId?: string;
  status?: string;
  paymentMethod?: string;
}

export function useInvestments(filters: InvestmentFilters = {}): ListQueryResult<CEOInvestment> {
  const [state, setState] = useState<ListQueryResult<CEOInvestment>>({
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
      const ceoId = filters.ceoId ?? "";
      const status = filters.status ?? "";
      const method = filters.paymentMethod ?? "";

      let items = [...MOCK_INVESTMENTS];

      if (search) {
        items = items.filter(
          (inv) =>
            inv.investmentCode.toLowerCase().includes(search) ||
            inv.purpose.toLowerCase().includes(search) ||
            (inv.referenceNumber?.toLowerCase().includes(search) ?? false),
        );
      }

      if (ceoId && ceoId !== "ALL") {
        items = items.filter((inv) => inv.ceoId === ceoId);
      }

      if (status && status !== "ALL") {
        items = items.filter((inv) => inv.status === status);
      }

      if (method && method !== "ALL") {
        items = items.filter((inv) => inv.paymentMethod === method);
      }

      setState({ data: items, isLoading: false, error: null, total: items.length });
    }, MOCK_DELAY_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters.search, filters.ceoId, filters.status, filters.paymentMethod]);

  return state;
}

export function useInvestment(id: string | undefined): QueryResult<CEOInvestment> {
  const [state, setState] = useState<QueryResult<CEOInvestment>>({
    data: undefined,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      const result = id ? MOCK_INVESTMENTS.find((inv) => inv.id === id) : undefined;
      setState({ data: result, isLoading: false, error: null });
    }, MOCK_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);

  return state;
}
