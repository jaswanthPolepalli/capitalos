'use strict';
const { createHash } = require('node:crypto');
const { latestProfitPayment } = require('./profit-cycles.mjs');
const { decode } = require('./combinations.mjs');
const { pendingProfit, paymentMetadata } = require('./payment-groups.mjs');
const { profitMetadata } = require('./profit-sharing.mjs');
const { cashbackStatus, monthlyCashback } = require('./cashback.mjs');
const { visibility } = require('./records.mjs');
const { allRows } = require('./persistence.js');
const { sendOnce } = require('./group-payment-email.js');

const RECIPIENT = 'jackgun9@gmail.com';
const TABLES = { partners: 'COS_Partners', allocations: 'COS_Allocations', returns: 'COS_Returns', profits: 'COS_Profits', cards: 'COS_CreditCards' };
function dailyWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = key => parts.find(p => p.type === key).value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const cutoff = new Date(`${date}T23:00:00+05:30`);
  const start = new Date(`${date}T00:01:00+05:30`);
  return { date, due: Number(part('hour')) >= 23, cutoffAt: now.toISOString(), startAt: start.toISOString(), since: new Date(cutoff.getTime() - 86400000).toISOString() };
}
async function loadSummaryData(table) {
  return Object.fromEntries(await Promise.all(Object.entries(TABLES).map(async ([key, name]) => [key, await allRows(table(name))])));
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Invalid transaction date; summary not sent.');
  return value;
}
function money(value) {
  if (value == null || value === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0) throw new Error('Invalid amount; summary not sent.');
  return Number(value);
}
const sum = values => money(values.reduce((total, value) => total + value, 0));

