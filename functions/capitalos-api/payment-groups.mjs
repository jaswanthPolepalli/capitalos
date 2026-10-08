import { latestProfitPayment, recurringProfitAmount } from './profit-cycles.mjs';
import { firstCombinedProfitDate } from './combinations.mjs';

const groupPattern = /\nPAYMENT_GROUP:([a-zA-Z0-9-]{16,80})$/;
export function paymentMetadata(notes = '') {
  const match = String(notes).match(groupPattern);
  return { notes: String(notes).replace(groupPattern, ''), ...(match ? { paymentGroupId: match[1] } : {}) };
}
export function paymentNotes(notes, groupId) {
  return `${paymentMetadata(notes).notes.trim()}${groupId ? `\nPAYMENT_GROUP:${groupId}` : ''}`;
}

// Shared with the client so partial payments and combined-source profit use the
// same balance when displayed, reviewed, and validated immediately before save.
export function pendingProfit(a, allocations, profits, today, returns = []) {
  const records = profits.filter(p => p.allocationId === a.id);
  const total = records.reduce((sum, p) => sum + p.amountRupees, 0);
  const cycle = Math.round(a.amountRupees * a.profitPercent / 100);
  const latest = latestProfitPayment(records);
  let pending = total === 0 && !records.some(p => p.notes.startsWith('Profit closed without payment')) ? cycle : recurringProfitAmount(a, latest, returns, today) ?? 0;
  if (total > 0 && latest?.notes.includes('Partial payment')) {
    const amount = latest.notes.match(/Partial payment · Remaining: ₹([\d,]+)/);
    const percent = latest.notes.match(/Partial payment · Remaining %: ([\d.]+)%/);
    pending = amount ? Number(amount[1].replace(/,/g, '')) : percent ? Math.round(a.amountRupees * Number(percent[1]) / 100) : Math.max(0, cycle - total);
  }
  const source = allocations.flatMap(parent => parent.combination?.sources || []).find(s => s.id === a.id);
  if (source) pending = Math.max(0, source.pending - records.filter(p => !source.profitRecordIds.includes(p.id)).reduce((sum, p) => sum + p.amountRupees, 0));
  if (source && records.some(p => p.amountRupees === 0 && p.notes.startsWith('Profit closed without payment') && !source.profitRecordIds.includes(p.id))) pending = 0;
  if (a.receivedDate > today || (a.combination && today < firstCombinedProfitDate(a.receivedDate))) return 0;
  return pending;
}

export function preparePaymentGroup(input, allocations, returns, profits, today) {
  const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (!input || !/^[a-zA-Z0-9-]{16,80}$/.test(input.groupId || '')) fail('A valid payment group ID is required.');
  if (!['profit', 'capital'].includes(input.kind)) fail('Choose profit or capital return.');
  if (typeof input.partnerId !== 'string' || !input.partnerId) fail('Choose one partner.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date || input.date > today) fail('Enter a valid payment date, no later than today.');
  if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 50) fail('Select between 1 and 50 entries.');
  if (input.entries.some(e => !e || typeof e.allocationId !== 'string' || typeof e.recur !== 'boolean')) fail('Each payment must identify a contribution and its recurring setting.');
  if (new Set(input.entries.map(e => e.allocationId)).size !== input.entries.length) fail('Select each contribution only once.');
  if (typeof input.notes !== 'string' || input.notes.length > 1000 || typeof input.reference !== 'string' || input.reference.length > 200) fail('Shorten the notes or reference.');
  if (/PAYMENT_GROUP:|Partial payment|Remaining:|Remaining %:|Capital reinvested|DELETED:/i.test(`${input.notes} ${input.reference}`)) fail('Use the payment controls for partial or recurring payments; notes cannot contain system tags.');
  return input.entries.map(entry => {
    const a = allocations.find(a => a.id === entry.allocationId && a.partnerId === input.partnerId);
    if (!a) fail('A selected contribution is no longer available for this partner. Refresh and review.');
    if (!Number.isSafeInteger(entry.amountRupees) || entry.amountRupees <= 0) fail('Enter a positive whole-rupee amount for every selected entry.');
    if (input.date < a.receivedDate) fail('Payment cannot precede a contribution’s received date.');
    const reserved = allocations.some(parent => parent.combination?.sources.some(s => s.id === a.id));
    const balance = input.kind === 'profit' ? pendingProfit(a, allocations, profits, today, returns)
      : reserved || a.receivedDate > today ? 0 : a.amountRupees - returns.filter(r => r.allocationId === a.id).reduce((sum, r) => sum + r.amountRupees, 0);
    if (entry.expectedBalance !== balance) fail('A selected balance changed. Close this form, refresh, and review the selection again.');
    if (balance <= 0 || entry.amountRupees > balance) fail(`Payment exceeds the available ${input.kind === 'profit' ? 'profit' : 'capital'} for a selected entry.`);
    if (input.kind === 'profit' && profits.some(p => p.allocationId === a.id && p.paidDate > input.date)) fail('Use a date on or after this contribution’s latest profit payment.');
    const outstanding = a.amountRupees - returns.filter(r => r.allocationId === a.id).reduce((sum, r) => sum + r.amountRupees, 0);
    if (entry.recur && (input.kind !== 'profit' || reserved || outstanding <= 0)) fail('Returned or combined source capital cannot recur.');
    const notes = [input.notes.trim(), input.reference.trim() ? `Ref: ${input.reference.trim()}` : '',
      input.kind === 'profit' && balance > entry.amountRupees ? `Partial payment · Remaining: ₹${(balance - entry.amountRupees).toLocaleString('en-IN')}` : '',
      entry.recur ? 'Capital reinvested' : ''].filter(Boolean).join(' · ');
    return { allocationId: a.id, partnerId: input.partnerId, amountRupees: entry.amountRupees,
      ...(input.kind === 'profit' ? { paidDate: input.date } : { returnedDate: input.date }),
      notes, paymentGroupId: input.groupId };
  });
}
