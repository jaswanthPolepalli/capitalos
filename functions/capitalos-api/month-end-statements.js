'use strict';
const { createHash } = require('node:crypto');
const { decode } = require('./combinations.mjs');
const { pendingProfit, paymentMetadata } = require('./payment-groups.mjs');
const { visibility } = require('./records.mjs');

function monthEndWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  const month = `${part('year')}-${part('month')}`;
  const last = new Date(Date.UTC(Number(part('year')), Number(part('month')), 0)).getUTCDate();
  const date = `${month}-${part('day')}`;
  return { month, from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, cutoffAt: now.toISOString(),
    due: Number(part('day')) === last && Number(part('hour')) >= 10, date };
}

function buildStatements(data, window) {
  const visible = (type, row) => !visibility(type, row, data.partners, data.allocations).deleted;
  const amount = row => {
    const value = Number(row.amount_rupees);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid money value; monthly emails were not prepared.');
    return value;
  };
  const date = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Invalid business date; monthly emails were not prepared.');
    return value;
  };
  const allocations = data.allocations.filter(r => visible('allocations', r)).map(r => {
    const metadata = decode(r.notes || '');
    const profitPercent = Number(r.profit_percent || 0);
    if (!Number.isFinite(profitPercent) || profitPercent < 0 || profitPercent > 100) throw new Error('Invalid profit rate; monthly emails were not prepared.');
    return { id: String(r.ROWID), partnerId: String(r.partner_id), amountRupees: amount(r), profitPercent,
      cashback: r.cashback_data ? JSON.parse(r.cashback_data) : null,
      receivedDate: date(r.received_date), ...(metadata ? { combination: metadata.combination } : {}) };
  }).filter(a => a.receivedDate <= window.date);
  const activeIds = new Set(allocations.map(a => a.id));
  const returns = data.returns.filter(r => visible('capital-returns', r)).map(r => ({ id: String(r.ROWID), partnerId: String(r.partner_id), allocationId: String(r.allocation_id), amountRupees: amount(r), returnedDate: date(r.returned_date) }))
    .filter(r => activeIds.has(r.allocationId) && r.returnedDate <= window.date);
  const profits = data.profits.filter(r => visible('profit-records', r)).map(r => ({ id: String(r.ROWID), partnerId: String(r.partner_id), allocationId: String(r.allocation_id), amountRupees: amount(r), paidDate: date(r.paid_date), notes: paymentMetadata(r.notes).notes }))
    .filter(r => activeIds.has(r.allocationId) && r.paidDate <= window.date);
  // Monthly totals are cash movements. Capital combinations are internal
  // transfers and never count as a second contribution.
  const sum = (rows, accept) => {
    const total = rows.filter(accept).reduce((n, row) => n + row.amountRupees, 0);
    if (!Number.isSafeInteger(total)) throw new Error('Monthly total exceeds supported precision.');
    return total;
  };
  return data.partners.filter(p => visible('partners', p)).map(p => {
    const partnerId = String(p.ROWID);
    const pa = allocations.filter(a => a.partnerId === partnerId);
    const original = pa.filter(a => !a.combination);
    const pr = returns.filter(r => r.partnerId === partnerId);
    const pp = profits.filter(r => r.partnerId === partnerId);
    const contributed = sum(original, a => a.receivedDate >= window.from);
    const returned = sum(pr, r => r.returnedDate >= window.from);
    const profitPaid = sum(pp, r => r.paidDate >= window.from);
    const cashbackPayments = pa.map(a => a.cashback).filter(cb => cb?.status === 'paid' && date(cb.paidDate) >= window.from && cb.paidDate <= window.date);
    const cashbackPaid = cashbackPayments.reduce((total, cb) => total + (cb.amountRupees == null ? 0 : amount({ amount_rupees: cb.amountRupees })), 0);
    const unknownCashbackCount = cashbackPayments.filter(cb => cb.amountRupees == null).length;
    const totalProfitsReceived = profitPaid + cashbackPaid;
    const openingCapital = sum(original, a => a.receivedDate < window.from) - sum(pr, r => r.returnedDate < window.from);
    const closingCapital = openingCapital + contributed - returned;
    const profitRemaining = pa.reduce((n, a) => n + pendingProfit(a, allocations, profits, window.date, returns), 0);
    if (closingCapital < 0 || !Number.isSafeInteger(profitRemaining) || profitRemaining < 0) throw new Error('Invalid closing balance; monthly emails were not prepared.');
    return { partnerId, partnerName: String(p.name || 'Partner'), recipient: String(p.email || '').trim(), month: window.month,
      from: window.from, to: window.date, cutoffAt: window.cutoffAt, contributed, returned, profitPaid, cashbackPaid, totalProfitsReceived, unknownCashbackCount, profitRemaining, openingCapital, closingCapital };
  });
}

