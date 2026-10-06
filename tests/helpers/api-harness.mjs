import Module, { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';

export function createApiHarness(seed = {}, fail, sendMail) {
  const db = Object.fromEntries(['COS_Partners', 'COS_Allocations', 'COS_Returns', 'COS_Profits', 'COS_CreditCards', 'COS_Activity', 'COS_Reminders', 'COS_Imports'].map(name => [name, structuredClone(seed[name] || [])]));
  const calls = [];
  let counter = 10000;
  const table = name => ({
    async getPagedRows(options = {}) {
      calls.push({ table: name, operation: 'page', options });
      if (fail?.(name, 'page', options)) throw new Error('Synthetic datastore failure');
      const all = db[name] || []; const start = Number(options.nextToken || 0), end = start + (options.maxRows || 200);
      return { data: structuredClone(all.slice(start, end)), next_token: end < all.length ? String(end) : undefined, more_records: end < all.length };
    },
    async getRow(id) { return structuredClone(db[name]?.find(r => String(r.ROWID) === String(id))); },
    async insertRow(data) {
      calls.push({ table: name, operation: 'insert', data: structuredClone(data) });
      if (fail?.(name, 'insert', data)) throw new Error('Synthetic insert failure');
      const unique = name === 'COS_Imports' ? 'import_key' : ['COS_Activity', 'COS_Reminders'].includes(name) ? 'event_id' : null;
      if (unique && db[name].some(row => row[unique] === data[unique])) throw new Error('Duplicate unique key');
      const row = { ...structuredClone(data), ROWID: String(++counter), CREATEDTIME: '2026-09-18T12:00:00Z' };
      db[name].push(row); return structuredClone(row);
    },
    async updateRow(data) {
      calls.push({ table: name, operation: 'update', data: structuredClone(data) });
      if (fail?.(name, 'update', data)) throw new Error('Synthetic update failure');
      const row = db[name].find(r => String(r.ROWID) === String(data.ROWID));
      if (!row) throw new Error('Missing row'); Object.assign(row, structuredClone(data)); return structuredClone(row);
    },
  });
  const app = { datastore: () => ({ table, getAllTables: async () => Object.keys(db).map(table_name => ({ table_name })) }) };
  const filename = resolve('functions/capitalos-api/index.js');
  const mod = new Module(filename);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(dirname(filename));
  const realRequire = createRequire(filename);
  mod.require = name => name === 'zcatalyst-sdk-node' ? { initialize: () => app } : name === 'nodemailer' ? { createTransport: () => ({ sendMail: sendMail || (async () => { throw new Error('Tests must not send mail'); }) }) } : realRequire(name);
  mod._compile(readFileSync(filename, 'utf8'), filename);
  async function request(method, url, body) {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]); req.method = method; req.url = url; req.headers = {};
    let status = 200, payload;
    const res = { writeHead(code) { status = code; }, end(text) { payload = text ? JSON.parse(text) : undefined; } };
    await mod.exports(req, res);
    return { status, ...payload };
  }
  return { request, db, calls, table };
}
export function baseData() {
  return {
    COS_Partners: [{ ROWID: 'p', name: 'Synthetic Partner', notes: '', email: '' }],
    COS_Allocations: [{ ROWID: 'a', partner_id: 'p', amount_rupees: 10000, profit_percent: '3', received_date: '2026-01-01', return_date: '2026-12-01', notes: '' }],
    COS_Returns: [{ ROWID: 'r', partner_id: 'p', allocation_id: 'a', amount_rupees: 1000, returned_date: '2026-02-01', notes: '' }],
    COS_Profits: [{ ROWID: 'f', partner_id: 'p', allocation_id: 'a', amount_rupees: 300, paid_date: '2026-02-01', notes: '' }],
    COS_CreditCards: [{ ROWID: 'c', partner_id: 'p', card_name: 'Synthetic Card', notes: '' }],
  };
}
