import { cashbackTotals } from '../../../functions/capitalos-api/cashback.mjs';
import type { CapitalAllocation } from '../store';
const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;
/** Regular profit stays separate: cashback must never settle a profit obligation. */
export function EarningsSummary({ allocations, regularProfit }: { allocations: CapitalAllocation[]; regularProfit: number }) {
  const { totalCashbackPaid, unknownCashbackCount } = cashbackTotals(allocations);
  if (!allocations.some(a => a.creditCardId)) return null;
  return <div className="earnings-summary" aria-label="Profit and cashback totals">
    <div><span>Cashback paid</span><strong>{money(totalCashbackPaid)}</strong></div>
    <div><span>Total profits received</span><strong>{money(regularProfit + totalCashbackPaid)}</strong></div>
    <p className="earnings-note">Total profits received = regular profit + cashback. Pending profit excludes cashback.{unknownCashbackCount > 0 && ` ${unknownCashbackCount} cashback amount(s) not recorded; totals include known amounts only.`}</p>
  </div>;
}
