/**
 * useStore — React hook that subscribes to the CapitalOS cloud store.
 */

import { useCallback } from "react";

import * as Store from "./store";
import { useStoreStatus } from "./useStoreStatus";

export function useStore() {
  const { tick, ...loadState } = useStoreStatus();

  return {
    tick,
    ...loadState,
    isLoaded: Store.isLoaded(),
    partners: Store.getPartners(),
    allocations: Store.getAllocations(),
    capitalReturns: Store.getCapitalReturns(),
    profitRecords: Store.getProfitRecords(),
    creditCards: Store.getCreditCards(),
    ledger: Store.getLedger(),
    allocationSummaries: Store.getAllocationSummaries(),
    partnerSummaries: Store.getPartnerSummaries(),
    portfolioTotals: Store.getPortfolioTotals(),
    // helpers
    getPartner: Store.getPartner,
    getAllocationsForPartner: Store.getAllocationsForPartner,
    getCapitalReturnsForAllocation: Store.getCapitalReturnsForAllocation,
    getCapitalReturnsForPartner: Store.getCapitalReturnsForPartner,
    getProfitRecordsForAllocation: Store.getProfitRecordsForAllocation,
    getProfitRecordsForPartner: Store.getProfitRecordsForPartner,
    getLedgerForPartner: Store.getLedgerForPartner,
    getCreditCard: Store.getCreditCard,
    getCreditCardsForPartner: Store.getCreditCardsForPartner,
    computeNextDueDate: Store.computeNextDueDate,
    // mutations (async — return Promise)
    addPartner: useCallback((input: Store.AddPartnerInput) => Store.addPartner(input), []),
    addAllocation: useCallback((input: Store.AddAllocationInput) => Store.addAllocation(input), []),
    addCapitalReturn: useCallback((input: Store.AddCapitalReturnInput) => Store.addCapitalReturn(input), []),
    addProfitRecord: useCallback((input: Store.AddProfitRecordInput) => Store.addProfitRecord(input), []),
    updateAllocationReturnDate: useCallback((id: string, date: string | null) => Store.updateAllocationReturnDate(id, date), []),
    updateAllocationCreditCard: useCallback((id: string, cardId: string | null, returnDate?: string | null) => Store.updateAllocationCreditCard(id, cardId, returnDate), []),
    deletePartner: useCallback((id: string) => Store.deletePartner(id), []),
    // credit card mutations
    addCreditCard: useCallback((input: Store.AddCreditCardInput) => Store.addCreditCard(input), []),
    updateCreditCard: useCallback((id: string, input: Store.UpdateCreditCardInput) => Store.updateCreditCard(id, input), []),
    deleteCreditCard: useCallback((id: string) => Store.deleteCreditCard(id), []),
  };
}
