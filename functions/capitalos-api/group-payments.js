const { profitNotes } = require('./profit-sharing.mjs');
'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { preparePaymentGroup, paymentNotes } = require('./payment-groups.mjs');

// A unique, append-only activity intent reserves each group before any financial
// write. Interrupted/uncertain groups are inspectable, never silently replayed.
module.exports = async function groupPayments(input, deps) {
  const { activity, fetchContext, insert, readRecords, map, today } = deps;
  if (!input || !/^[a-zA-Z0-9-]{16,80}$/.test(input.groupId || '')) throw Object.assign(new Error('Invalid payment group ID.'), { statusCode: 400 });
  const eventId = `payment-${input.groupId}`;
  if (eventId.length > 80) throw Object.assign(new Error('Payment group ID is too long.'), { statusCode: 400 });
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const replay = async () => {
    const events = await deps.events();
    const intent = events.find(e => e.event_id === eventId);
    if (!intent) throw new Error('Unable to confirm the payment reservation. Check Activity before trying again.');
    if (JSON.parse(intent.after_state).fingerprint !== fingerprint) throw Object.assign(new Error('This payment group was already used with different values.'), { statusCode: 409 });
    const outcome = events.find(e => e.operation_id === input.groupId && e.event_id !== eventId);
    if (outcome) {
      const saved = JSON.parse(outcome.after_state);
      const records = await readRecords();
      const results = saved.results.map(item => {
        if (!item.recordId) return item;
        const record = records.find(r => r.id === item.recordId);
        const original = input.entries.find(e => e.allocationId === item.allocationId);
        if (!record || record.paymentGroupId !== input.groupId || (record.combinedAmountRupees ?? record.amountRupees) !== original.amountRupees || (record.partnerAmountRupees ?? null) !== (original.partnerAmountRupees ?? null) || Boolean(record.noCfoSplit) !== Boolean(original.noCfoSplit) || (record.partnerProfitPercent ?? null) !== (original.partnerProfitPercent ?? null) || (record.paidDate || record.returnedDate) !== input.date) return { allocationId: item.allocationId, status: 'unconfirmed' };
        return { allocationId: item.allocationId, status: 'saved', record };
      });
      return { groupId: input.groupId, complete: results.every(r => r.status === 'saved'), results };
    }
    // A missing outcome may still be in flight. Do not infer completion from
    // a snapshot, return a share link, or insert another copy.
    return { groupId: input.groupId, complete: false, results: input.entries.map(e => ({ allocationId: e.allocationId, status: 'unconfirmed' })) };
  };
  if ((await deps.events()).some(e => e.event_id === eventId)) return replay();
  const context = await fetchContext();
  if (!context.partnerActive) throw Object.assign(new Error('Active partner not found.'), { statusCode: 400 });
  const prepared = preparePaymentGroup(input, context.allocations, context.returns, context.profits, today);
  const base = { operation_id: input.groupId, entity_type: 'payment-group', entity_id: input.partnerId,
    action: 'create', actor: 'Unverified caller', occurred_at: new Date().toISOString(), before_state: 'null', reason: `Grouped ${input.kind} payment` };
  try {
    await activity.insertRow({ ...base, event_id: eventId, status: 'pending', after_state: JSON.stringify({ fingerprint, kind: input.kind, entries: input.entries.map(e => e.allocationId) }) });
  } catch { return replay(); }
  const results = [];
  let interrupted = false;
  for (const entry of prepared) {
    if (interrupted) { results.push({ allocationId: entry.allocationId, status: 'not_attempted' }); continue; }
    try {
      const record = map(await insert({ allocation_id: entry.allocationId, partner_id: entry.partnerId,
        amount_rupees: entry.amountRupees, ...(input.kind === 'profit' ? { paid_date: entry.paidDate } : { returned_date: entry.returnedDate }),
        notes: paymentNotes(input.kind === 'profit' ? profitNotes(entry.notes, entry.combinedAmountRupees, entry.partnerProfitPercent, entry.profitCapitalRupees, entry.noCfoSplit, entry.partnerAmountRupees) : entry.notes, input.groupId) }));
      results.push({ allocationId: entry.allocationId, status: 'saved', record });
    } catch {
      // Even a rejected datastore response may have committed. Retain the claim
      // and stop, rather than sending more writes after an ambiguous outcome.
      results.push({ allocationId: entry.allocationId, status: 'unconfirmed' }); interrupted = true;
    }
  }
  const result = { groupId: input.groupId, complete: !interrupted, results };
  // Store only row IDs in the outcome (within the activity text limit); records
  // are read afresh on replay so later corrections/deletions cannot be re-shared
  // as the original amounts.
  const outcome = { ...result, results: results.map(({ record, ...r }) => ({ ...r, ...(record ? { recordId: record.id } : {}) })) };
  try {
    await activity.insertRow({ ...base, event_id: randomUUID(), status: interrupted ? 'unconfirmed' : 'committed', after_state: JSON.stringify(outcome) });
  } catch {
    return { groupId: input.groupId, complete: false, results: input.entries.map(e => ({ allocationId: e.allocationId, status: 'unconfirmed' })) };
  }
  return result;
};
