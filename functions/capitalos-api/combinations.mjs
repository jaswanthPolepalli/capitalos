import { latestProfitPayment, recurringProfitAmount } from './profit-cycles.mjs';
// One immutable combination record owns its source links. Source rows are never
// rewritten or deleted, so committing a combination requires one datastore write.
const PREFIX = 'CAPITALOS_COMBINATION_V1:';
function decode(notes = '') {
  if (!notes.startsWith(PREFIX)) return null;
  return JSON.parse(notes.slice(PREFIX.length));
}
function firstCombinedProfitDate(effectiveDate) {
  // Combining capital starts a new profit cycle on the effective date.
  return effectiveDate;
}
function pending(allocation, profits, returns = [], today = new Date().toLocaleDateString('en-CA')) {
  if (allocation.combination && today < firstCombinedProfitDate(allocation.receivedDate)) return 0;
  const latest = latestProfitPayment(profits);
  // Only profit payments settle profit. Returning principal must not reduce
  // the debt preserved when the remaining capital is combined.
  const expected = Math.round(allocation.amountRupees * allocation.profitPercent / 100);
  if (!latest) return expected;
  if (!latest.notes.includes('Partial payment')) return recurringProfitAmount(allocation, latest, returns, today) ?? 0;
  const amount = latest.notes.match(/Remaining: ₹([\d,]+)/);
  if (amount) return Number(amount[1].replace(/,/g, ''));
  const percent = latest.notes.match(/Remaining %: ([\d.]+)%/);
  if (percent) return Math.round(allocation.amountRupees * Number(percent[1]) / 100);
  return Math.max(0, expected - profits.reduce((s, p) => s + p.amountRupees, 0));
}
function snapshot(allocations, returns, profits) {
  const ordered = rows => rows.sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({
    allocations: ordered(allocations.map(a => ({ id: a.id, partnerId: a.partnerId, amountRupees: a.amountRupees, profitPercent: a.profitPercent, receivedDate: a.receivedDate, returnDate: a.returnDate || null, creditCardId: a.creditCardId || null, notes: a.notes || '', combination: a.combination || null }))),
    returns: ordered(returns.map(r => ({ id: r.id, allocationId: r.allocationId, amountRupees: r.amountRupees, returnedDate: r.returnedDate, notes: r.notes || '' }))),
    profits: ordered(profits.map(p => ({ id: p.id, allocationId: p.allocationId, amountRupees: p.amountRupees, paidDate: p.paidDate, notes: p.notes || '' }))),
  });
}
function revertReason(allocation, allocations, returns, profits) {
  const combination = allocation?.combination;
  if (!combination) return 'This entry is not a capital combination.';
  if (!combination.revertSnapshot) return 'This older combination has no saved baseline for a safe revert.';
  if (combination.revertBlocked) return 'Records have been modified since combination.';
  if (allocations.some(a => a.combination?.sources.some(s => s.id === allocation.id))) return 'This entry has been used in another combination.';
  const ids = new Set(combination.sources.map(s => s.id));
  if (returns.some(r => r.allocationId === allocation.id) || profits.some(p => p.allocationId === allocation.id)) return 'New payments or capital returns have been recorded.';
  const current = snapshot(allocations.filter(a => ids.has(a.id)), returns.filter(r => ids.has(r.allocationId)), profits.filter(p => ids.has(p.allocationId)));
  if (current !== combination.revertSnapshot) return 'Original contributions or their payment history have changed.';
  return null;
}
function buildCombination(input, allocations, returns, profits) {
  const ids = input.allocationIds;
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.length < 2) throw new Error('Select at least two different contributions.');
  const validDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!validDate(input.effectiveDate)) throw new Error('Choose a valid effective date.');
  if (!Number.isFinite(input.profitPercent) || input.profitPercent < 0 || input.profitPercent > 100) throw new Error('Enter a rate from 0 to 100.');
  if (input.returnDate && (!validDate(input.returnDate) || input.returnDate < input.effectiveDate)) throw new Error('Return date must be on or after the effective date.');
  const selected = ids.map(id => allocations.find(a => a.id === id));
  if (selected.some(a => !a)) throw new Error('A selected contribution no longer exists.');
  if (selected.some(a => a.partnerId !== selected[0].partnerId)) throw new Error('Select contributions from the same partner.');
  if (selected.some(a => a.creditCardId !== selected[0].creditCardId)) throw new Error('Select cash contributions together, or contributions from the same credit card.');
  const used = new Set(allocations.flatMap(a => a.combination?.sources.map(s => s.id) || []));
  if (ids.some(id => used.has(id))) throw new Error('A selected contribution is already combined. Refresh and select again.');
  const sources = selected.map(a => {
    const rs = returns.filter(r => r.allocationId === a.id);
    const ps = profits.filter(p => p.allocationId === a.id);
    if (a.receivedDate > input.effectiveDate || [...rs.map(r => r.returnedDate), ...ps.map(p => p.paidDate)].some(d => d > input.effectiveDate)) throw new Error('Effective date must be on or after all source contributions and payments.');
    const capital = a.amountRupees - rs.reduce((s, r) => s + r.amountRupees, 0);
    if (capital <= 0) throw new Error('Only contributions with remaining capital can be combined.');
    return { id: a.id, capital, pending: pending(a, ps, rs, input.effectiveDate), profitRecordIds: ps.map(p => p.id) };
  });
  return {
    partnerId: selected[0].partnerId,
    amountRupees: sources.reduce((s, a) => s + a.capital, 0),
    profitPercent: input.profitPercent, receivedDate: input.effectiveDate,
    returnDate: input.returnDate || null, creditCardId: selected[0].creditCardId,
    notes: '', combination: { effectiveDate: input.effectiveDate, sources,
      revertSnapshot: snapshot(selected, returns.filter(r => ids.includes(r.allocationId)), profits.filter(p => ids.includes(p.allocationId))) },
  };
}
export { PREFIX, decode, pending, buildCombination, revertReason, firstCombinedProfitDate };
