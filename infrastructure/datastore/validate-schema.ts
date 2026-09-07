import type { ColumnDefinition, DatastoreSchema } from "./schema.js";

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export function validateDatastoreSchema(schema: DatastoreSchema): string[] {
  const issues: string[] = [];
  const tableNames = new Set<string>();

  for (const table of schema.tables) {
    if (!IDENTIFIER_PATTERN.test(table.name)) {
      issues.push(`Invalid Catalyst table name: ${table.name}`);
    }
    if (tableNames.has(table.name)) {
      issues.push(`Duplicate table name: ${table.name}`);
    }
    tableNames.add(table.name);

    if (table.columns.length > 100) {
      issues.push(`${table.name} exceeds Catalyst's 100-column development limit`);
    }
    if (table.applicationConstraints.length === 0) {
      issues.push(`${table.name} must document application-enforced constraints`);
    }

    const columnNames = new Set<string>();
    for (const column of table.columns) {
      validateColumn(table.name, column, columnNames, issues);
    }
  }

  for (const table of schema.tables) {
    for (const column of table.columns) {
      if (column.reference !== null && !tableNames.has(column.reference.table)) {
        issues.push(`${table.name}.${column.name} references unknown table ${column.reference.table}`);
      }
    }
  }

  return issues;
}

export function assertValidDatastoreSchema(schema: DatastoreSchema): void {
  const issues = validateDatastoreSchema(schema);
  if (issues.length > 0) {
    throw new Error(`Invalid Data Store schema:\n- ${issues.join("\n- ")}`);
  }
}

function validateColumn(
  tableName: string,
  column: ColumnDefinition,
  columnNames: Set<string>,
  issues: string[],
): void {
  const qualifiedName = `${tableName}.${column.name}`;

  if (!IDENTIFIER_PATTERN.test(column.name)) {
    issues.push(`Invalid Catalyst column name: ${qualifiedName}`);
  }
  if (columnNames.has(column.name)) {
    issues.push(`Duplicate column name: ${qualifiedName}`);
  }
  columnNames.add(column.name);

  if (column.dataType === "varchar" && (column.maxLength === null || column.maxLength > 255)) {
    issues.push(`${qualifiedName} varchar max length must be between 1 and 255`);
  }
  if (column.dataType === "text" && (column.unique || column.searchIndex)) {
    issues.push(`${qualifiedName} text columns cannot be unique or search-indexed`);
  }
  if (column.dataType === "foreign key" && column.reference === null) {
    issues.push(`${qualifiedName} is missing its foreign-key reference`);
  }
  if (column.dataType !== "foreign key" && column.reference !== null) {
    issues.push(`${qualifiedName} has a foreign-key reference but is ${column.dataType}`);
  }
  if (column.reference?.onDelete !== undefined && column.reference.onDelete !== "ON-DELETE-SET-NULL") {
    issues.push(`${qualifiedName} must not cascade-delete financial history`);
  }
}