import { splitProfit } from '../../../functions/capitalos-api/profit-sharing.mjs';
import { prepareProfitClosure } from '../../../functions/capitalos-api/profit-closure.mjs';
import { prepareCashback, monthlyCashback } from '../../../functions/capitalos-api/cashback.mjs';
/**
 * mockFetch — intercepts all /server/capitalos-api/* fetch calls in dev mode.
 *
 * Activated when VITE_USE_MOCK=true is set before running the dev server:
 *   VITE_USE_MOCK=true npm run client:dev
 *   npm run client:dev:mock
 *
 * How it works:
 *  - Overrides window.fetch globally
 *  - Loads seed JSON files from /app/mocks/seed/ (served as static assets by Vite)
 *  - GET requests → return the seeded rows (in-memory copy, mutable for the session)
 *  - POST / PATCH / DELETE → simulate success, mutate the in-memory store,
 *    NEVER touch the real Catalyst database
 *  - All non-API fetch calls pass through to the real fetch
 *
 * Data resets on every page refresh — completely safe, zero persistence.
 *
 * To generate seed files:
 *   CATALYST_API_URL=https://your-app.catalystserverless.com/server/capitalos-api npm run seed:local
 */

import { preparePaymentGroup, type PaymentGroupInput, type PaymentGroupResult } from '../../../functions/capitalos-api/payment-groups.mjs';
import { businessToday } from '../lib/businessDates';
import { deletedAt, originalNotes, visibility } from '../../../functions/capitalos-api/records.mjs';
import { previewImport, type ImportKind, type ImportSourceRow } from '../../../functions/capitalos-api/imports.mjs';
const API_PREFIX = "/server/capitalos-api";
import { buildCombination, revertReason } from '../../../functions/capitalos-api/combinations.mjs';
import type { CapitalAllocation, CapitalReturn, ProfitRecord, CombineInput } from '../store';

// ─── Table names ──────────────────────────────────────────────────────────────

const TABLES = [
  "partners",
  "allocations",
  "capital-returns",
  "profit-records",
  "credit-cards",
] as const;

type TableName = (typeof TABLES)[number];

// ─── In-memory store ──────────────────────────────────────────────────────────

const store: Record<string, Record<string, unknown>[]> = {};
const paymentGroups = new Map<string, { input: string; result: PaymentGroupResult }>();

// Use Vite's import.meta.glob to eagerly import all seed JSON files.
// This bundles the JSON at build/dev time so no runtime fetch is needed.
// Files are keyed by their relative path from this file.
const seedModules = import.meta.glob<{ default: Record<string, unknown>[] }>(
  "./seed/*.json",
  { eager: true },
);

async function loadSeedData(): Promise<void> {
  // Map filename → table name:
  //   "./seed/partners.json"       → "partners"
  //   "./seed/capital-returns.json" → "capital-returns"
  for (const [path, mod] of Object.entries(seedModules)) {
    // Extract filename without extension
    const filename = path.replace("./seed/", "").replace(".json", "");
    // Skip meta file
    if (filename.startsWith("_")) continue;
    const rows = mod.default;
    store[filename] = Array.isArray(rows) ? [...rows] : [];
  }

  // Ensure all expected tables exist (even if seed file is missing)
  for (const table of TABLES) {
    if (!store[table]) {
      store[table] = [];
    }
  }
}

function raw(row: Record<string, unknown>) { return { ...row, ROWID: row['id'], partner_id: row['partnerId'], allocation_id: row['allocationId'] }; }
function state(table: string, row: Record<string, unknown>) {
  return visibility(table, raw(row), (store['partners'] || []).map(raw), (store['allocations'] || []).map(raw));
}
function active(table: string) { return (store[table] || []).filter(row => !state(table, row).deleted); }
function logChange(table: string, before: Record<string, unknown> | null, after: Record<string, unknown>) {
  const action = !before ? 'create' : !deletedAt(before['notes']) && deletedAt(after['notes']) ? 'delete' : deletedAt(before['notes']) && !deletedAt(after['notes']) ? 'restore' : 'update';
  const id = nextMockId();
  store['activity'] = [{ id, operationId: id, entityType: table, entityId: after['id'], action, status: 'committed', actor: 'Local demo', occurredAt: new Date().toISOString(), before: before ? structuredClone(before) : null, after: structuredClone(after), reason: 'Mock session only' }, ...(store['activity'] || [])];
}

