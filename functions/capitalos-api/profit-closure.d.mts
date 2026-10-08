import type { CapitalAllocation, CapitalReturn, ProfitRecord } from '../../client/src/store.js';
export interface CloseProfitInput { allocationId: string; partnerId: string; expectedPending: number; confirmed: true; recur: boolean; }
export function prepareProfitClosure(input: CloseProfitInput, allocations: CapitalAllocation[], profits: ProfitRecord[], returns: CapitalReturn[], today: string): Omit<ProfitRecord, 'id'>;
