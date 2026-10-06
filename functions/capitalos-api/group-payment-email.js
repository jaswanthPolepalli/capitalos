'use strict';
const { createHash } = require('node:crypto');

// Reserve the email separately from the financial save. A retry may recover a
// saved payment, but must never submit the same confirmation to SMTP twice.
// An interrupted SMTP attempt is intentionally not retried automatically.
async function sendOnce(input, result, { activity, events, send, entityType = 'payment-group-email', reason = `Confirmation for payment group ${input.groupId}` }) {
  if (!result.complete) return { status: 'incomplete' };
  const operationId = `email-${createHash('sha256').update(input.groupId).digest('hex')}`;
  const lookup = async () => {
    const rows = await events();
    const outcome = rows.find(row => row.event_id === `${operationId}-result`);
    if (outcome) return JSON.parse(outcome.after_state);
    return rows.some(row => row.event_id === operationId) ? { status: 'unconfirmed' } : null;
  };
  try {
    const previous = await lookup();
    if (previous) return previous;
    const base = { operation_id: operationId, entity_type: entityType, entity_id: input.partnerId,
      action: 'notify', actor: 'System', occurred_at: new Date().toISOString(), before_state: 'null', reason };
    try {
      await activity.insertRow({ ...base, event_id: operationId, status: 'pending', after_state: JSON.stringify({ groupId: input.groupId, status: 'pending' }) });
    } catch {
      return await lookup() || { status: 'unconfirmed' };
    }
    let email;
    try { email = await send(); }
    catch { email = { status: 'unconfirmed' }; }
    await activity.insertRow({ ...base, event_id: `${operationId}-result`, status: email.status === 'unconfirmed' ? 'unconfirmed' : 'committed', after_state: JSON.stringify(email) });
    return email;
  } catch {
    // Financial records remain successful even if mail or its audit fails.
    return { status: 'unconfirmed' };
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function groupedEmail(input, result, partnerName, allocations, cards, appBaseUrl) {
  const profit = input.kind === 'profit';
  const title = profit ? 'Profit Payment Confirmation' : 'Capital Return Confirmation';
  const saved = result.results.filter(item => item.status === 'saved' && item.record);
  const total = saved.reduce((sum, item) => sum + item.record.amountRupees, 0);
  const rows = saved.map((item, index) => {
    const allocation = allocations.find(a => a.id === item.allocationId);
    if (!allocation) throw new Error('Contribution is unavailable for the email confirmation.');
    const original = input.entries.find(entry => entry.allocationId === item.allocationId);
    const source = allocation.creditCardId ? cards.find(card => card.id === allocation.creditCardId)?.cardName || 'Credit card' : 'Cash';
    const rate = profit && allocation.amountRupees > 0 ? Math.round(item.record.amountRupees / allocation.amountRupees * 10000) / 100 : null;
    const fields = [
      ['Contribution', money(allocation.amountRupees)], ['Source', source], ['Amount given date', formatDate(allocation.receivedDate)],
      [profit ? 'Profit paid' : 'Capital returned', money(item.record.amountRupees)],
      ...(rate !== null ? [['Profit paid as % of this contribution', `${rate}%`]] : []),
      [profit ? 'Profit remaining on this entry' : 'Capital remaining on this entry', money(original.expectedBalance - item.record.amountRupees)],
    ];
    return `<h3>Entry ${index + 1}</h3><table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:sans-serif;">${fields.map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table>`;
  });
  const portalUrl = `${appBaseUrl}/#/p/partner-${encodeURIComponent(input.partnerId)}`;
  return `<h2>${title}</h2>
<p>Hi ${escapeHtml(partnerName)},</p>
<p>Total ${profit ? 'profit paid' : 'capital returned'}: <strong>${money(total)}</strong><br/>Date: ${formatDate(input.date)}<br/>Entries: ${saved.length}${input.reference.trim() ? `<br/>Reference: ${escapeHtml(input.reference.trim())}` : ''}</p>
<h3>Breakdown</h3>${rows.join('\n')}
<p>Remaining amounts apply only to the listed entries, as of this payment.</p>
<p><a href="${escapeHtml(portalUrl)}">View My Portal →</a></p>
<p>Thank you.<br/>— CapitalOS</p>`;
}
module.exports = { sendOnce, groupedEmail };
