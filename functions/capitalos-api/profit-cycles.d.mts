import type { CapitalAllocation, CapitalReturn, ProfitRecord } from '../../client/src/store.js';
export function latestProfitPayment(records: ProfitRecord[]): ProfitRecord | undefined;
export function recurringProfitAmount(allocation: CapitalAllocation, payment: ProfitRecord | undefined, returns: CapitalReturn[], today: string): number | null;
export function currentProfitCycleAmount(allocation: CapitalAllocation, records: ProfitRecord[], returns: CapitalReturn[], today: string): number;