function buildDailySummary(data, window = dailyWindow()) {
  const visible = (type, row) => !visibility(type, row, data.partners, data.allocations).deleted;
  const partners = data.partners.filter(r => visible('partners', r));
  const cards = data.cards.filter(r => visible('credit-cards', r));
  const allocations = data.allocations.filter(r => visible('allocations', r)).map(r => {
    const metadata = decode(r.notes || '');
    const profitPercent = Number(r.profit_percent || 0);
    if (!Number.isFinite(profitPercent) || profitPercent < 0 || profitPercent > 100) throw new Error('Invalid profit rate; summary not sent.');
    const cashback = r.cashback_data ? JSON.parse(r.cashback_data) : null;
    if (cashback && !['review', 'unpaid', 'paid', 'not_applicable'].includes(cashback.status)) throw new Error('Invalid cashback status; summary not sent.');
    if (cashback?.status === 'paid') { validDate(cashback.paidDate); if (cashback.amountRupees != null) money(cashback.amountRupees); }
    return { id: String(r.ROWID), partnerId: String(r.partner_id), amountRupees: money(r.amount_rupees), profitPercent,
      receivedDate: validDate(r.received_date), returnDate: r.return_date ? validDate(r.return_date) : null,
      dueDateConfirmed: (metadata?.notes ?? r.notes ?? '').includes('WA_CONFIRMED'),
      creditCardId: r.credit_card_id ? String(r.credit_card_id) : null, cashback,
      ...(metadata ? { combination: metadata.combination } : {}), createdAt: (r.source_created_time || r.CREATEDTIME) ? new Date(r.source_created_time || r.CREATEDTIME).toISOString() : '' };
  }).filter(a => a.receivedDate <= window.date);
  const ids = new Set(allocations.map(a => a.id));
  const payments = (rows, type, dateKey, property) => rows.filter(r => visible(type, r) && ids.has(String(r.allocation_id))).map(r => ({
    id: String(r.ROWID), allocationId: String(r.allocation_id), partnerId: String(r.partner_id), amountRupees: money(r.amount_rupees),
    ...(type === 'profit-records' ? { combinedAmountRupees: money(profitMetadata(r.notes || '').combinedAmountRupees ?? r.amount_rupees) } : {}),
    [property]: validDate(r[dateKey]), notes: paymentMetadata(r.notes || '').notes, createdAt: (r.source_created_time || r.CREATEDTIME) ? new Date(r.source_created_time || r.CREATEDTIME).toISOString() : '',
  })).filter(r => r[property] <= window.date);
  const returns = payments(data.returns, 'capital-returns', 'returned_date', 'returnedDate');
  const profits = payments(data.profits, 'profit-records', 'paid_date', 'paidDate');
  const transferred = new Set(allocations.flatMap(a => a.combination?.sources.map(s => s.id) || []));
  const groups = new Map();
  const cashGroups = new Map();
  const cashbackRows = [];
  for (const a of monthlyCashback(allocations)) {
    const partner = partners.find(p => String(p.ROWID) === a.partnerId);
    if (!partner) throw new Error('A contribution has an unavailable partner; summary not sent.');
    if (!a.creditCardId) {
      const remaining = a.amountRupees - sum(returns.filter(r => r.allocationId === a.id).map(r => r.amountRupees));
      if (remaining < 0) throw new Error('Capital returns exceed the contribution; summary not sent.');
      const amount = transferred.has(a.id) ? 0 : remaining;
      if (amount > 0) {
        const dueDate = a.dueDateConfirmed ? a.returnDate : null;
        const key = `${a.partnerId}:${dueDate || 'no-due'}`;
        const row = cashGroups.get(key) || { partnerId: a.partnerId, partner: partner.name || 'Partner', dueDate, amount: 0 };
        row.amount = sum([row.amount, amount]);
        cashGroups.set(key, row);
      }
      continue;
    }
    if (!a.creditCardId) continue;
    const card = cards.find(c => String(c.ROWID) === a.creditCardId && String(c.partner_id) === a.partnerId);
    if (!card || !partner) throw new Error('A contribution has an unavailable card or partner; summary not sent.');
    // A confirmed statement and subsequent unbilled spending are separate balances.
    const billed = Boolean(a.dueDateConfirmed && a.returnDate);
    const key = `${a.partnerId}:${a.creditCardId}:${billed ? 'billed' : 'unbilled'}`;
    const row = groups.get(key) || { cardId: a.creditCardId, billed, partner: partner.name || 'Partner', card: card.card_name || 'Credit card', amount: 0, profit: 0, due: [], last: '', count: 0 };
    const rs = returns.filter(r => r.allocationId === a.id);
    const remaining = a.amountRupees - sum(rs.map(r => r.amountRupees));
    if (remaining < 0) throw new Error('Capital returns exceed the contribution; summary not sent.');
    const outstanding = transferred.has(a.id) ? 0 : remaining;
    const latest = latestProfitPayment(profits.filter(p => p.allocationId === a.id));
    if (latest?.amountRupees === 0 && latest.notes.startsWith('Profit closed without payment')) row.closedWithoutPayment = true;
    row.amount = sum([row.amount, outstanding]);
    row.profit = sum([row.profit, money(pendingProfit(a, allocations, profits, window.date, returns))]);
    // Settled contributions must not contribute stale dates or reorder active balances.
    if (outstanding > 0) {
      row.due.push(billed ? a.returnDate : null);
      row.last = [row.last, a.receivedDate].sort().at(-1);
    }
    row.count++;
    groups.set(key, row);
    if (['review', 'unpaid'].includes(cashbackStatus(a))) cashbackRows.push({ partner: row.partner, card: row.card, amount: a.amountRupees, date: a.receivedDate, status: cashbackStatus(a) });
  }
  const rows = [...groups.values()].filter(row => row.amount > 0).map(row => ({ ...row, due: [...new Set(row.due)].sort((a, b) => (a || '9999').localeCompare(b || '9999')) }));
  rows.sort((a, b) => (a.due.find(Boolean) || '9999').localeCompare(b.due.find(Boolean) || '9999') || (a.billed ? b.last.localeCompare(a.last) : a.last.localeCompare(b.last)) || a.partner.localeCompare(b.partner) || a.card.localeCompare(b.card));
  cashbackRows.sort((a, b) => a.date.localeCompare(b.date) || a.partner.localeCompare(b.partner) || a.card.localeCompare(b.card));
  const cashbacks = allocations.filter(a => a.cashback?.status === 'paid' && a.cashback.paidDate <= window.date);
  const movements = [
    ...allocations.filter(a => !a.combination).map(a => ({ kind: 'additions', date: a.receivedDate, amount: a.amountRupees, createdAt: a.createdAt })),
    ...returns.map(r => ({ kind: 'returns', date: r.returnedDate, amount: r.amountRupees, createdAt: r.createdAt })),
    // CEO paid totals include the CFO share; pending profit still uses partner payments.
    ...profits.map(p => ({ kind: 'profits', date: p.paidDate, amount: p.combinedAmountRupees, createdAt: p.createdAt })),
    ...cashbacks.map(a => ({ kind: 'cashback', date: a.cashback.paidDate, amount: a.cashback.combinedAmountRupees != null ? money(a.cashback.combinedAmountRupees) : a.cashback.amountRupees, createdAt: a.cashback.updatedAt || a.cashback.createdAt })),
  ];
  const today = movements.filter(m => m.date === window.date);
  const cashRows = [...cashGroups.values()].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.partner.localeCompare(b.partner));
  const cardCurrent = rows.reduce((n, row) => n + row.amount, 0);
  const cashCurrent = cashRows.reduce((n, row) => n + row.amount, 0);
  const from = window.startAt || window.since;
  const inPeriod = movements.filter(m => m.date === window.date);
  const activity = Object.fromEntries(['additions', 'returns', 'profits', 'cashback'].map(kind => [kind, sum(inPeriod.filter(m => m.kind === kind).map(m => m.amount ?? 0))]));
  activity.count = inPeriod.length;
  activity.unknownCashbackCount = inPeriod.filter(m => m.kind === 'cashback' && m.amount == null).length;
  return { date: window.date, cutoffAt: window.cutoffAt, startAt: from, rows, cashRows, balances: { cardCurrent, cashCurrent, totalCurrent: sum([cardCurrent, cashCurrent]) }, cb: cashbackRows, activity,
    hasActivity: inPeriod.length > 0 || movements.some(m => m.createdAt && Date.parse(m.createdAt) > Date.parse(window.since) && Date.parse(m.createdAt) <= Date.parse(window.cutoffAt)) };
}

