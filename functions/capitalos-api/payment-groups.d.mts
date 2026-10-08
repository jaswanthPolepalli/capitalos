import type { CapitalAllocation, CapitalReturn, ProfitRecord } from '../../client/src/store';
export interface PaymentGroupInput {
  groupId: string;
  kind: 'profit' | 'capital';
  partnerId: string;
  date: string;
  reference: string;
  notes: string;
  entries: { partnerAmountRupees?: number | null; noCfoSplit?: boolean; partnerProfitPercent?: number | null; allocationId: string; amountRupees: number; expectedBalance: number; recur: boolean }[];
}
export interface PaymentGroupResult {
  email?: { status: 'sent' | 'no_email' | 'unconfirmed' | 'incomplete' | 'mock'; recipient?: string };
  groupId: string;
  complete: boolean;
  results: { allocationId: string; status: 'saved' | 'unconfirmed' | 'not_attempted'; record?: ProfitRecord | CapitalReturn }[];
}
export function paymentMetadata(notes?: string): { notes: string; paymentGroupId?: string };
export function paymentNotes(notes: string, groupId?: string): string;
export function pendingProfit(a: CapitalAllocation, allocations: CapitalAllocation[], profits: ProfitRecord[], today: string, returns?: CapitalReturn[]): number;
export function preparePaymentGroup(input: PaymentGroupInput, allocations: CapitalAllocation[], returns: CapitalReturn[], profits: ProfitRecord[], today: string): (Omit<ProfitRecord, 'id'> | Omit<CapitalReturn, 'id'>)[];
