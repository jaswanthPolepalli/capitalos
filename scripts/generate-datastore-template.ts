import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  DATASTORE_SCHEMA,
  type ColumnDefinition,
  type TableDefinition,
} from "../infrastructure/datastore/schema.js";
import { assertValidDatastoreSchema } from "../infrastructure/datastore/validate-schema.js";

const TEMPLATE_PATH = resolve("project-template-1.0.0.json");

interface IacComponent {
  type: "table" | "column" | "tableScope" | "tablePermission";
  name: string;
  properties: Record<string, unknown>;
  dependsOn: string[];
}

function createTableComponent(table: TableDefinition): IacComponent {
  return {
    type: "table",
    name: table.name,
    properties: { table_name: table.name },
    dependsOn: [],
  };
}

function createColumnComponent(table: TableDefinition, column: ColumnDefinition): IacComponent {
  const properties: Record<string, unknown> = {
    audit_consent: column.pii,
    decimal_digits: 2,
    column_name: column.name,
    data_type: column.dataType,
    is_unique: column.unique,
    is_mandatory: column.required,
    search_index_enabled: column.searchIndex,
    table_id: table.name,
    table_name: table.name,
    max_length: column.maxLength,
  };

  if (column.defaultValue !== null) {
    properties.default_value = column.defaultValue;
  }

  const dependsOn = [`Datastore.table.${table.name}`];
  if (column.reference !== null) {
    properties.parent_table = column.reference.table;
    properties.parent_column = column.reference.column;
    properties.constraint_type = column.reference.onDelete;
    dependsOn.unshift(`Datastore.table.${column.reference.table}`);
    dependsOn.push("Datastore.column.ROWID");
  }

  return {
    type: "column",
    name: `${table.name}-${column.name}`,
    properties,
    dependsOn,
  };
}

function createAdminComponents(table: TableDefinition): IacComponent[] {
  return [
    {
      type: "tableScope",
      name: `${table.name}-App Administrator`,
      properties: {
        role_name: "App Administrator",
        table_scope: "GLOBAL",
        type: "App Administrator",
        table_name: table.name,
      },
      dependsOn: [`Datastore.table.${table.name}`],
    },
    {
      type: "tablePermission",
      name: `${table.name}-App Administrator`,
      properties: {
        role_name: "App Administrator",
        type: "App Administrator",
        table_permissions: ["SELECT", "UPDATE", "INSERT"],
        table_name: table.name,
      },
      dependsOn: [`Datastore.table.${table.name}`],
    },
  ];
}

function buildTemplate(): string {
  assertValidDatastoreSchema(DATASTORE_SCHEMA);

  const tableComponents = DATASTORE_SCHEMA.tables.map(createTableComponent);
  const childComponents = DATASTORE_SCHEMA.tables.flatMap((table) => [
    ...table.columns.map((column) => createColumnComponent(table, column)),
    ...createAdminComponents(table),
  ]);

  const template = {
    name: "project-template",
    version: DATASTORE_SCHEMA.version,
    parameters: {},
    components: {
      Datastore: [...tableComponents, ...childComponents],
    },
  };

  return `${JSON.stringify(template, null, 2)}\n`;
}

async function main(): Promise<void> {
  const expected = buildTemplate();
  if (process.argv.includes("--check")) {
    const current = await readFile(TEMPLATE_PATH, "utf8").catch(() => "");
    if (current !== expected) {
      throw new Error("project-template-1.0.0.json is missing or out of date; run npm run schema:generate");
    }
    return;
  }

  await writeFile(TEMPLATE_PATH, expected, "utf8");
}

await main();