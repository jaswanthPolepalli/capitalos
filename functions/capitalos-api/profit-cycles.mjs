export function latestProfitPayment(records) {
  return [...records].sort((a, b) => b.paidDate.localeCompare(a.paidDate) || b.id.localeCompare(a.id, undefined, { numeric: true }))[0];
}

// Recur on a completed payment creates exactly the following month's cycle.
// Unpaid cycles carry forward; they do not create additional monthly debts.
export function recurringProfitAmount(allocation, payment, returns, today) {
  if (!payment || payment.paidDate.slice(0, 7) >= today.slice(0, 7)
      || !payment.notes.includes('Capital reinvested') || payment.notes.includes('Partial payment')) return null;
  const [year, month] = payment.paidDate.split('-').map(Number);
  const cycleStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  // Returns before a cycle starts reduce its principal. Later returns never
  // settle the profit already owed for that cycle.
  const returned = returns.filter(r => r.allocationId === allocation.id && r.returnedDate < cycleStart)
    .reduce((sum, r) => sum + r.amountRupees, 0);
  return Math.round(Math.max(0, allocation.amountRupees - returned) * allocation.profitPercent / 100);
}

export function currentProfitCycleAmount(allocation, records, returns, today) {
  const preceding = latestProfitPayment(records.filter(p => p.paidDate.slice(0, 7) < today.slice(0, 7)));
  return recurringProfitAmount(allocation, preceding, returns, today)
    ?? Math.round(allocation.amountRupees * allocation.profitPercent / 100);
}
