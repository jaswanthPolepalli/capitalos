import { describe, expect, it } from "vitest";

import {
  DATASTORE_SCHEMA,
  type ColumnDefinition,
  type DatastoreSchema,
} from "../infrastructure/datastore/schema.js";
import { validateDatastoreSchema } from "../infrastructure/datastore/validate-schema.js";

const EXPECTED_TABLES = [
  "Partners",
  "CEOs",
  "Documents",
  "Agreements",
  "Transactions",
  "PartnerContributions",
  "CEOInvestments",
  "ProfitSchedules",
  "PortalAccess",
  "AuditEvents",
  "SchemaVersions",
  "COS_CreditCards",
  "COS_Activity",
  "COS_Reminders",
  "COS_Imports",
] as const;

const REQUIRED_UNIQUE_COLUMNS: Record<string, readonly string[]> = {
  Partners: ["partner_code"],
  CEOs: ["ceo_code"],
  Documents: ["storage_reference"],
  Agreements: ["agreement_code"],
  Transactions: ["transaction_code"],
  PartnerContributions: ["contribution_code"],
  CEOInvestments: ["investment_code"],
  PortalAccess: ["access_code", "token_hash"],
  AuditEvents: ["event_code"],
  SchemaVersions: ["version", "checksum"],
};

const REQUIRED_SEARCH_INDEXES: Record<string, readonly string[]> = {
  Partners: ["partner_code", "name", "status"],
  CEOs: ["ceo_code", "ceo_name", "business_name", "status"],
  Agreements: ["agreement_code", "partner_id", "ceo_id", "start_date", "end_date", "status"],
  PartnerContributions: ["partner_id", "agreement_id", "contribution_date"],
  CEOInvestments: ["ceo_id", "agreement_id", "investment_date", "status"],
  Transactions: [
    "transaction_date",
    "transaction_type",
    "partner_id",
    "ceo_id",
    "agreement_id",
    "direction",
  ],
  ProfitSchedules: ["agreement_id", "partner_id", "ceo_id", "due_date", "status"],
  PortalAccess: ["token_hash", "partner_id", "ceo_id", "active"],
};

const EXPECTED_FOREIGN_KEYS: Record<string, Record<string, string>> = {
  Agreements: { partner_id: "Partners", ceo_id: "CEOs", document_id: "Documents" },
  Transactions: {
    partner_id: "Partners",
    ceo_id: "CEOs",
    agreement_id: "Agreements",
    document_id: "Documents",
  },
  PartnerContributions: {
    partner_id: "Partners",
    agreement_id: "Agreements",
    ledger_transaction_id: "Transactions",
    document_id: "Documents",
  },
  CEOInvestments: {
    ceo_id: "CEOs",
    agreement_id: "Agreements",
    ledger_transaction_id: "Transactions",
    document_id: "Documents",
  },
  ProfitSchedules: { agreement_id: "Agreements", partner_id: "Partners", ceo_id: "CEOs" },
  PortalAccess: { partner_id: "Partners", ceo_id: "CEOs" },
};

const MONEY_COLUMNS: Record<string, readonly string[]> = {
  Agreements: ["capital_amount", "fixed_profit_amount"],
  PartnerContributions: ["amount"],
  CEOInvestments: ["principal_amount"],
  Transactions: ["principal_amount", "profit_amount", "total_amount"],
  ProfitSchedules: [
    "expected_principal",
    "expected_profit",
    "paid_principal",
    "paid_profit",
    "principal_pending",
    "profit_pending",
  ],
};

// ─── Core Schema Contract ─────────────────────────────────────────────────────

