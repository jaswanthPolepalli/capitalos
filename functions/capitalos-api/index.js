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
const nodemailer = require("nodemailer");

// ── Gmail SMTP transporter ────────────────────────────────────────────────────
// Uses Gmail App Password — no domain verification required.
const GMAIL_USER = "jackgun9@gmail.com";
const GMAIL_APP_PASS = "bnoi thdv bfez owqv";

const smtpTransporter = nodemailer.createTransport({
  service: "gmail",
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
      return;
    }

    const toAddress = String(partnerRow.email).trim();
    const partnerName = String(partnerRow.name || "Partner").trim();
    const personalizedBody = htmlBody.replace(/Dear Partner,/, `Dear ${partnerName},`);

    await smtpTransporter.sendMail({
      from: `"CapitalOS" <${GMAIL_USER}>`,
      to: toAddress,
      subject: subject,
      html: personalizedBody,
    });

    console.log(`[capitalos-api] Email sent to ${toAddress} (partner: ${partnerName})`);
  } catch (emailErr) {
    console.error("[capitalos-api] Email send failed:", emailErr);
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

const APP_BASE_URL = "https://capitalos-60070830470.development.catalystserverless.in/app";

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

function profitEmail(partnerName, partnerId, amountRupees, paidDate) {
  const portalUrl = `${APP_BASE_URL}/#/p/partner-${partnerId}`;
  return `
<p>Dear ${partnerName},</p>
<p>A profit payment has been recorded for your account in <strong>CapitalOS</strong>.</p>
<table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:sans-serif;">
  <tr><th align="left">Amount Paid</th><td>₹${Number(amountRupees).toLocaleString("en-IN")}</td></tr>
  <tr><th align="left">Date</th><td>${paidDate}</td></tr>
</table>
<p>View your updated profit statement here:</p>
<p><a href="${portalUrl}" style="display:inline-block;padding:10px 18px;background:#176f50;color:#fff;border-radius:4px;text-decoration:none;font-weight:700;">View My Portal →</a></p>
<p style="font-size:12px;color:#888;">${portalUrl}</p>
<p>Please contact us if you have any questions.</p>
<p>Regards,<br/>CapitalOS Team</p>`;
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
  console.error("[capitalos-api]", err);
  sendJSON(res, 500, { status: "error", message: String(err && err.message ? err.message : err) });
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

async function fetchAllRows(req, tableName) {
  const app = getApp(req);
  const table = app.datastore().table(tableName);
  const result = await table.getPagedRows({ maxRows: 200 });
  return result.data || [];
}

async function insertRow(req, tableName, rowData) {
  const app = getApp(req);
  const table = app.datastore().table(tableName);
  return await table.insertRow(rowData);
}

async function updateRowById(req, tableName, rowId, rowData) {
  const app = getApp(req);
  const table = app.datastore().table(tableName);
  return await table.updateRow(Object.assign({ ROWID: rowId }, rowData));
}

function mapPartner(row) {
  return {
    id: String(row.ROWID),
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    notes: row.notes || "",
    createdAt: row.CREATEDTIME ? String(row.CREATEDTIME).slice(0, 10) : "",
  };
}

function mapAllocation(row) {
  return {
    id: String(row.ROWID),
    partnerId: String(row.partner_id || ""),
    amountRupees: Number(row.amount_rupees || 0),
    profitPercent: Number(row.profit_percent || 0),
    receivedDate: row.received_date || "",
    returnDate: row.return_date || null,
    creditCardId: row.credit_card_id ? String(row.credit_card_id) : null,
    notes: row.notes || "",
  };
}

function mapCapitalReturn(row) {
  return {
    id: String(row.ROWID),
    allocationId: String(row.allocation_id || ""),
    partnerId: String(row.partner_id || ""),
    amountRupees: Number(row.amount_rupees || 0),
    returnedDate: row.returned_date || "",
    notes: row.notes || "",
  };
}

function mapProfitRecord(row) {
  return {
    id: String(row.ROWID),
    allocationId: String(row.allocation_id || ""),
    partnerId: String(row.partner_id || ""),
    amountRupees: Number(row.amount_rupees || 0),
    paidDate: row.paid_date || "",
    notes: row.notes || "",
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
    createdAt: row.CREATEDTIME ? String(row.CREATEDTIME).slice(0, 10) : "",
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

async function softDeletePartner(req, partnerId) {
  const now = new Date().toISOString();

  // 1. Fetch current partner so we can preserve its existing notes
  const allPartners = await fetchAllRows(req, TABLES.PARTNERS);
  const partnerRow = allPartners.find((r) => String(r.ROWID) === String(partnerId));
  if (!partnerRow) throw new Error("Partner not found: " + partnerId);

  await updateRowById(req, TABLES.PARTNERS, partnerId, {
    notes: markDeleted(partnerRow.notes, now),
  });

  // 2. Cascade to all allocations for this partner
  const allAllocations = await fetchAllRows(req, TABLES.ALLOCATIONS);
  const partnerAllocations = allAllocations.filter(
    (r) => String(r.partner_id) === String(partnerId) && !isDeleted(r.notes),
  );
  for (const alloc of partnerAllocations) {
    await updateRowById(req, TABLES.ALLOCATIONS, String(alloc.ROWID), {
      notes: markDeleted(alloc.notes, now),
    });
  }

  // 3. Cascade to all capital returns for this partner
  const allReturns = await fetchAllRows(req, TABLES.CAPITAL_RETURNS);
  const partnerReturns = allReturns.filter(
    (r) => String(r.partner_id) === String(partnerId) && !isDeleted(r.notes),
  );
  for (const cr of partnerReturns) {
    await updateRowById(req, TABLES.CAPITAL_RETURNS, String(cr.ROWID), {
      notes: markDeleted(cr.notes, now),
    });
  }

  // 4. Cascade to all profit records for this partner
  const allProfits = await fetchAllRows(req, TABLES.PROFIT_RECORDS);
  const partnerProfits = allProfits.filter(
    (r) => String(r.partner_id) === String(partnerId) && !isDeleted(r.notes),
  );
  for (const pr of partnerProfits) {
    await updateRowById(req, TABLES.PROFIT_RECORDS, String(pr.ROWID), {
      notes: markDeleted(pr.notes, now),
    });
  }

  return {
    partnerId: String(partnerId),
    deletedAt: now,
    cascaded: {
      allocations: partnerAllocations.length,
      capitalReturns: partnerReturns.length,
      profitRecords: partnerProfits.length,
    },
  };
}

module.exports = async function(req, res) {
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
  var method = req.method || "GET";

  try {
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

    // ── DELETE /partners/:id ──────────────────────────────────────────────────
    var partnerDelete = path.match(/^partners\/([^/?]+)$/);
    if (partnerDelete && method === "DELETE") {
      var partnerId = partnerDelete[1];
      var result = await softDeletePartner(req, partnerId);
      return ok(res, result);
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
        return ok(res, rows.filter(function(r) { return !isDeleted(r.notes); }).map(mapAllocation));
      }
      if (method === "POST") {
        var body = await readBody(req);
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
        });
        var mappedAlloc = mapAllocation(inserted);
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

    // ── DELETE /allocations/:id ───────────────────────────────────────────────
    var allocDelete = path.match(/^allocations\/([^/?]+)$/);
    if (allocDelete && method === "DELETE") {
      var allocId = allocDelete[1];
      var allAllocs = await fetchAllRows(req, TABLES.ALLOCATIONS);
      var allocRow = allAllocs.find(function(r) { return String(r.ROWID) === String(allocId); });
      if (!allocRow) return notFound(res);
      var now = new Date().toISOString();
      await updateRowById(req, TABLES.ALLOCATIONS, allocId, { notes: markDeleted(allocRow.notes, now) });
      return ok(res, { id: allocId, deletedAt: now, originalNotes: allocRow.notes || "" });
    }

    // ── POST /allocations/:id/restore ────────────────────────────────────────
    var allocRestore = path.match(/^allocations\/([^/?]+)\/restore$/);
    if (allocRestore && method === "POST") {
      var allocId = allocRestore[1];
      var allAllocs = await fetchAllRows(req, TABLES.ALLOCATIONS);
      var allocRow = allAllocs.find(function(r) { return String(r.ROWID) === String(allocId); });
      if (!allocRow) return notFound(res);
      var restoredNotes = isDeleted(allocRow.notes)
        ? allocRow.notes.replace(/^DELETED:[^\n]*\n?/, "")
        : (allocRow.notes || "");
      await updateRowById(req, TABLES.ALLOCATIONS, allocId, { notes: restoredNotes });
      return ok(res, mapAllocation(Object.assign({}, allocRow, { notes: restoredNotes })));
    }

    // ── PATCH /allocations/:id ────────────────────────────────────────────────
    var allocPatch = path.match(/^allocations\/([^/?]+)$/);
    if (allocPatch && method === "PATCH") {
      var body = await readBody(req);
      var patchFields = {};
      if (body.returnDate !== undefined) patchFields.return_date = body.returnDate || null;
      if (body.amountRupees !== undefined) patchFields.amount_rupees = Number(body.amountRupees);
      if (body.profitPercent !== undefined) patchFields.profit_percent = String(body.profitPercent);
      if (body.receivedDate !== undefined) patchFields.received_date = body.receivedDate;
      if (body.notes !== undefined) patchFields.notes = String(body.notes).trim();
      if (body.creditCardId !== undefined) patchFields.credit_card_id = body.creditCardId ? String(body.creditCardId) : null;
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
        if (!body.allocationId) return badRequest(res, "allocationId is required");
        if (!body.partnerId) return badRequest(res, "partnerId is required");
        if (!body.amountRupees || body.amountRupees <= 0) return badRequest(res, "amountRupees must be > 0");
        if (!body.returnedDate) return badRequest(res, "returnedDate is required");
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

    // ── DELETE /capital-returns/:id ───────────────────────────────────────────
    var crDelete = path.match(/^capital-returns\/([^/?]+)$/);
    if (crDelete && method === "DELETE") {
      var crId = crDelete[1];
      var allCRs = await fetchAllRows(req, TABLES.CAPITAL_RETURNS);
      var crRow = allCRs.find(function(r) { return String(r.ROWID) === String(crId); });
      if (!crRow) return notFound(res);
      var now = new Date().toISOString();
      await updateRowById(req, TABLES.CAPITAL_RETURNS, crId, { notes: markDeleted(crRow.notes, now) });
      return ok(res, { id: crId, deletedAt: now, originalNotes: crRow.notes || "" });
    }

    // ── POST /capital-returns/:id/restore ─────────────────────────────────────
    var crRestore = path.match(/^capital-returns\/([^/?]+)\/restore$/);
    if (crRestore && method === "POST") {
      var crId = crRestore[1];
      var allCRs = await fetchAllRows(req, TABLES.CAPITAL_RETURNS);
      var crRow = allCRs.find(function(r) { return String(r.ROWID) === String(crId); });
      if (!crRow) return notFound(res);
      var restoredNotes = isDeleted(crRow.notes)
        ? crRow.notes.replace(/^DELETED:[^\n]*\n?/, "")
        : (crRow.notes || "");
      await updateRowById(req, TABLES.CAPITAL_RETURNS, crId, { notes: restoredNotes });
      return ok(res, mapCapitalReturn(Object.assign({}, crRow, { notes: restoredNotes })));
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
        if (!body.allocationId) return badRequest(res, "allocationId is required");
        if (!body.partnerId) return badRequest(res, "partnerId is required");
        if (!body.amountRupees || body.amountRupees <= 0) return badRequest(res, "amountRupees must be > 0");
        if (!body.paidDate) return badRequest(res, "paidDate is required");
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
          "Profit Payment Recorded — CapitalOS",
          profitEmail("Partner", body.partnerId, body.amountRupees, body.paidDate)
        );
        return created(res, mappedProfit);
      }
    }

    // ── DELETE /profit-records/:id ────────────────────────────────────────────
    var prDelete = path.match(/^profit-records\/([^/?]+)$/);
    if (prDelete && method === "DELETE") {
      var prId = prDelete[1];
      var allPRs = await fetchAllRows(req, TABLES.PROFIT_RECORDS);
      var prRow = allPRs.find(function(r) { return String(r.ROWID) === String(prId); });
      if (!prRow) return notFound(res);
      var now = new Date().toISOString();
      await updateRowById(req, TABLES.PROFIT_RECORDS, prId, { notes: markDeleted(prRow.notes, now) });
      return ok(res, { id: prId, deletedAt: now, originalNotes: prRow.notes || "" });
    }

    // ── POST /profit-records/:id/restore ──────────────────────────────────────
    var prRestore = path.match(/^profit-records\/([^/?]+)\/restore$/);
    if (prRestore && method === "POST") {
      var prId = prRestore[1];
      var allPRs = await fetchAllRows(req, TABLES.PROFIT_RECORDS);
      var prRow = allPRs.find(function(r) { return String(r.ROWID) === String(prId); });
      if (!prRow) return notFound(res);
      var restoredNotes = isDeleted(prRow.notes)
        ? prRow.notes.replace(/^DELETED:[^\n]*\n?/, "")
        : (prRow.notes || "");
      await updateRowById(req, TABLES.PROFIT_RECORDS, prId, { notes: restoredNotes });
      return ok(res, mapProfitRecord(Object.assign({}, prRow, { notes: restoredNotes })));
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

    // ── DELETE /credit-cards/:id ──────────────────────────────────────────────
    var ccDelete = path.match(/^credit-cards\/([^/?]+)$/);
    if (ccDelete && method === "DELETE") {
      var ccId = ccDelete[1];
      var allCCs = await fetchAllRows(req, TABLES.CREDIT_CARDS);
      var ccRow = allCCs.find(function(r) { return String(r.ROWID) === String(ccId); });
      if (!ccRow) return notFound(res);
      var now = new Date().toISOString();
      await updateRowById(req, TABLES.CREDIT_CARDS, ccId, { notes: markDeleted(ccRow.notes, now) });
      return ok(res, { id: ccId, deletedAt: now });
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
