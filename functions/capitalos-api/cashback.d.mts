export type CashbackStatus = 'review' | 'unpaid' | 'paid' | 'not_applicable';
export type Cashback = { status: Exclude<CashbackStatus, 'paid'>; notes?: string; updatedAt?: string; createdAt?: string } | { status: 'paid'; amountRupees: number | null; paidDate: string; notes?: string; updatedAt?: string; createdAt?: string };
export function cashbackStatus(allocation: { creditCardId?: string | null; combination?: unknown; cashback?: Cashback }): CashbackStatus;
export function validateCashback(input: unknown, allocation: { creditCardId?: string | null; combination?: unknown; receivedDate: string }, today: string): Cashback;

export function cashbackTotals(allocations: { cashback?: Cashback }[]): { totalCashbackPaid: number; unknownCashbackCount: number };