async function deliverSummary({ now = new Date(), mode, requestId, table, send, render }) {
  if (!['scheduled', 'manual'].includes(mode)) throw new Error('Invalid summary mode.');
  if (mode === 'manual' && (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId))) throw Object.assign(new Error('A valid send request ID is required.'), { statusCode: 400 });
  const window = dailyWindow(now);
  if (mode === 'scheduled' && !window.due) return { status: 'outside_schedule' };
  const summary = buildDailySummary(await loadSummaryData(table), window);
  const events = () => allRows(table('COS_Activity'));
  const history = await events();
  const financialTables = ['COS_Allocations', 'COS_Returns', 'COS_Profits'];
  const changed = history.some(e => e.status === 'committed' && financialTables.includes(e.entity_type) && Date.parse(e.occurred_at) > Date.parse(window.since) && Date.parse(e.occurred_at) <= now.getTime());
  if (mode === 'scheduled' && !summary.hasActivity && !changed) return { status: 'no_activity', date: window.date };
  // Render before reserving the send, so PDF/data errors remain safe to retry.
  const pdf = await render(summary);
  const hash = createHash('sha256').update(pdf).digest('hex');
  return sendOnce({ groupId: `daily-summary:${mode}:${mode === 'scheduled' ? window.date : requestId}`, partnerId: 'daily-summary' }, { complete: true }, {
    activity: table('COS_Activity'), events, entityType: 'daily-summary-email', reason: `${mode} summary ${window.date}`,
    send: async () => {
      const receipt = await send({ to: RECIPIENT, subject: `CapitalOS Daily Summary - ${window.date}`,
        text: `Your CapitalOS summary is attached.\nAs of ${new Date(summary.cutoffAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.`,
        attachments: [{ filename: `CapitalOS-Daily-Summary-${window.date}.pdf`, content: pdf, contentType: 'application/pdf' }] });
      if (receipt?.rejected?.length || !receipt?.accepted?.length) throw new Error('SMTP did not accept the summary.');
      return { status: 'sent', recipient: RECIPIENT, date: window.date, cutoffAt: summary.cutoffAt, pdfSha256: hash };
    },
  });
}
module.exports = { RECIPIENT, dailyWindow, loadSummaryData, buildDailySummary, deliverSummary };
