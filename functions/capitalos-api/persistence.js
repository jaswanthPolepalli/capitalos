"use strict";

const { randomUUID } = require('node:crypto');
const ACTIVITY_TABLE = 'COS_Activity';
const REMINDER_TABLE = 'COS_Reminders';

async function allRows(table) {
  const rows = [];
  const visited = new Set();
  let nextToken;
  do {
    const page = await table.getPagedRows({ maxRows: 200, ...(nextToken ? { nextToken } : {}) });
    if (!Array.isArray(page.data)) throw new Error('Datastore returned an invalid page; no partial result was accepted.');
    rows.push(...page.data);
    nextToken = page.next_token;
    if (page.more_records && !nextToken) throw new Error('Datastore omitted its continuation token; retry loading.');
    if (nextToken && visited.has(nextToken)) throw new Error('Datastore repeated its continuation token; retry loading.');
    if (nextToken) visited.add(nextToken);
  } while (nextToken);
  return rows;
}

const { deletedAt, originalNotes, visibility } = require('./records.mjs');
function snapshot(row) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).filter(([key]) => !['CREATORID', 'MODIFIEDTIME', 'CREATEDTIME'].includes(key)));
}
function jsonSnapshot(value) {
  const text = JSON.stringify(snapshot(value));
  // Refuse the write before changing the record if it cannot be audited in full.
  if (text.length > 10000) throw new Error('Record is too large for change history. Shorten the notes before saving.');
  return text;
}

function repository(table) {
  const fetch = name => allRows(table(name));
  async function audit(event) {
    return table(ACTIVITY_TABLE).insertRow({
      event_id: randomUUID(), operation_id: event.operationId,
      entity_type: event.tableName, entity_id: String(event.rowId || ''),
      action: event.action, status: event.status,
      actor: 'Unverified caller', occurred_at: new Date().toISOString(),
      before_state: jsonSnapshot(event.before), after_state: jsonSnapshot(event.after),
      reason: event.reason || '',
    });
  }
  async function mutate(tableName, rowId, data, reason = '') {
    const before = rowId ? await table(tableName).getRow(rowId) : null;
    if (rowId && !before) throw new Error('Record not found.');
    const after = { ...before, ...data };
    const action = !before ? 'create' : !deletedAt(before.notes) && deletedAt(after.notes) ? 'delete'
      : deletedAt(before.notes) && !deletedAt(after.notes) ? 'restore' : 'update';
    const event = { tableName, rowId, before, after, action, reason, operationId: randomUUID() };
    // Intent is append-only and durable before any financial write. Completion is
    // a second event, never an overwrite. Unconfirmed intents remain inspectable.
    await audit({ ...event, status: 'pending' });
    let saved;
    try {
      saved = rowId ? await table(tableName).updateRow({ ...data, ROWID: rowId }) : await table(tableName).insertRow(data);
    } catch (error) {
      await audit({ ...event, status: 'unconfirmed', reason: 'Datastore response failed; inspect the record before retrying.' }).catch(() => {});
      throw error;
    }
    try {
      await audit({ ...event, rowId: saved.ROWID, after: saved, status: 'committed' });
    } catch {
      const error = new Error('Record saved, but history confirmation failed. Refresh and inspect it before retrying.');
      error.statusCode = 503;
      throw error;
    }
    return saved;
  }
  return { fetch, insert: (name, data, reason) => mutate(name, null, data, reason), update: mutate };
}

// Logical cascading keeps parent/child visibility consistent without a partially
// completed series of child writes. Independently deleted children stay deleted.

module.exports = { ACTIVITY_TABLE, REMINDER_TABLE, allRows, repository, deletedAt, originalNotes, visibility };
