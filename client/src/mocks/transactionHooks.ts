/**
 * Mock hooks for the Transaction Ledger (Stage 6).
 *
 * The ledger is the authoritative financial source of truth.
 * Filters mirror the filtering capabilities required by the production Catalyst Function.
 */

import { useEffect, useState } from "react";

import type { LedgerTransaction, TransactionDirection, TransactionType } from "../types/domain";
import { MOCK_TRANSACTIONS } from "./data";
import type { ListQueryResult, QueryResult } from "./hooks";

const MOCK_DELAY_MS = 120;

export interface TransactionFilters {
  search?: string;
  partnerId?: string;
  ceoId?: string;
  agreementId?: string;
  transactionType?: TransactionType | "";
  direction?: TransactionDirection | "";
  dateFrom?: string;
  dateTo?: string;
}

export function useTransactions(
  filters: TransactionFilters = {},
): ListQueryResult<LedgerTransaction> {
  const [state, setState] = useState<ListQueryResult<LedgerTransaction>>({
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

      let items = [...MOCK_TRANSACTIONS].sort(
        (a, b) => b.transactionDate.localeCompare(a.transactionDate),
      );

      if (search) {
        items = items.filter(
          (t) =>
            t.transactionCode.toLowerCase().includes(search) ||
            (t.referenceNumber?.toLowerCase().includes(search) ?? false) ||
            t.transactionType.toLowerCase().includes(search),
        );
      }

      if (filters.partnerId && filters.partnerId !== "ALL") {
        items = items.filter((t) => t.partnerId === filters.partnerId);
      }

      if (filters.ceoId && filters.ceoId !== "ALL") {
        items = items.filter((t) => t.ceoId === filters.ceoId);
      }

      if (filters.agreementId && filters.agreementId !== "ALL") {
        items = items.filter((t) => t.agreementId === filters.agreementId);
      }

      if (filters.transactionType) {
        items = items.filter((t) => t.transactionType === filters.transactionType);
      }

      if (filters.direction) {
        items = items.filter((t) => t.direction === filters.direction);
      }

      if (filters.dateFrom) {
        items = items.filter((t) => t.transactionDate >= filters.dateFrom!);
      }

      if (filters.dateTo) {
        items = items.filter((t) => t.transactionDate <= filters.dateTo!);
      }

      setState({ data: items, isLoading: false, error: null, total: items.length });
    }, MOCK_DELAY_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [
    filters.search,
    filters.partnerId,
    filters.ceoId,
    filters.agreementId,
    filters.transactionType,
    filters.direction,
    filters.dateFrom,
    filters.dateTo,
  ]);

  return state;
}

export function useTransaction(id: string | undefined): QueryResult<LedgerTransaction> {
  const [state, setState] = useState<QueryResult<LedgerTransaction>>({
    data: undefined,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      const result = id ? MOCK_TRANSACTIONS.find((t) => t.id === id) : undefined;
      setState({ data: result, isLoading: false, error: null });
    }, MOCK_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);

  return state;
}