describe("Catalyst Data Store schema", () => {
  it("contains the complete Stage 1 table set", () => {
    expect(DATASTORE_SCHEMA.tables.map((table) => table.name)).toEqual(EXPECTED_TABLES);
  });

  it("passes the generic Catalyst schema validator", () => {
    expect(validateDatastoreSchema(DATASTORE_SCHEMA)).toEqual([]);
  });

  it("defines every required single-column unique key", () => {
    for (const [tableName, columnNames] of Object.entries(REQUIRED_UNIQUE_COLUMNS)) {
      for (const columnName of columnNames) {
        expect(getColumn(tableName, columnName).unique, `${tableName}.${columnName}`).toBe(true);
      }
    }
  });

  it("defines the required Catalyst search indexes", () => {
    for (const [tableName, columnNames] of Object.entries(REQUIRED_SEARCH_INDEXES)) {
      for (const columnName of columnNames) {
        expect(getColumn(tableName, columnName).searchIndex, `${tableName}.${columnName}`).toBe(true);
      }
    }
  });

  it("defines all relationships without cascade deletion", () => {
    for (const [tableName, relationships] of Object.entries(EXPECTED_FOREIGN_KEYS)) {
      for (const [columnName, parentTable] of Object.entries(relationships)) {
        const reference = getColumn(tableName, columnName).reference;
        expect(reference?.table, `${tableName}.${columnName}`).toBe(parentTable);
        expect(reference?.column, `${tableName}.${columnName}`).toBe("ROWID");
        expect(reference?.onDelete, `${tableName}.${columnName}`).toBe("ON-DELETE-SET-NULL");
      }
    }
  });

  it("stores all financial amounts as bigint paise", () => {
    expect(DATASTORE_SCHEMA.moneyStorage).toBe("BIGINT_PAISE");
    for (const [tableName, columnNames] of Object.entries(MONEY_COLUMNS)) {
      for (const columnName of columnNames) {
        expect(getColumn(tableName, columnName).dataType, `${tableName}.${columnName}`).toBe("bigint");
      }
    }
  });

  it("keeps the raw portal token out of the schema", () => {
    const portalColumns = getTable("PortalAccess").columns.map((column) => column.name);
    expect(portalColumns).toContain("token_hash");
    expect(portalColumns).not.toContain("token");
    expect(getColumn("PortalAccess", "token_hash").maxLength).toBe(64);
  });

  it("rejects invalid schema mutations", () => {
    const invalid = structuredClone(DATASTORE_SCHEMA) as unknown as DatastoreSchema;
    const agreementPartnerId = invalid.tables
      .find((table) => table.name === "Agreements")
      ?.columns.find((column) => column.name === "partner_id");
    if (agreementPartnerId?.reference === null || agreementPartnerId?.reference === undefined) {
      throw new Error("Test fixture is missing Agreements.partner_id");
    }
    agreementPartnerId.reference.table = "MissingTable";

    expect(validateDatastoreSchema(invalid)).toContain(
      "Agreements.partner_id references unknown table MissingTable",
    );
  });
});

// ─── Table-level constraints ──────────────────────────────────────────────────

describe("Table-level schema constraints", () => {
  it("every table documents at least one application constraint", () => {
    for (const table of DATASTORE_SCHEMA.tables) {
      expect(
        table.applicationConstraints.length,
        `${table.name} should document application constraints`,
      ).toBeGreaterThan(0);
    }
  });

  it("no table exceeds Catalyst's 100-column limit", () => {
    for (const table of DATASTORE_SCHEMA.tables) {
      expect(table.columns.length, `${table.name} has too many columns`).toBeLessThanOrEqual(100);
    }
  });

  it("every table has at least one column", () => {
    for (const table of DATASTORE_SCHEMA.tables) {
      expect(table.columns.length, `${table.name} has no columns`).toBeGreaterThan(0);
    }
  });

  it("all table names follow Catalyst identifier rules (PascalCase alphanumeric)", () => {
    const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
    for (const table of DATASTORE_SCHEMA.tables) {
      expect(
        IDENTIFIER_PATTERN.test(table.name),
        `Table name "${table.name}" is not a valid Catalyst identifier`,
      ).toBe(true);
    }
  });

  it("table names are unique across the schema", () => {
    const tableNames = DATASTORE_SCHEMA.tables.map((t) => t.name);
    const unique = new Set(tableNames);
    expect(unique.size).toBe(tableNames.length);
  });
});