function renderStatement(statement, appBaseUrl) {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  const monthLabel = new Date(`${statement.month}-01T12:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' });
  const cutoff = new Date(statement.cutoffAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST';
  const period = `${statement.from} to ${statement.to}`;
  const activity = [['Capital contributed this month', statement.contributed], ['Capital returned this month', statement.returned], ['Profits paid this month', statement.profitPaid], ['Cashback paid this month', statement.cashbackPaid || 0], ['Total profits received this month', statement.totalProfitsReceived ?? statement.profitPaid]];
  const balances = [['Capital outstanding at start of month', statement.openingCapital], ['Capital outstanding at cutoff', statement.closingCapital], ['Profit remaining at cutoff (including earlier unpaid dues)', statement.profitRemaining]];
  const table = rows => `<table cellpadding="10" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;max-width:600px;font-family:sans-serif;">${rows.map(([name, value]) => `<tr><th align="left">${escape(name)}</th><td align="right">${money(value)}</td></tr>`).join('')}</table>`;
  const unknownNote = statement.unknownCashbackCount ? `${statement.unknownCashbackCount} cashback amount(s) not recorded. Totals include known amounts only.` : '';
  const text = [`Monthly Statement — ${monthLabel}`, `Hi ${statement.partnerName},`, `Period: ${period}`, `As of ${cutoff}`, '', unknownNote, 'Activity this month', ...activity.map(([k, v]) => `${k}: ${money(v)}`), '', 'Balances', ...balances.map(([k, v]) => `${k}: ${money(v)}`), '', 'This statement includes records available at the cutoff above. Later entries and corrections will appear in your updated portal.', 'Profit remaining is the unpaid balance recorded in CapitalOS, including earlier dues. Cashback does not reduce pending profit. Future projected profit is excluded.', `${appBaseUrl}/#/p/partner-${encodeURIComponent(statement.partnerId)}`, '', 'Thank you.', '— CapitalOS'].join('\n');
  const html = `<div style="font-family:sans-serif;color:#202b27;max-width:640px;"><h2>Monthly Statement — ${monthLabel}</h2><p>Hi ${escape(statement.partnerName)},</p><p>Period: ${period}<br/><strong>As of ${escape(cutoff)}</strong></p><p>${escape(unknownNote)}</p><h3>Activity this month</h3>${table(activity)}<h3>Balances</h3>${table(balances)}<p>This statement includes records available at the cutoff above. Later entries and corrections will appear in your updated portal.</p><p>Profit remaining is the unpaid balance recorded in CapitalOS, including earlier dues. Cashback does not reduce pending profit. Future projected profit is excluded.</p><p><a href="${escape(appBaseUrl)}/#/p/partner-${encodeURIComponent(statement.partnerId)}">View My Portal →</a></p><p>Thank you.<br/>— CapitalOS</p></div>`;
  return { subject: `Monthly Statement — ${monthLabel} — CapitalOS`, html, text };
}

async function sendMonthlyStatements({ now = new Date(), loadData, activity, events, send, remainingTime = () => Infinity }) {
  const window = monthEndWindow(now);
  if (!window.due) return { skipped: 'outside_schedule', results: [] };
  // All required datasets must load and validate before a single email is sent.
  const statements = buildStatements(await loadData(), window);
  const history = await events();
  const prepared = [];
  for (const statement of statements) {
    const key = `month-${createHash('sha256').update(`${window.month}:${statement.partnerId}`).digest('hex')}`;
    let snapshot = history.find(row => row.event_id === key);
    if (!snapshot) {
      const row = { event_id: key, operation_id: key, entity_type: 'monthly-statement-email', entity_id: statement.partnerId, action: 'notify', status: 'prepared', actor: 'System', occurred_at: now.toISOString(), before_state: 'null', after_state: JSON.stringify(statement), reason: `Monthly statement ${window.month}` };
      if (row.after_state.length > 10000) throw new Error('Monthly statement is too large to preserve in Activity.');
      try { snapshot = await activity.insertRow(row); }
      catch {
        snapshot = (await events()).find(r => r.event_id === key);
        if (!snapshot) throw new Error('Could not reserve every monthly statement; no emails sent by this run.');
      }
    }
    prepared.push({ key, snapshot, statement: JSON.parse(snapshot.after_state) });
  }
  const results = [];
  for (const item of prepared) {
    const { key, snapshot, statement } = item;
    const outcomeId = `${key}-done`, sendId = `${key}-send`;
    const latest = await events();
    const done = latest.find(e => e.event_id === outcomeId);
    if (done) { results.push(JSON.parse(done.after_state)); continue; }
    if (latest.some(e => e.event_id === sendId)) { results.push({ partnerId: statement.partnerId, status: 'unconfirmed' }); continue; }
    if (remainingTime() < 45000) { results.push({ partnerId: statement.partnerId, status: 'not_attempted' }); continue; }
    const base = { operation_id: key, entity_type: snapshot.entity_type, entity_id: statement.partnerId, action: 'notify', actor: 'System', occurred_at: new Date().toISOString(), before_state: 'null', reason: snapshot.reason };
    try {
      await activity.insertRow({ ...base, event_id: sendId, status: 'pending', after_state: JSON.stringify({ month: statement.month, recipient: statement.recipient }) });
    } catch { results.push({ partnerId: statement.partnerId, status: 'unconfirmed' }); continue; }
    let status = 'no_email';
    if (statement.recipient) {
      try { await send(statement); status = 'sent'; }
      catch { status = 'unconfirmed'; }
    }
    const result = { partnerId: statement.partnerId, status, month: statement.month, cutoffAt: statement.cutoffAt };
    try {
      await activity.insertRow({ ...base, event_id: outcomeId, status: status === 'unconfirmed' ? 'unconfirmed' : 'committed', after_state: JSON.stringify(result) });
      results.push(result);
    } catch { results.push({ ...result, status: 'unconfirmed' }); }
  }
  return { month: window.month, results };
}
module.exports = { monthEndWindow, buildStatements, renderStatement, sendMonthlyStatements };
