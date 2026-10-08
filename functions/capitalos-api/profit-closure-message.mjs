/** One transaction snapshot shared by email and WhatsApp. Call with active records only. */
export function profitClosureMessage(partner, allocation, current, profits, cardName) {
  const money = value => `₹${Number(value).toLocaleString('en-IN')}`;
  const earlier = profits.filter(p => p.allocationId === allocation.id && p.id !== current.id && p.amountRupees > 0 && p.paidDate <= current.paidDate);
  const partial = earlier.filter(p => p.notes?.includes('Partial payment')).reduce((s, p) => s + p.amountRupees, 0);
  const other = earlier.filter(p => !p.notes?.includes('Partial payment')).reduce((s, p) => s + p.amountRupees, 0);
  const cashback = allocation.cashback?.status === 'paid' ? allocation.cashback : null;
  const unknown = cashback && cashback.amountRupees == null;
  const total = current.amountRupees + partial + other + (cashback?.amountRupees ?? 0);
  const date = new Date(`${allocation.receivedDate}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const lines = ['Profit Closure Confirmation', '', `Hi ${partner.name},`, '', 'Your profit for this transaction has been closed.', '',
    `Transaction: ${cardName || (allocation.creditCardId ? 'Credit Card' : 'Cash')}`,
    `Amount given: ${money(allocation.amountRupees)}`, `Amount given date: ${date}`, '', `Current profit: ${money(current.amountRupees)}`];
  if (partial > 0) lines.push(`Partial profits paid earlier: ${money(partial)}`);
  // Recurring contributions may also have completed payments from previous cycles.
  if (other > 0) lines.push(`Other profits paid earlier: ${money(other)}`);
  if (cashback) lines.push(`Cashback paid: ${unknown ? 'Amount not recorded' : money(cashback.amountRupees)}`);
  lines.push('', `Total profit received: ${unknown ? `At least ${money(total)} (cashback amount not recorded)` : money(total)}`,
    `Total return: ${unknown || allocation.amountRupees <= 0 ? 'Unavailable' : `${(total / allocation.amountRupees * 100).toFixed(2)}%`}`, '', 'Thank you,', 'CapitalOS');
  return lines.join('\n');
}