// ─── Column-level constraints ─────────────────────────────────────────────────

describe("Column-level schema constraints", () => {
  it("varchar columns have maxLength between 1 and 255", () => {
    for (const table of DATASTORE_SCHEMA.tables) {
      for (const col of table.columns) {
        if (col.dataType === "varchar") {
          expect(
            col.maxLength !== null && col.maxLength >= 1 && col.maxLength <= 255,
            `${table.name}.${col.name} varchar maxLength out of range`,
          ).toBe(true);
        }
      }
    }
  });

  it("text columns are never marked unique or searchIndex", () => {
    for (const table of DATASTORE_SCHEMA.tables) {
      for (const col of table.columns) {
        if (col.dataType === "text") {
          expect(col.unique, `${table.name}.${col.name} text should not be unique`).toBe(false);
          expect(col.searchIndex, `${table.name}.${col.name} text should not be searchIndex`).toBe(false);
        }
      }
    }
  });

  it("foreign key columns always have a reference defined", () => {
    for (const table of DATASTORE_SCHEMA.tables) {
      for (const col of table.columns) {
        if (col.dataType === "foreign key") {
          expect(
            col.reference,
            `${table.name}.${col.name} foreign key missing reference`,
          ).not.toBeNull();
        }
      }
    }
  });

  it("non-foreign-key columns have no reference", () => {
    for (const table of DATASTORE_SCHEMA.tables) {
      for (const col of table.columns) {
        if (col.dataType !== "foreign key") {
          expect(
            col.reference,
            `${table.name}.${col.name} should not have a reference`,
          ).toBeNull();
        }
      }
    }
  });

  it("all foreign key references use ON-DELETE-SET-NULL (no cascade deletes)", () => {
    for (const table of DATASTORE_SCHEMA.tables) {
      for (const col of table.columns) {
        if (col.reference !== null) {
          expect(
            col.reference.onDelete,
            `${table.name}.${col.name} must use ON-DELETE-SET-NULL`,
          ).toBe("ON-DELETE-SET-NULL");
        }
      }
    }
  });

  it("all foreign key references point to existing tables", () => {
    const tableNames = new Set(DATASTORE_SCHEMA.tables.map((t) => t.name));
    for (const table of DATASTORE_SCHEMA.tables) {
      for (const col of table.columns) {
        if (col.reference !== null) {
          expect(
            tableNames.has(col.reference.table),
            `${table.name}.${col.name} references unknown table "${col.reference.table}"`,
          ).toBe(true);
        }
      }
    }
  });

  it("all column names follow Catalyst identifier rules within each table", () => {
    const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
    for (const table of DATASTORE_SCHEMA.tables) {
      for (const col of table.columns) {
        expect(
          IDENTIFIER_PATTERN.test(col.name),
          `${table.name}.${col.name} is not a valid Catalyst identifier`,
        ).toBe(true);
      }
    }
  });

  it("column names are unique within each table", () => {
    for (const table of DATASTORE_SCHEMA.tables) {
      const names = table.columns.map((c) => c.name);
      const unique = new Set(names);
      expect(unique.size, `${table.name} has duplicate column names`).toBe(names.length);
    }
  });
});

// ─── PII columns ─────────────────────────────────────────────────────────────

describe("PII column classification", () => {
  it("Partners table marks PII columns correctly", () => {
    const piiColumns = getTable("Partners").columns.filter((c) => c.pii).map((c) => c.name);
    expect(piiColumns).toEqual(expect.arrayContaining(["name", "email", "phone", "address"]));
  });

  it("CEOs table marks PII columns correctly", () => {
    const piiColumns = getTable("CEOs").columns.filter((c) => c.pii).map((c) => c.name);
    expect(piiColumns).toEqual(expect.arrayContaining(["ceo_name", "email", "phone", "address"]));
  });

  it("AuditEvents actor_id is marked PII", () => {
    expect(getColumn("AuditEvents", "actor_id").pii).toBe(true);
  });

  it("non-PII operational columns are not marked PII", () => {
    // Status fields should never be PII
    expect(getColumn("Partners", "status").pii).toBe(false);
    expect(getColumn("Agreements", "status").pii).toBe(false);
    expect(getColumn("Transactions", "transaction_type").pii).toBe(false);
  });
});

