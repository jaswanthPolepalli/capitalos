import type { AllocationSummary } from '../store';
import { addDays, isISODate, monthlyAnniversary } from './businessDates';

export interface Obligation {
  id: string; allocationId: string; partnerId: string; partnerName: string; cardId: string | null; cardName: string;
  kind: 'principal' | 'profit-estimate'; date: string; amountRupees: number;
}
export function buildObligations(allocations: AllocationSummary[], today: string, days = 90): Obligation[] {
  const until = addDays(today, days);
  const result: Obligation[] = [];
  for (const a of allocations) {
    const owner = allocations.find(parent => parent.combination?.sources.some(source => source.id === a.id));
    if (owner && owner.receivedDate <= today) continue;
    const capital = a.receivedDate > today ? Math.max(0, a.amountRupees - a.totalCapitalReturned) : a.capitalOutstanding;
    if (capital <= 0 || !isISODate(a.receivedDate) || a.receivedDate > until) continue;
    const base = { allocationId: a.id, partnerId: a.partnerId, partnerName: a.partner?.name || a.partnerId,
      cardId: a.creditCardId, cardName: a.creditCard?.cardName || (a.creditCardId ? 'Unknown card' : 'Cash / bank') };
    if (a.returnDate && isISODate(a.returnDate) && a.returnDate <= until && (!owner || a.returnDate < owner.receivedDate)) {
      result.push({ ...base, id: `principal:${a.id}:${a.returnDate}`, kind: 'principal', date: a.returnDate, amountRupees: capital });
    }
    // Projection only: no claim to reconstruct accrued/settled profit periods.
    // Ordinary contributions use monthly anniversaries, clamped at month end;
    // combined entries use their explicit first-profit-date anchor.
    const anchor = a.firstProfitDueDate || a.receivedDate;
    if (!isISODate(anchor)) continue;
    const elapsed = (Number(today.slice(0, 4)) - Number(anchor.slice(0, 4))) * 12 + Number(today.slice(5, 7)) - Number(anchor.slice(5, 7));
    for (let offset = Math.max(a.firstProfitDueDate ? 0 : 1, elapsed); offset <= Math.max(0, elapsed) + 4; offset++) {
      const date = monthlyAnniversary(anchor, offset);
      if (date < today || date > until || (a.returnDate && date > a.returnDate) || (owner && date >= owner.receivedDate)) continue;
      const amount = Math.round(capital * a.profitPercent) / 100;
      if (amount > 0) result.push({ ...base, id: `profit-estimate:${a.id}:${date}`, kind: 'profit-estimate', date, amountRupees: amount });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.partnerName.localeCompare(b.partnerName) || a.id.localeCompare(b.id));
}
export function planningSummary(allocations: AllocationSummary[], today: string) {
  const obligations = buildObligations(allocations, today);
  const active = allocations.filter(a => a.capitalOutstanding > 0);
  const total = active.reduce((sum, a) => sum + a.capitalOutstanding, 0);
  function concentration(by: 'partner' | 'card') {
    const groups = new Map<string, { id: string; label: string; amount: number; share: number }>();
    for (const a of active) {
      const id = by === 'partner' ? a.partnerId : a.creditCardId || 'cash-bank';
      const label = by === 'partner' ? a.partner?.name || a.partnerId : a.creditCard?.cardName || (a.creditCardId ? 'Unknown card' : 'Cash / bank');
      const group = groups.get(id) || { id, label, amount: 0, share: 0 }; group.amount += a.capitalOutstanding; groups.set(id, group);
    }
    return [...groups.values()].map(g => ({ ...g, share: total ? g.amount / total * 100 : 0 })).sort((a, b) => b.amount - a.amount);
  }
  return { obligations, total, partners: concentration('partner'), cards: concentration('card'),
    overdue: obligations.filter(o => o.kind === 'principal' && o.date < today).reduce((sum, o) => sum + o.amountRupees, 0),
    undated: active.filter(a => !a.returnDate).reduce((sum, a) => sum + a.capitalOutstanding, 0),
    reportedPendingProfit: allocations.reduce((sum, a) => sum + a.profitPending, 0),
    horizons: [7, 30, 90].map(days => {
      const rows = obligations.filter(o => o.date >= today && o.date <= addDays(today, days));
      return { days, through: addDays(today, days), principal: rows.filter(o => o.kind === 'principal').reduce((sum, o) => sum + o.amountRupees, 0), profitEstimate: rows.filter(o => o.kind === 'profit-estimate').reduce((sum, o) => sum + o.amountRupees, 0) };
    }),
  };
}
