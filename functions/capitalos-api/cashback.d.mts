export type CashbackStatus = 'review' | 'unpaid' | 'paid' | 'not_applicable' | 'not_first_transaction';
export type Cashback = { status: Exclude<CashbackStatus, 'paid'>; notes?: string; updatedAt?: string; createdAt?: string } | { status: 'paid'; amountRupees: number | null; paidDate: string; notes?: string; updatedAt?: string; createdAt?: string };
export function cashbackStatus(allocation: { cashbackEligibility?: string; creditCardId?: string | null; combination?: unknown; cashback?: Cashback }): CashbackStatus;
export function validateCashback(input: unknown, allocation: { cashbackEligibility?: string; creditCardId?: string | null; combination?: unknown; receivedDate: string }, today: string): Cashback;

export function cashbackTotals(allocations: { cashback?: Cashback }[]): { totalCashbackPaid: number; unknownCashbackCount: number };

export function monthlyCashback<T extends { id: string; creditCardId?: string | null; receivedDate: string; createdAt?: string; combination?: unknown }>(allocations: T[]): (T & { cashbackEligibility: string })[];