// ─── Security-critical schema rules ──────────────────────────────────────────

describe("Security-critical schema rules", () => {
  it("PortalAccess stores token_hash, never raw token", () => {
    const colNames = getTable("PortalAccess").columns.map((c) => c.name);
    expect(colNames).toContain("token_hash");
    expect(colNames).not.toContain("token");
    expect(colNames).not.toContain("raw_token");
    expect(colNames).not.toContain("secret");
  });

  it("PortalAccess token_hash is exactly 64 characters (SHA-256 hex)", () => {
    expect(getColumn("PortalAccess", "token_hash").maxLength).toBe(64);
  });

  it("PortalAccess token_hash is unique — prevents token collision attacks", () => {
    expect(getColumn("PortalAccess", "token_hash").unique).toBe(true);
  });

  it("PortalAccess has active and revoked_at columns for token lifecycle", () => {
    const colNames = getTable("PortalAccess").columns.map((c) => c.name);
    expect(colNames).toContain("active");
    expect(colNames).toContain("revoked_at");
  });

  it("no financial table uses cascade delete (all use ON-DELETE-SET-NULL)", () => {
    const financialTables = ["Transactions", "PartnerContributions", "CEOInvestments", "ProfitSchedules"];
    for (const tableName of financialTables) {
      const table = getTable(tableName);
      for (const col of table.columns) {
        if (col.reference !== null) {
          expect(
            col.reference.onDelete,
            `${tableName}.${col.name} must not cascade-delete`,
          ).toBe("ON-DELETE-SET-NULL");
        }
      }
    }
  });

  it("AuditEvents table has before_state and after_state for tamper detection", () => {
    const colNames = getTable("AuditEvents").columns.map((c) => c.name);
    expect(colNames).toContain("before_state");
    expect(colNames).toContain("after_state");
  });
});

// ─── Required-field coverage ──────────────────────────────────────────────────

describe("Required field coverage", () => {
  it("Partners has required: partner_code, name, status", () => {
    expect(getColumn("Partners", "partner_code").required).toBe(true);
    expect(getColumn("Partners", "name").required).toBe(true);
    expect(getColumn("Partners", "status").required).toBe(true);
  });

  it("CEOs has required: ceo_code, ceo_name, business_name, status", () => {
    expect(getColumn("CEOs", "ceo_code").required).toBe(true);
    expect(getColumn("CEOs", "ceo_name").required).toBe(true);
    expect(getColumn("CEOs", "business_name").required).toBe(true);
    expect(getColumn("CEOs", "status").required).toBe(true);
  });

  it("Agreements has required: agreement_code, party_type, capital_amount, start_date", () => {
    expect(getColumn("Agreements", "agreement_code").required).toBe(true);
    expect(getColumn("Agreements", "party_type").required).toBe(true);
    expect(getColumn("Agreements", "capital_amount").required).toBe(true);
    expect(getColumn("Agreements", "start_date").required).toBe(true);
  });

  it("Transactions has required: transaction_code, transaction_date, transaction_type, principal_amount, profit_amount, total_amount, direction, payment_method", () => {
    const requiredCols = [
      "transaction_code",
      "transaction_date",
      "transaction_type",
      "principal_amount",
      "profit_amount",
      "total_amount",
      "direction",
      "payment_method",
    ];
    for (const colName of requiredCols) {
      expect(getColumn("Transactions", colName).required, `Transactions.${colName} should be required`).toBe(true);
    }
  });

  it("ProfitSchedules has required financial amount columns", () => {
    const requiredCols = [
      "expected_principal",
      "expected_profit",
      "paid_principal",
      "paid_profit",
      "principal_pending",
      "profit_pending",
      "status",
    ];
    for (const colName of requiredCols) {
      expect(getColumn("ProfitSchedules", colName).required, `ProfitSchedules.${colName} should be required`).toBe(true);
    }
  });

  it("PortalAccess token_hash and active are required", () => {
    expect(getColumn("PortalAccess", "token_hash").required).toBe(true);
    expect(getColumn("PortalAccess", "active").required).toBe(true);
  });

  it("SchemaVersions version, checksum, description, applied_at, applied_by are required", () => {
    const required = ["version", "checksum", "description", "applied_at", "applied_by"];
    for (const colName of required) {
      expect(getColumn("SchemaVersions", colName).required, `SchemaVersions.${colName} should be required`).toBe(true);
    }
  });
});

