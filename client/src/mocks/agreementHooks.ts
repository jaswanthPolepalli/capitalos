/**
 * Mock hooks for Agreement management (Stage 4).
 *
 * Follows the same { data, isLoading, error } pattern as the Stage 3 hooks
 * so they can be swapped for real Catalyst Function calls without touching components.
 */

import { useEffect, useState } from "react";

import type { Agreement } from "../types/domain";
import { MOCK_AGREEMENTS } from "./data";
import type { ListQueryResult, QueryResult } from "./hooks";

const MOCK_DELAY_MS = 120;

export interface AgreementFilters {
  search?: string;
  partyType?: string;
  profitCalculationType?: string;
  status?: string;
}

export function useAgreements(filters: AgreementFilters = {}): ListQueryResult<Agreement> {
  const [state, setState] = useState<ListQueryResult<Agreement>>({
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
      const partyType = filters.partyType ?? "";
      const profitType = filters.profitCalculationType ?? "";
      const status = filters.status ?? "";

      let items = [...MOCK_AGREEMENTS];

      if (search) {
        items = items.filter(
          (a) =>
            a.agreementCode.toLowerCase().includes(search) ||
            a.principalRepaymentTerms.toLowerCase().includes(search) ||
            (a.notes?.toLowerCase().includes(search) ?? false),
        );
      }

      if (partyType && partyType !== "ALL") {
        items = items.filter((a) => a.partyType === partyType);
      }

      if (profitType && profitType !== "ALL") {
        items = items.filter((a) => a.profitCalculationType === profitType);
      }

      if (status && status !== "ALL") {
        items = items.filter((a) => a.status === status);
      }

      setState({ data: items, isLoading: false, error: null, total: items.length });
    }, MOCK_DELAY_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters.search, filters.partyType, filters.profitCalculationType, filters.status]);

  return state;
}

export function useAgreement(id: string | undefined): QueryResult<Agreement> {
  const [state, setState] = useState<QueryResult<Agreement>>({
    data: undefined,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      const result = id ? MOCK_AGREEMENTS.find((a) => a.id === id) : undefined;
      setState({ data: result, isLoading: false, error: null });
    }, MOCK_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);

  return state;
}
