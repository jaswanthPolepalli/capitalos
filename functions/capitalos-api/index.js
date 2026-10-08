"use strict";

/**
 * CapitalOS API — Catalyst Advanced I/O (AIO) Function
 *
 * The Catalyst AIO runtime injects 'catalyst' as a global.
 * No npm SDK import required.
 *
 * Routes:
 *   GET    /server/capitalos-api/partners
 *   POST   /server/capitalos-api/partners
 *   PATCH  /server/capitalos-api/partners/:id
 *   DELETE /server/capitalos-api/partners/:id   — soft-delete partner + cascade
 *   GET    /server/capitalos-api/allocations
 *   POST   /server/capitalos-api/allocations
 *   PATCH  /server/capitalos-api/allocations/:id
 *   DELETE /server/capitalos-api/allocations/:id
 *   GET    /server/capitalos-api/capital-returns
 *   POST   /server/capitalos-api/capital-returns
 *   GET    /server/capitalos-api/profit-records
 *   POST   /server/capitalos-api/profit-records
 *   GET    /server/capitalos-api/credit-cards
 *   POST   /server/capitalos-api/credit-cards
 *   PATCH  /server/capitalos-api/credit-cards/:id
 *   DELETE /server/capitalos-api/credit-cards/:id
 */

const catalyst = require("zcatalyst-sdk-node");
const persistence = require("./persistence.js");
const { prepareCashback, monthlyCashback } = require("./cashback.mjs");
const nodemailer = require("nodemailer");
const groupPayments = require('./group-payments.js');
const groupPaymentEmail = require('./group-payment-email.js');
const { paymentMetadata, paymentNotes } = require('./payment-groups.mjs');
let importTools;
const importsReady = import('./imports.mjs').then(module => { importTools = module; });
let combinations;
const combinationsReady = import('./combinations.mjs').then(module => { combinations = module; });

// ── Gmail SMTP transporter ────────────────────────────────────────────────────
// Uses Gmail App Password — no domain verification required.
const GMAIL_USER = "jackgun9@gmail.com";
const GMAIL_APP_PASS = "bnoi thdv bfez owqv";

const smtpTransporter = nodemailer.createTransport({
  service: "gmail",
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASS,
  },
});