// ─── Schema version ───────────────────────────────────────────────────────────

describe("Schema version metadata", () => {
  it("schema version is defined", () => {
    expect(DATASTORE_SCHEMA.version).toBeTruthy();
  });

  it("moneyStorage is BIGINT_PAISE", () => {
    expect(DATASTORE_SCHEMA.moneyStorage).toBe("BIGINT_PAISE");
  });
});

// ─── validateDatastoreSchema validator itself ─────────────────────────────────

describe("validateDatastoreSchema — validator rules", () => {
  it("returns empty array for a valid schema", () => {
    expect(validateDatastoreSchema(DATASTORE_SCHEMA)).toEqual([]);
  });

  it("flags a foreign key column without a reference", () => {
    const broken = structuredClone(DATASTORE_SCHEMA) as unknown as DatastoreSchema;
    const txnAgreement = broken.tables
      .find((t) => t.name === "Transactions")
      ?.columns.find((c) => c.name === "agreement_id") as ColumnDefinition;
    (txnAgreement as any).reference = null;
    const issues = validateDatastoreSchema(broken);
    expect(issues.some((i) => i.includes("Transactions.agreement_id"))).toBe(true);
  });

  it("flags a non-foreign-key column that has a reference attached", () => {
    const broken = structuredClone(DATASTORE_SCHEMA) as unknown as DatastoreSchema;
    const partnerCode = broken.tables
      .find((t) => t.name === "Partners")
      ?.columns.find((c) => c.name === "partner_code") as ColumnDefinition;
    (partnerCode as any).reference = { table: "Partners", column: "ROWID", onDelete: "ON-DELETE-SET-NULL" };
    const issues = validateDatastoreSchema(broken);
    expect(issues.some((i) => i.includes("Partners.partner_code"))).toBe(true);
  });

  it("flags a table with no application constraints", () => {
    const broken = structuredClone(DATASTORE_SCHEMA) as unknown as DatastoreSchema;
    const partners = broken.tables.find((t) => t.name === "Partners");
    if (partners) {
      (partners as any).applicationConstraints = [];
    }
    const issues = validateDatastoreSchema(broken);
    expect(issues.some((i) => i.includes("Partners"))).toBe(true);
  });

  it("flags a reference to an unknown table", () => {
    const broken = structuredClone(DATASTORE_SCHEMA) as unknown as DatastoreSchema;
    const agreementPartnerId = broken.tables
      .find((t) => t.name === "Agreements")
      ?.columns.find((c) => c.name === "partner_id") as ColumnDefinition;
    (agreementPartnerId.reference as any).table = "GhostTable";
    expect(validateDatastoreSchema(broken)).toContain(
      "Agreements.partner_id references unknown table GhostTable",
    );
  });
});

// ─── Helper functions ─────────────────────────────────────────────────────────

function getTable(tableName: string) {
  const table = DATASTORE_SCHEMA.tables.find((candidate) => candidate.name === tableName);
  if (table === undefined) {
    throw new Error(`Unknown test table ${tableName}`);
  }
  return table;
}

function getColumn(tableName: string, columnName: string): ColumnDefinition {
  const column = getTable(tableName).columns.find((candidate) => candidate.name === columnName);
  if (column === undefined) {
    throw new Error(`Unknown test column ${tableName}.${columnName}`);
  }
  return column;
}