// ─── ID generator ─────────────────────────────────────────────────────────────

let _mockIdCounter = 90000;
function nextMockId(): string {
  return String(++_mockIdCounter);
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function ok(data: unknown): Response {
  return new Response(
    JSON.stringify({ status: "success", data }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function notFound(msg: string): Response {
  return new Response(
    JSON.stringify({ status: "error", message: msg }),
    { status: 404, headers: { "Content-Type": "application/json" } },
  );
}

// ─── Route parser ─────────────────────────────────────────────────────────────

interface ParsedRoute {
  table: TableName | string;
  id: string | null;
  action: string | null;
}

function parseRoute(pathname: string): ParsedRoute | null {
  if (!pathname.startsWith(API_PREFIX)) return null;
  const rest = pathname.slice(API_PREFIX.length).replace(/^\//, "");
  const parts = rest.split("/");
  return {
    table: parts[0] || "",
    id: parts[1] || null,
    action: parts[2] || null,
  };
}

// ─── Mock fetch handler ───────────────────────────────────────────────────────

const _realFetch = window.fetch.bind(window);

async function mockFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string" ? input
    : input instanceof URL ? input.href
    : (input as Request).url;

  const method = (
    init?.method ||
    (input instanceof Request ? input.method : "GET")
  ).toUpperCase();

  const pathname = url.startsWith("http")
    ? new URL(url).pathname
    : url.split("?")[0]!;

  const route = parseRoute(pathname);

  // Pass non-API calls (including seed file loads) to real fetch
  if (!route) return _realFetch(input, init);

  const { table, id, action } = route;
  const query = new URL(url, window.location.origin).searchParams;
  const tableData = store[table];

  if (table === 'profit-records' && id === 'close' && method === 'POST') {
    try {
      const input = JSON.parse(String(init?.body || '{}'));
      const entry = prepareProfitClosure(input, active('allocations') as unknown as CapitalAllocation[], active('profit-records') as unknown as ProfitRecord[], active('capital-returns') as unknown as CapitalReturn[], businessToday());
      const record = { ...entry, id: nextMockId(), createdAt: new Date().toISOString() };
      store['profit-records']!.push(record);
      return ok(record);
    } catch (error) { return new Response(JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Unable to close profit.' }), { status: 400 }); }
  }
  if (table === 'daily-summary' && id === 'send' && method === 'POST') return ok({ status: 'mock' });
  if (table === 'daily-summary' && id === 'download' && method === 'POST') return ok({ status: 'mock' });

  if (table === 'payment-groups' && method === 'POST') {
    try {
      const input = JSON.parse(String(init?.body || '{}')) as PaymentGroupInput;
      const previous = paymentGroups.get(input.groupId);
      if (previous) {
        if (previous.input !== JSON.stringify(input)) return new Response(JSON.stringify({ status: 'error', message: 'This payment group was already used with different values.' }), { status: 409 });
        const target = input.kind === 'profit' ? 'profit-records' : 'capital-returns';
        const results = previous.result.results.map(item => {
          const record = active(target).find(r => r['id'] === item.record?.id) as unknown as ProfitRecord | CapitalReturn | undefined;
          const original = input.entries.find(e => e.allocationId === item.allocationId)!;
          if (!record || (('combinedAmountRupees' in record ? record.combinedAmountRupees : undefined) ?? record.amountRupees) !== original.amountRupees || ('partnerAmountRupees' in record ? record.partnerAmountRupees ?? null : null) !== (original.partnerAmountRupees ?? null) || Boolean('noCfoSplit' in record && record.noCfoSplit) !== Boolean(original.noCfoSplit) || ('partnerProfitPercent' in record ? record.partnerProfitPercent ?? null : null) !== (original.partnerProfitPercent ?? null) || ('paidDate' in record ? record.paidDate : record.returnedDate) !== input.date) return { allocationId: item.allocationId, status: 'unconfirmed' as const };
          return { ...item, record };
        });
        return ok({ groupId: input.groupId, complete: results.every(r => r.status === 'saved'), results, email: { status: 'mock' } });
      }
      if (!active('partners').some(p => p['id'] === input.partnerId)) throw new Error('Active partner not found.');
      const prepared = preparePaymentGroup(input, active('allocations') as unknown as CapitalAllocation[], active('capital-returns') as unknown as CapitalReturn[], active('profit-records') as unknown as ProfitRecord[], businessToday());
      const target = input.kind === 'profit' ? 'profit-records' : 'capital-returns';
      const results = prepared.map(entry => {
        const record = { ...entry, id: nextMockId(), createdAt: new Date().toISOString() };
        store[target] = [...(store[target] || []), record];
        logChange(target, null, record);
        return { allocationId: entry.allocationId, status: 'saved' as const, record };
      });
      const result: PaymentGroupResult = { groupId: input.groupId, complete: true, results, email: { status: 'mock' } };
      paymentGroups.set(input.groupId, { input: JSON.stringify(input), result });
      return ok(result);
    } catch (e) { return new Response(JSON.stringify({ status: 'error', message: e instanceof Error ? e.message : 'Invalid payment group.' }), { status: 400 }); }
  }

  if (table === 'allocations' && id && action === 'revert-combination' && method === 'POST') {
    const allocations = active('allocations') as unknown as CapitalAllocation[];
    const reason = revertReason(allocations.find(a => a.id === id), allocations,
      store['capital-returns'] as unknown as CapitalReturn[], store['profit-records'] as unknown as ProfitRecord[]);
    if (reason) return new Response(JSON.stringify({ status: 'error', message: reason }), { status: 400 });
    const row = store['allocations']!.find(a => a['id'] === id)!;
    const updated = { ...row, notes: `DELETED:${new Date().toISOString()}\n${String(row['notes'] || '')}` };
    store['allocations'] = store['allocations']!.map(a => a['id'] === id ? updated : a); logChange('allocations', row, updated);
    return ok({ id });
  }

  if (table === 'allocations' && id === 'combine' && method === 'POST') {
    try {
      const input = JSON.parse(String(init?.body || '{}')) as CombineInput;
      const combined = buildCombination(input,
        active('allocations') as unknown as CapitalAllocation[],
        store['capital-returns'] as unknown as CapitalReturn[],
        store['profit-records'] as unknown as ProfitRecord[]);
      const row = { ...combined, id: nextMockId(), createdAt: new Date().toISOString() };
      store['allocations'] = [...(store['allocations'] || []), row];
      logChange('allocations', null, row);
    return ok(row);
    } catch (error) {
      return new Response(JSON.stringify({ status: 'error', message: String(error) }), { status: 400 });
    }
  }

  if (table === 'imports' && method === 'POST') {
    const body = JSON.parse(String(init?.body || '{}')) as { kind: ImportKind; rows: ImportSourceRow[] };
    const preview = previewImport(body.kind, body.rows, { partners: active('partners') as unknown as import('../store').Partner[], allocations: active('allocations') as unknown as CapitalAllocation[], creditCards: active('credit-cards') as unknown as import('../store').CreditCard[] });
    const results = preview.map(item => {
      if (item.status !== 'ready') return { rowNumber: item.rowNumber, status: item.status, messages: item.messages };
      const row = { ...item.data, id: nextMockId(), createdAt: new Date().toISOString() };
      store[body.kind] = [...(store[body.kind] || []), row]; logChange(body.kind, null, row);
      return { rowNumber: item.rowNumber, status: 'imported', id: row.id, messages: [] };
    });
    return ok({ results });
  }
  if (table === 'activity' && method === 'GET') return ok(store['activity'] || []);
  if (table === 'reminder-events') {
    if (method === 'GET') return ok(store[table] || []);
    if (method === 'POST') {
      const row = { ...JSON.parse(String(init?.body || '{}')), id: nextMockId(), occurredAt: new Date().toISOString() };
      store[table] = [row, ...(store[table] || [])]; return ok(row);
    }
  }
  if (!tableData) return notFound(`Unknown local endpoint: ${table}`);
  if (method === 'GET' && !id) {
    const deleted = query.get('deleted') === 'true';
    return ok(tableData.filter(row => state(table, row).deleted === deleted).map(row => deleted ? { ...row, notes: originalNotes(row['notes']), ...state(table, row) } : row));
  }

  // GET single
  if (method === "GET" && id) {
    const row = tableData.find((r) => r["id"] === id);
    if (!row) return notFound(`${table}/${id} not found`);
    return ok(row);
  }

  // Restore preserves independently deleted children, matching server visibility.
  if (method === 'POST' && id && action === 'restore') {
    const row = tableData.find(r => r['id'] === id);
    if (!row) return notFound('Record not found');
    const status = state(table, row);
    if (status.restoreBlocked) return new Response(JSON.stringify({ status: 'error', message: status.restoreBlocked }), { status: 400 });
    if (table === 'allocations' && row['combination']) return new Response(JSON.stringify({ status: 'error', message: 'Reverted combinations cannot be restored.' }), { status: 400 });
    const updated = { ...row, notes: originalNotes(row['notes']) };
    store[table] = tableData.map(r => r['id'] === id ? updated : r); logChange(table, row, updated); return ok(updated);
  }

  if (method === 'PATCH' && table === 'allocations' && id && action === 'cashback') {
    const row = tableData.find(r => r['id'] === id);
    if (!row || state(table, row).deleted) return notFound('Active contribution not found');
    try {
      const body = JSON.parse(String(init?.body || '{}'));
      const cashback = prepareCashback(body, monthlyCashback(tableData.filter(r => !state(table, r).deleted) as unknown as CapitalAllocation[]).find(a => a.id === id)!, businessToday());
      const previous = (row as unknown as CapitalAllocation).cashback;
      cashback.updatedAt = new Date().toISOString();
      if (cashback.status === 'paid') cashback.createdAt = previous?.createdAt || cashback.updatedAt;
      const updated = { ...row, cashback };
      store[table] = tableData.map(r => r['id'] === id ? updated : r);
      logChange(table, row, updated);
      return ok(updated);
    } catch (err) { return new Response(JSON.stringify({ status: 'error', message: (err as Error).message }), { status: 400 }); }
  }

  // POST create
  if (method === "POST") {
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    const newRow: Record<string, unknown> = {
      ...body,
      ...(table === 'profit-records' ? { partnerAmountRupees: undefined, noCfoSplit: undefined, partnerProfitPercent: undefined, profitCapitalRupees: undefined, ...splitProfit(Number(body['amountRupees']), body['partnerProfitPercent'] as number | null | undefined, Number(active('allocations').find(a => a['id'] === body['allocationId'])?.['amountRupees']), body['noCfoSplit'] as boolean | undefined, body['partnerAmountRupees'] as number | null | undefined) } : {}),
      ...(table === "allocations" ? { cashback: { status: body["creditCardId"] ? "review" : "not_applicable", notes: "" } } : {}),
      id: nextMockId(),
      createdAt: new Date().toISOString(),
    };
    store[table] = [...tableData, newRow];
    logChange(table, null, newRow);
    console.log(`[mockFetch] CREATE ${table} → id=${String(newRow["id"])}`);
    return ok(newRow);
  }

  // PATCH update
  if (method === "PATCH" && id) {
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    let updated: Record<string, unknown> | null = null;
    store[table] = tableData.map((r) => {
      if (r["id"] === id) {
        updated = { ...r, ...body, ...(table === 'profit-records' && r['combinedAmountRupees'] !== undefined && (body['amountRupees'] !== undefined || body['partnerProfitPercent'] !== undefined || body['noCfoSplit'] !== undefined || body['partnerAmountRupees'] !== undefined) ? { partnerAmountRupees: undefined, noCfoSplit: undefined, partnerProfitPercent: undefined, profitCapitalRupees: undefined, ...splitProfit(Number(body['amountRupees'] ?? r['combinedAmountRupees']), (body['partnerProfitPercent'] === undefined ? r['partnerProfitPercent'] : body['partnerProfitPercent']) as number | null | undefined, Number(r['profitCapitalRupees'] ?? active('allocations').find(a => a['id'] === r['allocationId'])?.['amountRupees']), (body['noCfoSplit'] === undefined ? r['noCfoSplit'] : body['noCfoSplit']) as boolean | undefined, (body['partnerAmountRupees'] === undefined ? r['partnerAmountRupees'] : body['partnerAmountRupees']) as number | null | undefined) } : {}) };
        if (table === 'allocations' && r['combination']) updated['combination'] = { ...(r['combination'] as object), revertBlocked: true };
        logChange(table, r, updated);
        return updated;
      }
      return r;
    });
    console.log(`[mockFetch] UPDATE ${table}/${id}`);
    return ok(updated ?? { id, ...body });
  }

  // DELETE soft-delete
  if (method === "DELETE" && id) {
    const row = tableData.find((r) => r["id"] === id);
    if (row && (table === 'profit-records' || table === 'capital-returns')) {
      store['allocations'] = store['allocations']!.map(a => {
        const combo = (a as unknown as CapitalAllocation).combination;
        return combo && (a['id'] === row['allocationId'] || combo.sources.some(s => s.id === row['allocationId']))
          ? { ...a, combination: { ...combo, revertBlocked: true } } : a;
      });
    }
    if (!row) return notFound('Record not found');
    const updated = { ...row, notes: `DELETED:${new Date().toISOString()}\n${originalNotes(row['notes'])}` };
    store[table] = tableData.map(r => r['id'] === id ? updated : r);
    logChange(table, row, updated);
    console.log(`[mockFetch] DELETE ${table}/${id}`);
    return ok({
      id,
      deletedAt: new Date().toISOString(),
      originalNotes: (row?.["notes"] as string) ?? "",
    });
  }

  // Unknown API mutations never escape the local interceptor.
  return notFound(`Unsupported local operation: ${method} ${table}`);
}

// ─── Install ──────────────────────────────────────────────────────────────────

export async function installMockFetch(): Promise<void> {
  // Load seed data BEFORE overriding fetch (uses real fetch to load JSON files)
  await loadSeedData();

  // Now override fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).fetch = mockFetch;

  const seedCount = Object.entries(store)
    .map(([t, rows]) => `${t}: ${rows.length}`)
    .join(", ");

  console.log(
    "%c[CapitalOS Mock Mode] 🧪  All API calls are intercepted — no live data will be read or written.",
    "background:#1a2e1a;color:#4ade80;padding:6px 10px;border-radius:4px;font-weight:bold",
  );
  console.log(`%c[CapitalOS Mock Mode] Seed: ${seedCount}`, "color:#86efac");

  if (Object.values(store).every((rows) => rows.length === 0)) {
    console.warn(
      "%c[CapitalOS Mock Mode] ⚠️  All tables are empty — seed data not found.\n" +
      "   Run: CATALYST_API_URL=https://your-app.catalystserverless.com/server/capitalos-api npm run seed:local",
      "color:#fbbf24",
    );
  }
}