// ── Email helper ─────────────────────────────────────────────────────────────
async function sendPartnerEmail(req, partnerId, subject, htmlBody) {
  try {
    const allPartners = await fetchAllRows(req, TABLES.PARTNERS);
    const partnerRow = allPartners.find(
      (r) => String(r.ROWID) === String(partnerId) && !isDeleted(r.notes)
    );

    if (!partnerRow || !partnerRow.email || !String(partnerRow.email).trim()) {
      return { status: 'no_email' };
    }

    const toAddress = String(partnerRow.email).trim();
    const partnerName = String(partnerRow.name || "Partner").trim();
    const body = typeof htmlBody === "function" ? await htmlBody(partnerName) : htmlBody;
    const personalizedBody = body.replace(/Dear Partner,/, () => `Dear ${escapeHtml(partnerName)},`);

    await smtpTransporter.sendMail({
      from: `"CapitalOS" <${GMAIL_USER}>`,
      to: toAddress,
      subject: subject,
      html: personalizedBody,
    });

    console.log(`[capitalos-api] Email sent to ${toAddress} (partner: ${partnerName})`);
    return { status: 'sent', recipient: toAddress };
  } catch (emailErr) {
    console.error("[capitalos-api] Email send failed:", emailErr);
    return { status: 'unconfirmed' };
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

const APP_BASE_URL = (process.env.APP_BASE_URL || "https://capitalos-60070830470.development.catalystserverless.in/app").replace(/\/$/, "");

function allocationEmail(partnerName, partnerId, amountRupees, profitPercent, receivedDate) {
  const portalUrl = `${APP_BASE_URL}/#/p/partner-${partnerId}`;
  return `
<p>Dear ${partnerName},</p>
<p>We have recorded a new capital allocation for your account in <strong>CapitalOS</strong>.</p>
<table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:sans-serif;">
  <tr><th align="left">Amount</th><td>₹${Number(amountRupees).toLocaleString("en-IN")}</td></tr>
  <tr><th align="left">Profit Rate</th><td>${profitPercent}%</td></tr>
  <tr><th align="left">Received Date</th><td>${receivedDate}</td></tr>
</table>
<p>You can view your complete capital statement and profit history at any time using the link below:</p>
<p><a href="${portalUrl}" style="display:inline-block;padding:10px 18px;background:#176f50;color:#fff;border-radius:4px;text-decoration:none;font-weight:700;">View My Portal →</a></p>
<p style="font-size:12px;color:#888;">${portalUrl}</p>
<p>Please contact us if you have any questions.</p>
<p>Regards,<br/>CapitalOS Team</p>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function profitEmail(req, partnerName, payment, allocation, allocations, cashback = false) {
  const returns = await fetchAllRows(req, TABLES.CAPITAL_RETURNS);
  const returned = returns.filter(row => !isDeleted(row.notes) && String(row.allocation_id) === allocation.id)
    .reduce((total, row) => total + Number(row.amount_rupees || 0), 0);
  const today = new Date().toLocaleDateString('en-CA');
  const transferred = allocations.some(parent => parent.receivedDate <= today && parent.combination?.sources.some(source => source.id === allocation.id));
  const outstanding = transferred || allocation.receivedDate > today ? 0 : Math.max(0, allocation.amountRupees - returned);
  const rateCapital = payment.profitCapitalRupees ?? allocation.amountRupees;
  const rate = rateCapital > 0 ? (payment.amountRupees / rateCapital * 100).toFixed(2) : null;
  let fundingSource = 'Cash';
  if (allocation.creditCardId) {
    const cards = await fetchAllRows(req, TABLES.CREDIT_CARDS);
    const card = cards.find(row => String(row.ROWID) === allocation.creditCardId && !isDeleted(row.notes));
    fundingSource = `Credit Card${card?.card_name ? ` (${card.card_name})` : ''}`;
  }
  const formatDate = value => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  const details = [
    ['Amount', money(payment.amountRupees)],
    ['Date', formatDate(payment.paidDate)],
    ['Funding source', fundingSource],
    ['Amount given date', formatDate(allocation.receivedDate)],
    ['Capital outstanding', money(outstanding)],
    ['Rate', rate === null ? 'Unavailable' : `${rate}%`],
  ];
  const portalUrl = `${APP_BASE_URL}/#/p/partner-${encodeURIComponent(payment.partnerId)}`;
  return `
<h2>${cashback ? "Cashback Sharing" : "Profit Payment Confirmation"}</h2>
<p>Hi ${escapeHtml(partnerName)},</p>
<p>Your ${cashback ? "cashback sharing" : "profit payment"} has been processed:</p>
<table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:sans-serif;">
${details.map(([label, value]) => `  <tr><th align="left">${label}</th><td>${escapeHtml(value)}</td></tr>`).join('\n')}
</table>
<p><a href="${portalUrl}" style="display:inline-block;padding:10px 18px;background:#176f50;color:#fff;border-radius:4px;text-decoration:none;font-weight:700;">View My Portal →</a></p>
<p>Thank you.<br/>— CapitalOS</p>`;
}

function capitalReturnEmail(partnerName, partnerId, amountRupees, returnedDate) {
  const portalUrl = `${APP_BASE_URL}/#/p/partner-${partnerId}`;
  return `
<p>Dear ${partnerName},</p>
<p>A capital return has been processed for your account in <strong>CapitalOS</strong>.</p>
<table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:sans-serif;">
  <tr><th align="left">Amount Returned</th><td>₹${Number(amountRupees).toLocaleString("en-IN")}</td></tr>
  <tr><th align="left">Date</th><td>${returnedDate}</td></tr>
</table>
<p>View your updated capital statement here:</p>
<p><a href="${portalUrl}" style="display:inline-block;padding:10px 18px;background:#176f50;color:#fff;border-radius:4px;text-decoration:none;font-weight:700;">View My Portal →</a></p>
<p style="font-size:12px;color:#888;">${portalUrl}</p>
<p>Please contact us if you have any questions.</p>
<p>Regards,<br/>CapitalOS Team</p>`;
}

const TABLES = {
  PARTNERS: "COS_Partners",
  ALLOCATIONS: "COS_Allocations",
  CAPITAL_RETURNS: "COS_Returns",
  PROFIT_RECORDS: "COS_Profits",
  CREDIT_CARDS: "COS_CreditCards",
};

function sendJSON(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

function ok(res, data) { sendJSON(res, 200, { status: "success", data }); }
function created(res, data) { sendJSON(res, 201, { status: "success", data }); }
function badRequest(res, message) { sendJSON(res, 400, { status: "error", message }); }
function notFound(res) { sendJSON(res, 404, { status: "error", message: "Not found" }); }
function serverError(res, err) {
  if (!err.statusCode || err.statusCode >= 500) console.error("[capitalos-api]", err);
  sendJSON(res, err.statusCode || 500, { status: "error", message: String(err && err.message ? err.message : err) });
}

function readBody(req) {
  return new Promise(function(resolve, reject) {
    var data = "";
    req.on("data", function(chunk) { data += chunk; });
    req.on("end", function() {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { resolve({}); }
    });
    req.on("error", reject);
  });
}

function getApp(req) {
  return catalyst.initialize(req);
}

function getRepository(req) {
  const app = getApp(req);
  return persistence.repository(name => app.datastore().table(name));
}
async function fetchAllRows(req, tableName) { return getRepository(req).fetch(tableName); }
async function insertRow(req, tableName, rowData) { return getRepository(req).insert(tableName, rowData, req.url); }
async function updateRowById(req, tableName, rowId, rowData) {
  if (tableName === TABLES.PROFIT_RECORDS && req.method === 'PATCH') {
    if (rowData.amount_rupees !== undefined && (!Number.isSafeInteger(rowData.amount_rupees) || rowData.amount_rupees <= 0)) throw Object.assign(new Error('Use Close profit without payment to settle a zero amount.'), { statusCode: 400 });
    const previous = await getApp(req).datastore().table(tableName).getRow(rowId);
    if (Number(previous?.amount_rupees) === 0 && previous?.notes?.includes('Profit closed without payment')) throw Object.assign(new Error('A profit closure cannot be edited as a payment. Delete the closure to reopen the balance.'), { statusCode: 400 });
  }

  if ([TABLES.PROFIT_RECORDS, TABLES.CAPITAL_RETURNS].includes(tableName) && rowData.notes !== undefined) {
    const previous = await getApp(req).datastore().table(tableName).getRow(rowId);
    const { paymentGroupId } = paymentMetadata(previous?.notes);
    if (paymentGroupId) rowData = { ...rowData, notes: paymentNotes(rowData.notes, paymentGroupId) };
  }
  return getRepository(req).update(tableName, rowId, rowData, req.url);
}

function mapPartner(row) {
  return {
    id: String(row.ROWID),
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    notes: row.notes || "",
    createdAt: (row.source_created_time || row.CREATEDTIME) ? String(row.source_created_time || row.CREATEDTIME).slice(0, 10) : "",
  };
}

function mapAllocation(row) {
  const metadata = combinations.decode(row.notes || '');
  return {
    id: String(row.ROWID),
    partnerId: String(row.partner_id || ""),
    amountRupees: Number(row.amount_rupees || 0),
    profitPercent: Number(row.profit_percent || 0),
    receivedDate: row.received_date || "",
    returnDate: row.return_date || null,
    creditCardId: row.credit_card_id ? String(row.credit_card_id) : null,
    ...(row.cashback_data ? { cashback: JSON.parse(row.cashback_data) } : {}),
    notes: metadata ? metadata.notes : row.notes || "",
    ...(metadata ? { combination: metadata.combination } : {}),
    createdAt: (row.source_created_time || row.CREATEDTIME) ? new Date(row.source_created_time || row.CREATEDTIME).toISOString() : "",
  };
}

function mapCapitalReturn(row) {
  return {
    id: String(row.ROWID),
    allocationId: String(row.allocation_id || ""),
    partnerId: String(row.partner_id || ""),
    amountRupees: Number(row.amount_rupees || 0),
    returnedDate: row.returned_date || "",
    ...paymentMetadata(row.notes || ""),
    createdAt: (row.source_created_time || row.CREATEDTIME) ? new Date(row.source_created_time || row.CREATEDTIME).toISOString() : "",
  };
}

function mapProfitRecord(row) {
  return {
    id: String(row.ROWID),
    allocationId: String(row.allocation_id || ""),
    partnerId: String(row.partner_id || ""),
    amountRupees: Number(row.amount_rupees || 0),
    paidDate: row.paid_date || "",
    ...paymentMetadata(row.notes || ""),
    createdAt: (row.source_created_time || row.CREATEDTIME) ? new Date(row.source_created_time || row.CREATEDTIME).toISOString() : "",
  };
}

function mapCreditCard(row) {
  return {
    id: String(row.ROWID),
    partnerId: String(row.partner_id || ""),
    cardName: row.card_name || "",
    cardLimit: Number(row.card_limit || 0),
    pendingLimit: Number(row.pending_limit || 0),
    billGenerationDate: row.bill_generation_date || "",
    dueDate: row.due_date || "",
    notes: row.notes || "",
    createdAt: (row.source_created_time || row.CREATEDTIME) ? String(row.source_created_time || row.CREATEDTIME).slice(0, 10) : "",
  };
}

/**
 * Soft-delete a partner and cascade to all related rows.
 */
const DELETED_PREFIX = "DELETED:";

function markDeleted(originalNotes, ts) {
  return DELETED_PREFIX + ts + "\n" + (originalNotes || "");
}

function isDeleted(notes) {
  return typeof notes === "string" && notes.startsWith(DELETED_PREFIX);
}

const resources = {
  partners: { table: TABLES.PARTNERS, map: mapPartner },
  allocations: { table: TABLES.ALLOCATIONS, map: mapAllocation },
  'capital-returns': { table: TABLES.CAPITAL_RETURNS, map: mapCapitalReturn },
  'profit-records': { table: TABLES.PROFIT_RECORDS, map: mapProfitRecord },
  'credit-cards': { table: TABLES.CREDIT_CARDS, map: mapCreditCard },
};
async function recordContext(req) {
  const [partners, allocations] = await Promise.all([fetchAllRows(req, TABLES.PARTNERS), fetchAllRows(req, TABLES.ALLOCATIONS)]);
  return { partners, allocations };
}
function visibleRow(type, row, context) { return persistence.visibility(type, row, context.partners, context.allocations); }
function mapRecoverable(resource, row, context, type) {
  const state = visibleRow(type, row, context);
  const mapped = resource.map({ ...row, notes: persistence.originalNotes(row.notes) });
  return { ...mapped, ...state,
    ...(type === 'allocations' && mapped.combination && !state.restoreBlocked ? { restoreBlocked: 'Reverted combinations cannot be restored. Create a new combination.' } : {}),
  };
}
async function restoreRecord(req, type, row, context) {
  const state = visibleRow(type, row, context);
  if (state.restoreBlocked) throw Object.assign(new Error(state.restoreBlocked), { statusCode: 400 });
  const notes = persistence.originalNotes(row.notes);
  if (type === 'allocations' && combinations.decode(notes)) throw Object.assign(new Error('A reverted combination cannot be restored. Create a new combination.'), { statusCode: 400 });
  if (type === 'capital-returns' || type === 'profit-records') {
    const parent = context.allocations.find(a => String(a.ROWID) === String(row.allocation_id));
    if (String(parent.partner_id) !== String(row.partner_id)) throw Object.assign(new Error('Contribution does not belong to the partner.'), { statusCode: 400 });
    const active = context.allocations.filter(a => !visibleRow('allocations', a, context).deleted).map(mapAllocation);
    if (active.some(a => a.combination?.sources.some(source => source.id === String(row.allocation_id)))) throw Object.assign(new Error('This contribution belongs to a capital combination; its original history cannot be restored separately.'), { statusCode: 400 });
    if (type === 'capital-returns') {
      const returns = await fetchAllRows(req, TABLES.CAPITAL_RETURNS);
      const paid = returns.filter(r => String(r.ROWID) !== String(row.ROWID) && String(r.allocation_id) === String(row.allocation_id) && !visibleRow(type, r, context).deleted).reduce((sum, r) => sum + Number(r.amount_rupees), 0);
      if (!(Number(row.amount_rupees) > 0) || paid + Number(row.amount_rupees) > Number(parent.amount_rupees)) throw Object.assign(new Error('Restoring this return would exceed the contributed capital.'), { statusCode: 400 });
    }
  }
  const projected = { partners: context.partners.map(p => type === 'partners' && String(p.ROWID) === String(row.ROWID) ? { ...p, notes } : p), allocations: context.allocations.map(a => type === 'allocations' && String(a.ROWID) === String(row.ROWID) ? { ...a, notes } : a) };
  const partnerId = type === 'partners' ? String(row.ROWID) : String(row.partner_id);
  const activeAllocations = projected.allocations.filter(a => String(a.partner_id) === partnerId && !visibleRow('allocations', a, projected).deleted && (type !== 'allocations' || String(a.ROWID) === String(row.ROWID)));
  const cards = (await fetchAllRows(req, TABLES.CREDIT_CARDS)).map(c => type === 'credit-cards' && String(c.ROWID) === String(row.ROWID) ? { ...c, notes } : c);
  const [allReturns, allProfits] = await Promise.all([fetchAllRows(req, TABLES.CAPITAL_RETURNS), fetchAllRows(req, TABLES.PROFIT_RECORDS)]);
  for (const allocation of activeAllocations) {
    if (!(Number(allocation.amount_rupees) > 0) || !importTools.validDate(allocation.received_date) || (allocation.return_date && (!importTools.validDate(allocation.return_date) || allocation.return_date < allocation.received_date))) throw Object.assign(new Error('Correct invalid contribution dates or amounts before restoring this group.'), { statusCode: 400 });
    if (allocation.credit_card_id && !cards.some(c => String(c.ROWID) === String(allocation.credit_card_id) && !visibleRow('credit-cards', c, projected).deleted)) throw Object.assign(new Error('Restore the linked credit card first.'), { statusCode: 400 });
    const returns = allReturns.map(r => type === 'capital-returns' && String(r.ROWID) === String(row.ROWID) ? { ...r, notes } : r).filter(r => String(r.allocation_id) === String(allocation.ROWID) && !visibleRow('capital-returns', r, projected).deleted);
    const profits = allProfits.map(r => type === 'profit-records' && String(r.ROWID) === String(row.ROWID) ? { ...r, notes } : r).filter(r => String(r.allocation_id) === String(allocation.ROWID) && !visibleRow('profit-records', r, projected).deleted);
    if (returns.reduce((total, r) => total + Number(r.amount_rupees), 0) > Number(allocation.amount_rupees)) throw Object.assign(new Error('Restoring these records would exceed the contributed capital.'), { statusCode: 400 });
    for (const payment of [...returns, ...profits]) {
      const date = payment.returned_date || payment.paid_date;
      if (!(Number(payment.amount_rupees) > 0) || !importTools.validDate(date) || date < allocation.received_date) throw Object.assign(new Error('A linked payment has an invalid amount or date; review it before restoring this group.'), { statusCode: 400 });
    }
  }
  if (!isDeleted(row.notes)) return row;
  return updateRowById(req, resources[type].table, String(row.ROWID), { notes });
}
function mapActivity(row) {
  return { id: String(row.ROWID), operationId: row.operation_id, entityType: row.entity_type, entityId: row.entity_id,
    action: row.action, status: row.status, actor: row.actor, occurredAt: row.occurred_at,
    before: JSON.parse(row.before_state || 'null'), after: JSON.parse(row.after_state || 'null'), reason: row.reason || '' };
}
function mapReminder(row) {
  return { id: String(row.ROWID), obligationId: row.obligation_id, partnerId: row.partner_id, allocationId: row.allocation_id,
    kind: row.kind, action: row.action, channel: row.channel, amountRupees: Number(row.amount_paise) / 100, dueDate: row.due_date || '',
    followUpDate: row.follow_up_date || '', notes: row.notes || '', occurredAt: row.occurred_at };
}

async function importRecords(req, body) {
  if (!['partners', 'allocations'].includes(body.kind) || !Array.isArray(body.rows) || body.rows.length > 500) throw Object.assign(new Error('Choose partners or contributions and at most 500 rows.'), { statusCode: 400 });
  const context = await recordContext(req);
  const [cards, claims] = await Promise.all([fetchAllRows(req, TABLES.CREDIT_CARDS), fetchAllRows(req, 'COS_Imports')]);
  const current = {
    partners: context.partners.filter(p => !isDeleted(p.notes)).map(mapPartner),
    allocations: context.allocations.filter(a => !visibleRow('allocations', a, context).deleted).map(mapAllocation),
    creditCards: cards.filter(c => !visibleRow('credit-cards', c, context).deleted).map(mapCreditCard),
  };
  const preview = importTools.previewImport(body.kind, body.rows, current);
  const results = [];
  const claimTable = getApp(req).datastore().table('COS_Imports');
  for (const item of preview) {
    if (item.status !== 'ready') { results.push({ rowNumber: item.rowNumber, status: item.status, messages: item.messages }); continue; }
    const key = require('node:crypto').createHash('sha256').update(importTools.importFingerprint(body.kind, item.data)).digest('hex');
    const previous = claims.find(c => c.import_key === key);
    if (previous) { results.push({ rowNumber: item.rowNumber, status: previous.status === 'completed' ? 'duplicate' : 'unconfirmed', messages: [previous.status === 'completed' ? 'Previously imported. Restore the original record if it was deleted.' : 'A previous attempt has an unconfirmed result. Inspect records and change history before retrying.'] }); continue; }
    let claim;
    try {
      // import_key is unique in Catalyst: concurrent copies cannot both claim a row.
      claim = await claimTable.insertRow({ import_key: key, entity_type: body.kind, entity_id: '', status: 'pending', occurred_at: new Date().toISOString() });
      claims.push(claim);
      const d = item.data;
      const values = body.kind === 'partners' ? { name: d.name, phone: d.phone, email: d.email, notes: d.notes } : {
        partner_id: d.partnerId, amount_rupees: d.amountRupees, profit_percent: String(d.profitPercent),
        received_date: d.receivedDate, return_date: d.returnDate, credit_card_id: d.creditCardId, notes: d.notes,
      };
      const saved = await insertRow(req, resources[body.kind].table, values);
      await claimTable.updateRow({ ROWID: claim.ROWID, status: 'completed', entity_id: String(saved.ROWID) });
      results.push({ rowNumber: item.rowNumber, status: 'imported', id: String(saved.ROWID), messages: [] });
    } catch {
      // Never silently retry an uncertain financial write. The durable claim and
      // change intent remain available to reconcile it without creating a copy.
      results.push({ rowNumber: item.rowNumber, status: 'unconfirmed', messages: [claim ? 'Import result could not be confirmed. Inspect records and change history; this row will not be inserted again automatically.' : 'This row could not be reserved, possibly because another import is running. Refresh before retrying.'] });
    }
  }
  return { results };
}

module.exports = async function(req, res) {
  await Promise.all([combinationsReady, importsReady]);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  var url = req.url || "";
  var path = url.split("?")[0].replace(/^\/+/, "");
  const query = new URLSearchParams(url.split("?")[1] || "");
  var method = req.method || "GET";

  try {
    if (path === 'profit-records/close' && method === 'POST') {
      const input = await readBody(req);
      const partners = await fetchAllRows(req, TABLES.PARTNERS);
      if (!partners.some(p => String(p.ROWID) === input.partnerId && !isDeleted(p.notes))) return badRequest(res, 'Active partner not found.');
      const { prepareProfitClosure } = require('./profit-closure.mjs');
      const [allocations, profits, returns] = await Promise.all([
        fetchAllRows(req, TABLES.ALLOCATIONS), fetchAllRows(req, TABLES.PROFIT_RECORDS), fetchAllRows(req, TABLES.CAPITAL_RETURNS),
      ]);
      const record = prepareProfitClosure(input, allocations.filter(r => !isDeleted(r.notes)).map(mapAllocation), profits.filter(r => !isDeleted(r.notes)).map(mapProfitRecord), returns.filter(r => !isDeleted(r.notes)).map(mapCapitalReturn), new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
      const saved = await insertRow(req, TABLES.PROFIT_RECORDS, { allocation_id: record.allocationId, partner_id: record.partnerId, amount_rupees: 0, paid_date: record.paidDate, notes: record.notes });
      return created(res, mapProfitRecord(saved));
    }
    if (path === 'daily-summary/download' && method === 'POST') {
      if (process.env.VITE_USE_MOCK === 'true' || process.env.CAPITALOS_MOCK === 'true') return ok(res, { status: 'mock' });
      const { loadSummaryData, buildDailySummary } = require('./daily-summary.js');
      const { renderDailySummary } = require('./daily-summary-pdf.js');
      const summary = buildDailySummary(await loadSummaryData(name => getApp(req).datastore().table(name)));
      const pdf = await renderDailySummary(summary);
      return ok(res, { status: 'ready', filename: `CapitalOS-Daily-Summary-${summary.date}.pdf`, contentBase64: pdf.toString('base64') });
    }
    if (path === 'daily-summary/send' && method === 'POST') {
      const input = await readBody(req);
      // The recipient is fixed server-side; caller-supplied addresses are ignored.
      if (process.env.VITE_USE_MOCK === 'true' || process.env.CAPITALOS_MOCK === 'true') return ok(res, { status: 'mock' });
      const { deliverSummary } = require('./daily-summary.js');
      const { renderDailySummary } = require('./daily-summary-pdf.js');
      const result = await deliverSummary({ mode: 'manual', requestId: input.requestId,
        table: name => getApp(req).datastore().table(name), render: renderDailySummary,
        send: mail => smtpTransporter.sendMail({ from: 'CapitalOS <' + GMAIL_USER + '>', ...mail }),
      });
      return ok(res, result);
    }
    if (path === 'payment-groups' && method === 'POST') {
      const input = await readBody(req);
      const resource = resources[input.kind === 'capital' ? 'capital-returns' : 'profit-records'];
      const type = input.kind === 'capital' ? 'capital-returns' : 'profit-records';
      const result = await groupPayments(input, {
        activity: getApp(req).datastore().table(persistence.ACTIVITY_TABLE),
        events: () => fetchAllRows(req, persistence.ACTIVITY_TABLE),
        today: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        fetchContext: async () => {
          const [context, returns, profits] = await Promise.all([recordContext(req), fetchAllRows(req, TABLES.CAPITAL_RETURNS), fetchAllRows(req, TABLES.PROFIT_RECORDS)]);
          return {
            partnerActive: context.partners.some(p => String(p.ROWID) === input.partnerId && !isDeleted(p.notes)),
            allocations: context.allocations.filter(a => !visibleRow('allocations', a, context).deleted).map(mapAllocation),
            returns: returns.filter(r => !visibleRow('capital-returns', r, context).deleted).map(mapCapitalReturn),
            profits: profits.filter(r => !visibleRow('profit-records', r, context).deleted).map(mapProfitRecord),
          };
        },
        insert: row => insertRow(req, resource.table, row), map: resource.map,
        readRecords: async () => {
          const [rows, context] = await Promise.all([fetchAllRows(req, resource.table), recordContext(req)]);
          return rows.filter(r => !visibleRow(type, r, context).deleted).map(resource.map);
        },
      });
      const email = await groupPaymentEmail.sendOnce(input, result, {
        activity: getApp(req).datastore().table(persistence.ACTIVITY_TABLE),
        events: () => fetchAllRows(req, persistence.ACTIVITY_TABLE),
        send: () => sendPartnerEmail(req, input.partnerId,
          `${input.kind === 'profit' ? 'Profit Payment Confirmation' : 'Capital Return Confirmation'} — CapitalOS`,
          async partnerName => {
            const [allocations, cards] = await Promise.all([fetchAllRows(req, TABLES.ALLOCATIONS), fetchAllRows(req, TABLES.CREDIT_CARDS)]);
            return groupPaymentEmail.groupedEmail(input, result, partnerName,
              allocations.filter(a => !isDeleted(a.notes)).map(mapAllocation),
              cards.filter(c => !isDeleted(c.notes)).map(mapCreditCard), APP_BASE_URL);
          }),
      });
      return ok(res, { ...result, email });
    }
    if (path === 'imports' && method === 'POST') return ok(res, await importRecords(req, await readBody(req)));
    if (resources[path] && method === 'GET') {
      const resource = resources[path];
      const [rows, context] = await Promise.all([fetchAllRows(req, resource.table), recordContext(req)]);
      const deleted = query.get('deleted') === 'true';
      const mapped = rows.filter(row => visibleRow(path, row, context).deleted === deleted)
        .map(row => deleted ? mapRecoverable(resource, row, context, path) : resource.map(row));
      return ok(res, path === 'allocations' && !deleted ? monthlyCashback(mapped) : mapped);
    }
    if (path === 'activity' && method === 'GET') {
      const rows = await fetchAllRows(req, persistence.ACTIVITY_TABLE);
      return ok(res, rows.map(mapActivity).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)));
    }
    if (path === 'reminder-events' && method === 'GET') {
      return ok(res, (await fetchAllRows(req, persistence.REMINDER_TABLE)).map(mapReminder).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)));
    }
    if (path === 'reminder-events' && method === 'POST') {
      const body = await readBody(req);
      if (!['prepared', 'sent', 'snoozed', 'note'].includes(body.action) || !['principal', 'profit-estimate'].includes(body.kind)) return badRequest(res, 'Invalid reminder action or obligation.');
      if (!body.obligationId || String(body.obligationId).length > 255 || !Number.isFinite(body.amountRupees) || body.amountRupees < 0 || !Number.isSafeInteger(Math.round(body.amountRupees * 100))) return badRequest(res, 'Invalid reminder amount or identifier.');
      if (!importTools.validDate(body.dueDate || '') || (body.action === 'snoozed' && !importTools.validDate(body.followUpDate || ''))) return badRequest(res, 'A valid due date and follow-up date are required.');
      if (String(body.notes || '').length > 2000) return badRequest(res, 'Reminder notes must be 2,000 characters or fewer.');
      const context = await recordContext(req);
      const allocation = context.allocations.find(a => String(a.ROWID) === String(body.allocationId) && String(a.partner_id) === String(body.partnerId));
      if (!allocation || visibleRow('allocations', allocation, context).deleted) return badRequest(res, 'Active contribution not found.');
      const row = await getApp(req).datastore().table(persistence.REMINDER_TABLE).insertRow({
        event_id: require('node:crypto').randomUUID(), obligation_id: String(body.obligationId),
        partner_id: String(body.partnerId), allocation_id: String(body.allocationId), kind: body.kind,
        action: body.action, channel: ['manual', 'whatsapp', 'phone', 'email'].includes(body.channel) ? body.channel : 'manual',
        amount_paise: Math.round(body.amountRupees * 100), due_date: body.dueDate,
        follow_up_date: body.action === 'snoozed' ? body.followUpDate : null,
        notes: String(body.notes || ''), occurred_at: new Date().toISOString(),
      });
      return created(res, mapReminder(row));
    }
    const revertMatch = path.match(/^allocations\/([^/]+)\/revert-combination$/);
    if (revertMatch && method === 'POST') {
      const [aa, rr, pp] = await Promise.all([
        fetchAllRows(req, TABLES.ALLOCATIONS), fetchAllRows(req, TABLES.CAPITAL_RETURNS), fetchAllRows(req, TABLES.PROFIT_RECORDS),
      ]);
      const active = aa.filter(r => !isDeleted(r.notes)).map(mapAllocation);
      const target = active.find(a => a.id === revertMatch[1]);
      // Include soft-deleted transactions: recording then deleting a payment
      // must never make a previously used combination eligible again.
      const reason = combinations.revertReason(target, active,
        rr.filter(r => !target?.combination?.ignoredDeletedReturnIds?.includes(String(r.ROWID))).map(mapCapitalReturn),
        pp.filter(r => !target?.combination?.ignoredDeletedProfitIds?.includes(String(r.ROWID))).map(mapProfitRecord));
      if (reason) return badRequest(res, reason);
      const row = aa.find(r => String(r.ROWID) === revertMatch[1]);
      await updateRowById(req, TABLES.ALLOCATIONS, revertMatch[1], { notes: markDeleted(row.notes, new Date().toISOString()) });
      return ok(res, { id: revertMatch[1] });
    }
    if (path === 'allocations/combine' && method === 'POST') {
      const body = await readBody(req);
      const context = await recordContext(req);
      const [aa, rr, pp] = await Promise.all([
        fetchAllRows(req, TABLES.ALLOCATIONS), fetchAllRows(req, TABLES.CAPITAL_RETURNS), fetchAllRows(req, TABLES.PROFIT_RECORDS),
      ]);
      let combined;
      try {
        combined = combinations.buildCombination(body,
          aa.filter(r => !visibleRow('allocations', r, context).deleted).map(mapAllocation),
          rr.filter(r => !visibleRow('capital-returns', r, context).deleted).map(mapCapitalReturn),
          pp.filter(r => !visibleRow('profit-records', r, context).deleted).map(mapProfitRecord));
      } catch (err) { return badRequest(res, err.message); }
      combined.combination.ignoredDeletedReturnIds = rr.filter(r => isDeleted(r.notes)).map(r => String(r.ROWID));
      combined.combination.ignoredDeletedProfitIds = pp.filter(r => isDeleted(r.notes)).map(r => String(r.ROWID));
      const row = await insertRow(req, TABLES.ALLOCATIONS, {
        partner_id: combined.partnerId, amount_rupees: combined.amountRupees,
        profit_percent: String(combined.profitPercent), received_date: combined.receivedDate,
        return_date: combined.returnDate, credit_card_id: combined.creditCardId,
        notes: combinations.PREFIX + JSON.stringify({ combination: combined.combination, notes: '' }),
      });
      return created(res, mapAllocation(row));
    }

    // Prevent edits/deletions that could rewrite capital already transferred.
    // New profit payments on a source remain allowed to settle its old debt.
    const mutation = path.match(/^(allocations|capital-returns|profit-records)\/([^/]+)$/);
    if (mutation && (method === 'PATCH' || method === 'DELETE')) {
      const all = (await fetchAllRows(req, TABLES.ALLOCATIONS)).filter(r => !isDeleted(r.notes)).map(mapAllocation);
      const linked = all.filter(a => a.combination);
      const sourceIds = new Set(linked.flatMap(a => a.combination.sources.map(s => s.id)));
      if (mutation[1] === 'allocations') {
        if (sourceIds.has(mutation[2]) || (method === 'DELETE' && linked.some(a => a.id === mutation[2]))) return badRequest(res, 'Original combined contributions are preserved as history and cannot be edited or deleted.');
      } else {
        const table = mutation[1] === 'capital-returns' ? TABLES.CAPITAL_RETURNS : TABLES.PROFIT_RECORDS;
        const row = (await fetchAllRows(req, table)).find(r => String(r.ROWID) === mutation[2]);
        if (row && sourceIds.has(String(row.allocation_id))) {
          const historical = mutation[1] === 'capital-returns' || linked.some(a => a.combination.sources.some(s => s.profitRecordIds.includes(mutation[2])));
          if (historical) return badRequest(res, 'This original record is preserved in a capital combination.');
        }
      }
    }

    const recordAction = path.match(/^(partners|allocations|capital-returns|profit-records|credit-cards)\/([^/]+)(\/restore)?$/);
    if (recordAction && ((method === 'DELETE' && !recordAction[3]) || (method === 'POST' && recordAction[3]))) {
      const [, type, id] = recordAction;
      const resource = resources[type];
      const [rows, context] = await Promise.all([fetchAllRows(req, resource.table), recordContext(req)]);
      const row = rows.find(r => String(r.ROWID) === id);
      if (!row) return notFound(res);
      if (method === 'POST') return ok(res, resource.map(await restoreRecord(req, type, row, context)));
      if (type === 'credit-cards' && context.allocations.some(a => String(a.credit_card_id) === id && !visibleRow('allocations', a, context).deleted)) return badRequest(res, 'Reassign linked contributions before deleting this credit card.');
      const now = persistence.deletedAt(row.notes) || new Date().toISOString();
      if (!isDeleted(row.notes)) await updateRowById(req, resource.table, id, { notes: markDeleted(row.notes, now) });
      return ok(res, { id, partnerId: type === 'partners' ? id : row.partner_id, deletedAt: now, originalNotes: row.notes || '' });
    }
    if (recordAction && method === 'PATCH') {
      const [, type, id] = recordAction;
      const context = await recordContext(req);
      const row = (await fetchAllRows(req, resources[type].table)).find(r => String(r.ROWID) === id);
      if (!row) return notFound(res);
      if (visibleRow(type, row, context).deleted) return badRequest(res, 'Restore this record and its parent before editing.');
    }

    // ── PATCH /partners/:id ───────────────────────────────────────────────────
    var partnerPatch = path.match(/^partners\/([^/?]+)$/);
    if (partnerPatch && method === "PATCH") {
      var body = await readBody(req);
      var patchId = partnerPatch[1];
      var patchData = {};
      if (body.name !== undefined) patchData.name = String(body.name).trim();
      if (body.phone !== undefined) patchData.phone = String(body.phone).trim();
      if (body.email !== undefined) patchData.email = String(body.email).trim();
      if (body.notes !== undefined) patchData.notes = String(body.notes).trim();
      var updatedPartner = await updateRowById(req, TABLES.PARTNERS, patchId, patchData);
      return ok(res, mapPartner(updatedPartner));
    }

    if (path === "partners") {
      if (method === "GET") {
        var rows = await fetchAllRows(req, TABLES.PARTNERS);
        var activeRows = rows.filter(function(r) { return !isDeleted(r.notes); });
        return ok(res, activeRows.map(mapPartner));
      }
      if (method === "POST") {
        var body = await readBody(req);
        if (!body.name || !String(body.name).trim()) return badRequest(res, "name is required");
        var inserted = await insertRow(req, TABLES.PARTNERS, {
          name: String(body.name).trim(),
          phone: String(body.phone || "").trim(),
          email: String(body.email || "").trim(),
          notes: String(body.notes || "").trim(),
        });
        return created(res, mapPartner(inserted));
      }
    }

    if (path === "allocations") {
      if (method === "GET") {
        var rows = await fetchAllRows(req, TABLES.ALLOCATIONS);
        return ok(res, monthlyCashback(rows.filter(function(r) { return !isDeleted(r.notes); }).map(mapAllocation)));
      }
      if (method === "POST") {
        var body = await readBody(req);
        const parents = await fetchAllRows(req, TABLES.PARTNERS);
        if (!parents.some(p => String(p.ROWID) === String(body.partnerId) && !isDeleted(p.notes))) return badRequest(res, 'Active partner not found.');
        if (!body.partnerId) return badRequest(res, "partnerId is required");
        if (!body.amountRupees || body.amountRupees <= 0) return badRequest(res, "amountRupees must be > 0");
        if (!body.profitPercent || body.profitPercent <= 0) return badRequest(res, "profitPercent must be > 0");
        if (!body.receivedDate) return badRequest(res, "receivedDate is required");
        var inserted = await insertRow(req, TABLES.ALLOCATIONS, {
          partner_id: String(body.partnerId),
          amount_rupees: Number(body.amountRupees),
          profit_percent: String(body.profitPercent),
          received_date: body.receivedDate,
          return_date: body.returnDate || null,
          credit_card_id: body.creditCardId ? String(body.creditCardId) : null,
          notes: String(body.notes || "").trim(),
          cashback_data: JSON.stringify({ status: body.creditCardId ? 'review' : 'not_applicable', notes: '' }),
        });
        var mappedAlloc = monthlyCashback((await fetchAllRows(req, TABLES.ALLOCATIONS)).filter(r => !isDeleted(r.notes)).map(mapAllocation)).find(a => a.id === String(inserted.ROWID));
        // Fire-and-forget email — does not block the response
        sendPartnerEmail(
          req,
          body.partnerId,
          "New Capital Allocation Recorded — CapitalOS",
          allocationEmail("Partner", body.partnerId, body.amountRupees, body.profitPercent, body.receivedDate)
        );
        return created(res, mappedAlloc);
      }
    }

    // A single field on the contribution makes retries/edits update one settlement.
    const cashbackMatch = path.match(/^allocations\/([^/]+)\/cashback$/);
    if (cashbackMatch && method === 'PATCH') {
      const body = await readBody(req);
      const context = await recordContext(req);
      const row = context.allocations.find(r => String(r.ROWID) === cashbackMatch[1]);
      if (!row) return notFound(res);
      if (visibleRow('allocations', row, context).deleted) return badRequest(res, 'Restore this contribution and its partner before editing cashback.');
      const allocation = monthlyCashback(context.allocations.filter(r => !visibleRow('allocations', r, context).deleted).map(mapAllocation)).find(a => a.id === String(row.ROWID));
      let cashback;
      try { cashback = prepareCashback(body, allocation, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })); }
      catch (error) { return badRequest(res, error.message); }
      const updated = await updateRowById(req, TABLES.ALLOCATIONS, allocation.id, { cashback_data: JSON.stringify(cashback) });
      if (cashback.status === 'paid' && cashback.amountRupees != null && body.sendEmail === true) {
        sendPartnerEmail(req, allocation.partnerId, 'Cashback Sharing — CapitalOS',
          name => profitEmail(req, name, { ...cashback, partnerId: allocation.partnerId }, allocation,
            context.allocations.filter(r => !visibleRow('allocations', r, context).deleted).map(mapAllocation), true));
      }
      return ok(res, mapAllocation(updated));
    }

    // ── PATCH /allocations/:id ────────────────────────────────────────────────
    var allocPatch = path.match(/^allocations\/([^/?]+)$/);
    if (allocPatch && method === "PATCH") {
      var body = await readBody(req);
      var patchFields = {};
      const currentRow = (await fetchAllRows(req, TABLES.ALLOCATIONS)).find(r => String(r.ROWID) === allocPatch[1]);
      if (!currentRow) return notFound(res);
      const current = mapAllocation(currentRow);
      if (current.cashback?.status === 'paid' && ((body.creditCardId !== undefined && !body.creditCardId) || (body.receivedDate && body.receivedDate > current.cashback.paidDate))) return badRequest(res, 'Correct the cashback payment before removing its card source or moving the contribution after its payment date.');
      if (current.combination && ((body.amountRupees !== undefined && Number(body.amountRupees) !== current.amountRupees) || (body.receivedDate !== undefined && body.receivedDate !== current.receivedDate) || (body.creditCardId !== undefined && body.creditCardId !== current.creditCardId))) return badRequest(res, 'Combined capital amount, date and source must retain their original values.');
      if (body.returnDate !== undefined) patchFields.return_date = body.returnDate || null;
      if (body.amountRupees !== undefined) patchFields.amount_rupees = Number(body.amountRupees);
      if (body.profitPercent !== undefined) patchFields.profit_percent = String(body.profitPercent);
      if (body.receivedDate !== undefined) patchFields.received_date = body.receivedDate;
      if (body.notes !== undefined) patchFields.notes = String(body.notes).trim();
      if (body.creditCardId !== undefined) patchFields.credit_card_id = body.creditCardId ? String(body.creditCardId) : null;
      if (current.combination) patchFields.notes = combinations.PREFIX + JSON.stringify({ combination: { ...current.combination, revertBlocked: true }, notes: body.notes !== undefined ? String(body.notes).trim() : current.notes });
      var updated = await updateRowById(req, TABLES.ALLOCATIONS, allocPatch[1], patchFields);
      return ok(res, mapAllocation(updated));
    }

    if (path === "capital-returns") {
      if (method === "GET") {
        var rows = await fetchAllRows(req, TABLES.CAPITAL_RETURNS);
        return ok(res, rows.filter(function(r) { return !isDeleted(r.notes); }).map(mapCapitalReturn));
      }
      if (method === "POST") {
        var body = await readBody(req);
        const partnerRows = await fetchAllRows(req, TABLES.PARTNERS);
        if (!partnerRows.some(p => String(p.ROWID) === String(body.partnerId) && !isDeleted(p.notes))) return badRequest(res, 'Active partner not found.');
        if (!body.allocationId) return badRequest(res, "allocationId is required");
        if (!body.partnerId) return badRequest(res, "partnerId is required");
        if (!body.amountRupees || body.amountRupees <= 0) return badRequest(res, "amountRupees must be > 0");
        if (!body.returnedDate) return badRequest(res, "returnedDate is required");
        const allocations = (await fetchAllRows(req, TABLES.ALLOCATIONS)).filter(r => !isDeleted(r.notes)).map(mapAllocation);
        const allocation = allocations.find(a => a.id === String(body.allocationId));
        if (!allocation || allocation.partnerId !== String(body.partnerId)) return badRequest(res, 'Contribution not found for partner.');
        if (allocations.some(a => a.combination?.sources.some(s => s.id === allocation.id))) return badRequest(res, 'Return capital against the combined entry.');
        if (body.returnedDate < allocation.receivedDate || allocation.receivedDate > new Date().toISOString().slice(0, 10)) return badRequest(res, 'Combined capital is not yet effective.');
        const previousReturns = (await fetchAllRows(req, TABLES.CAPITAL_RETURNS)).filter(r => !isDeleted(r.notes) && String(r.allocation_id) === allocation.id);
        if (Number(body.amountRupees) > allocation.amountRupees - previousReturns.reduce((s, r) => s + Number(r.amount_rupees), 0)) return badRequest(res, 'Return exceeds outstanding capital.');
        var inserted = await insertRow(req, TABLES.CAPITAL_RETURNS, {
          allocation_id: String(body.allocationId),
          partner_id: String(body.partnerId),
          amount_rupees: Number(body.amountRupees),
          returned_date: body.returnedDate,
          notes: String(body.notes || "").trim(),
        });
        var mappedReturn = mapCapitalReturn(inserted);
        sendPartnerEmail(
          req,
          body.partnerId,
          "Capital Returned to Your Account — CapitalOS",
          capitalReturnEmail("Partner", body.partnerId, body.amountRupees, body.returnedDate)
        );
        return created(res, mappedReturn);
      }
    }

    // ── PATCH /capital-returns/:id ────────────────────────────────────────────
    var crPatch = path.match(/^capital-returns\/([^/?]+)$/);
    if (crPatch && method === "PATCH") {
      var body = await readBody(req);
      var patchFields = {};
      if (body.amountRupees !== undefined) patchFields.amount_rupees = Number(body.amountRupees);
      if (body.returnedDate !== undefined) patchFields.returned_date = body.returnedDate;
      if (body.notes !== undefined) patchFields.notes = String(body.notes).trim();
      var updated = await updateRowById(req, TABLES.CAPITAL_RETURNS, crPatch[1], patchFields);
      return ok(res, mapCapitalReturn(updated));
    }

    if (path === "profit-records") {
      if (method === "GET") {
        var rows = await fetchAllRows(req, TABLES.PROFIT_RECORDS);
        return ok(res, rows.filter(function(r) { return !isDeleted(r.notes); }).map(mapProfitRecord));
      }
      if (method === "POST") {
        var body = await readBody(req);
        const partnerRows = await fetchAllRows(req, TABLES.PARTNERS);
        if (!partnerRows.some(p => String(p.ROWID) === String(body.partnerId) && !isDeleted(p.notes))) return badRequest(res, 'Active partner not found.');
        if (!body.allocationId) return badRequest(res, "allocationId is required");
        if (!body.partnerId) return badRequest(res, "partnerId is required");
        if (!body.amountRupees || body.amountRupees <= 0) return badRequest(res, "amountRupees must be > 0");
        if (!body.paidDate) return badRequest(res, "paidDate is required");
        const allocations = (await fetchAllRows(req, TABLES.ALLOCATIONS)).filter(r => !isDeleted(r.notes)).map(mapAllocation);
        const allocation = allocations.find(a => a.id === String(body.allocationId));
        if (!allocation || allocation.partnerId !== String(body.partnerId)) return badRequest(res, 'Contribution not found for partner.');
        if (body.paidDate < allocation.receivedDate) return badRequest(res, 'Payment cannot precede the effective date.');
        const source = allocations.flatMap(a => a.combination?.sources || []).find(s => s.id === allocation.id);
        if (source) {
          const paid = (await fetchAllRows(req, TABLES.PROFIT_RECORDS)).filter(r => !isDeleted(r.notes) && String(r.allocation_id) === allocation.id && !source.profitRecordIds.includes(String(r.ROWID))).reduce((s, r) => s + Number(r.amount_rupees), 0);
          if (Number(body.amountRupees) > source.pending - paid || String(body.notes || '').includes('Capital reinvested')) return badRequest(res, 'Only remaining original profit can be paid on this contribution.');
        }
        var inserted = await insertRow(req, TABLES.PROFIT_RECORDS, {
          allocation_id: String(body.allocationId),
          partner_id: String(body.partnerId),
          amount_rupees: Number(body.amountRupees),
          paid_date: body.paidDate,
          notes: String(body.notes || "").trim(),
        });
        var mappedProfit = mapProfitRecord(inserted);
        sendPartnerEmail(
          req,
          body.partnerId,
          "Profit Payment Confirmation — CapitalOS",
          partnerName => profitEmail(req, partnerName, mappedProfit, allocation, allocations)
        );
        return created(res, mappedProfit);
      }
    }

    // ── PATCH /profit-records/:id ─────────────────────────────────────────────
    var prPatch = path.match(/^profit-records\/([^/?]+)$/);
    if (prPatch && method === "PATCH") {
      var body = await readBody(req);
      var patchFields = {};
      if (body.amountRupees !== undefined) patchFields.amount_rupees = Number(body.amountRupees);
      if (body.paidDate !== undefined) patchFields.paid_date = body.paidDate;
      if (body.notes !== undefined) patchFields.notes = String(body.notes).trim();
      var updated = await updateRowById(req, TABLES.PROFIT_RECORDS, prPatch[1], patchFields);
      return ok(res, mapProfitRecord(updated));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CREDIT CARDS
    // ─────────────────────────────────────────────────────────────────────────

    if (path === "credit-cards") {
      if (method === "GET") {
        var rows = await fetchAllRows(req, TABLES.CREDIT_CARDS);
        return ok(res, rows.filter(function(r) { return !isDeleted(r.notes); }).map(mapCreditCard));
      }
      if (method === "POST") {
        var body = await readBody(req);
        const parents = await fetchAllRows(req, TABLES.PARTNERS);
        if (!parents.some(p => String(p.ROWID) === String(body.partnerId) && !isDeleted(p.notes))) return badRequest(res, 'Active partner not found.');
        if (!body.partnerId) return badRequest(res, "partnerId is required");
        if (!body.cardName || !String(body.cardName).trim()) return badRequest(res, "cardName is required");
        if (body.cardLimit === undefined || body.cardLimit < 0) return badRequest(res, "cardLimit is required");
        if (!body.billGenerationDate) return badRequest(res, "billGenerationDate is required");
        if (!body.dueDate) return badRequest(res, "dueDate is required");
        var inserted = await insertRow(req, TABLES.CREDIT_CARDS, {
          partner_id: String(body.partnerId),
          card_name: String(body.cardName).trim(),
          card_limit: Number(body.cardLimit || 0),
          pending_limit: Number(body.pendingLimit || 0),
          bill_generation_date: body.billGenerationDate,
          due_date: body.dueDate,
          notes: String(body.notes || "").trim(),
        });
        return created(res, mapCreditCard(inserted));
      }
    }

    // ── PATCH /credit-cards/:id ───────────────────────────────────────────────
    var ccPatch = path.match(/^credit-cards\/([^/?]+)$/);
    if (ccPatch && method === "PATCH") {
      var body = await readBody(req);
      var patchFields = {};
      if (body.cardName !== undefined) patchFields.card_name = String(body.cardName).trim();
      if (body.cardLimit !== undefined) patchFields.card_limit = Number(body.cardLimit);
      if (body.pendingLimit !== undefined) patchFields.pending_limit = Number(body.pendingLimit);
      if (body.billGenerationDate !== undefined) patchFields.bill_generation_date = body.billGenerationDate;
      if (body.dueDate !== undefined) patchFields.due_date = body.dueDate;
      if (body.notes !== undefined) patchFields.notes = String(body.notes).trim();
      var updated = await updateRowById(req, TABLES.CREDIT_CARDS, ccPatch[1], patchFields);
      return ok(res, mapCreditCard(updated));
    }

    // ── GET /list-tables ─────────────────────────────────────────────────────
    // Diagnostic: list ALL tables in Catalyst Datastore (no limit)
    if (path === "list-tables" && method === "GET") {
      try {
        const app = getApp(req);
        const tables = await app.datastore().getAllTables();
        const tableList = tables.map(function(t) {
          const d = t._tableDetails || t;
          return {
            tableName: d.table_name || d.tableName,
            tableId: d.table_id || d.tableId,
          };
        });
        return ok(res, { count: tableList.length, tables: tableList });
      } catch (e) {
        return ok(res, { error: String(e && e.message ? e.message : e) });
      }
    }


    return notFound(res);
  } catch (err) {
    return serverError(res, err);
  }
};
