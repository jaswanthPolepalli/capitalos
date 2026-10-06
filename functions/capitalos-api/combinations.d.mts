export interface Combination {
  revertSnapshot?: string;
  revertBlocked?: boolean;
  effectiveDate: string;
  sources: { id: string; capital: number; pending: number; profitRecordIds: string[] }[];
}
export interface CombineInput { allocationIds: string[]; effectiveDate: string; profitPercent: number; returnDate: string | null }
interface Allocation { id: string; partnerId: string; amountRupees: number; profitPercent: number; receivedDate: string; creditCardId: string | null; combination?: Combination }
interface Payment { id: string; allocationId: string; amountRupees: number; paidDate: string; notes: string }
interface Return { allocationId: string; amountRupees: number; returnedDate: string }
export function buildCombination(input: CombineInput, allocations: Allocation[], returns: Return[], profits: Payment[]): Omit<Allocation, 'id'> & { notes: string; returnDate: string | null; combination: Combination };
export function pending(allocation: Allocation, profits: Payment[], returns?: Return[], today?: string): number;
export function decode(notes: string): { combination: Combination; notes: string } | null;
export const PREFIX: string;
export function firstCombinedProfitDate(effectiveDate: string): string;
export function revertReason(allocation: Allocation | undefined, allocations: Allocation[], returns: Return[], profits: Payment[]): string | null;
