/** Additive migration only: prints the plan by default; --apply targets Development. */
import { OPERATIONS_TABLES } from '../infrastructure/datastore/schema.js';
const apply = process.argv.includes('--apply');
const check = process.argv.includes('--check');
if (!apply && !check) {
  console.log(JSON.stringify({ environment: 'Development', tables: OPERATIONS_TABLES.map(t => ({ name: t.name, columns: t.columns.map(c => ({ name: c.name, type: c.dataType, unique: c.unique })) })) }, null, 2));
} else {
  const project = process.env.CATALYST_PROJECT_ID;
  const token = process.env.CATALYST_ACCESS_TOKEN;
  if (!project || !/^\d+$/.test(project) || !token) throw new Error('Set CATALYST_PROJECT_ID and CATALYST_ACCESS_TOKEN; no credentials are read from personal settings.');
  const origin = process.env.CATALYST_API_ORIGIN || 'https://api.catalyst.zoho.in';
  if (!/^https:\/\/api\.catalyst\.zoho\.(in|com|eu|com\.au|jp|ca)$/.test(origin)) throw new Error('Use the official Catalyst API origin for your data center.');
  async function request(path: string, method = 'GET', body?: unknown, attempt = 0): Promise<Record<string, unknown>[]> {
    const response = await fetch(`${origin}/baas/v1/project/${project}${path}`, { method, signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json', Environment: 'Development' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (method === 'GET' && response.status === 404 && attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
      return request(path, method, body, attempt + 1);
    }
    const result = await response.json() as { status: string; data: Record<string, unknown>[] | Record<string, unknown> };
    if (!response.ok || result.status !== 'success') throw new Error(`Catalyst schema request failed: ${method} ${path} (${response.status}). No secrets or response payloads logged.`);
    return Array.isArray(result.data) ? result.data : [result.data];
  }
  const tables = await request('/table');
  for (const table of OPERATIONS_TABLES) {
    let found = tables.find(t => t['table_name'] === table.name);
    if (!found) {
      if (!apply) throw new Error(`Missing table ${table.name}. Run with --apply in Development before deploying the API.`);
      found = (await request('/table', 'POST', { table_name: table.name }))[0];
    }
    // Catalyst can return numeric IDs larger than JavaScript's safe integer range.
    // Address tables by their documented unique names to avoid rounding IDs.
    const id = encodeURIComponent(table.name);
    const columns = await request(`/table/${id}/column`);
    for (const column of table.columns) {
      const existing = columns.find(c => c['column_name'] === column.name);
      if (existing) {
        if (existing['data_type'] !== column.dataType || (column.unique && existing['is_unique'] !== true) || (column.required && existing['is_mandatory'] !== true) || (column.maxLength && Number(existing['max_length']) < column.maxLength)) throw new Error(`Incompatible column ${table.name}.${column.name}; review it manually. No destructive migration attempted.`);
        continue;
      }
      if (!apply) throw new Error(`Missing column ${table.name}.${column.name}.`);
      await request(`/table/${id}/column`, 'POST', [{ column_name: column.name, data_type: column.dataType,
        is_unique: column.unique, is_mandatory: column.required, search_index_enabled: column.searchIndex,
        audit_consent: column.pii, ...(column.maxLength ? { max_length: column.maxLength } : {}) }]);
    }
    console.log(`Verified ${table.name}`);
  }
  console.log('Development schema is ready. Verify function access and table permissions, then promote the additive schema using Catalyst production deployment.');
}
