export interface ProfitSplit { partnerAmountRupees?: number; noCfoSplit?: boolean; amountRupees: number; combinedAmountRupees: number; cfoShareRupees: number; partnerProfitPercent?: number; profitCapitalRupees?: number }
export function splitProfit(amount: number, partnerProfitPercent?: number | null, profitCapitalRupees?: number, noCfoSplit?: boolean, partnerAmountRupees?: number | null): ProfitSplit;
export function profitMetadata(notes?: string): { notes: string } & Partial<ProfitSplit>;
export function profitNotes(notes?: string, combinedAmountRupees?: number, partnerProfitPercent?: number | null, profitCapitalRupees?: number, noCfoSplit?: boolean, partnerAmountRupees?: number | null): string;
export function combinedForPartner(amount: number): number;
