import type { LedgerEvent } from '../store';
import { isISODate } from './businessDates';

export function buildStatement(ledger: LedgerEvent[], partnerId: string, from: string, to: string) {
  if (!isISODate(from) || !isISODate(to) || from > to) throw new Error('Choose a valid date range; end date must be on or after start date.');
  const entries = ledger.filter(e => e.partnerId === partnerId && e.date <= to).sort((a, b) =>
    a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  const delta = (e: LedgerEvent) => Math.round(e.amountRupees * 100) * (e.eventType === 'CAPITAL_RECEIVED' ? 1 : e.eventType === 'CAPITAL_RETURNED' ? -1 : 0);
  const openingPaise = entries.filter(e => e.date < from).reduce((sum, e) => sum + delta(e), 0);
  let balance = openingPaise;
  const rows = entries.filter(e => e.date >= from).map(e => { balance += delta(e); return { ...e, runningBalance: balance / 100 }; });
  const total = (type: string) => rows.filter(e => e.eventType === type).reduce((sum, e) => sum + Math.round(e.amountRupees * 100), 0) / 100;
  return { from, to, rows, openingPrincipal: openingPaise / 100, closingPrincipal: balance / 100,
    received: total('CAPITAL_RECEIVED'), returned: total('CAPITAL_RETURNED'), profitPaid: total('PROFIT_PAID'), cashbackPaid: total('CASHBACK_PAID'), totalProfitsReceived: total('PROFIT_PAID') + total('CASHBACK_PAID'), unknownCashbackCount: rows.filter(e => e.amountUnknown).length };
}
