export type CatalystDataType =
  | "text"
  | "varchar"
  | "date"
  | "datetime"
  | "int"
  | "double"
  | "boolean"
  | "bigint"
  | "encrypted text"
  | "foreign key";

export interface ForeignKeyReference {
  table: string;
  column: "ROWID";
  onDelete: "ON-DELETE-SET-NULL";
}

export interface ColumnDefinition {
  name: string;
  dataType: CatalystDataType;
  required: boolean;
  unique: boolean;
  searchIndex: boolean;
  pii: boolean;
  maxLength: number | null;
  defaultValue: string | null;
  reference: ForeignKeyReference | null;
}

export interface TableDefinition {
  name: string;
  columns: readonly ColumnDefinition[];
  applicationConstraints: readonly string[];
}

export interface DatastoreSchema {
  version: string;
  moneyStorage: "BIGINT_PAISE";
  tables: readonly TableDefinition[];
}

interface ColumnOptions {
  required?: boolean;
  unique?: boolean;
  searchIndex?: boolean;
  pii?: boolean;
  defaultValue?: string;
}

function column(
  name: string,
  dataType: CatalystDataType,
  maxLength: number | null,
  options: ColumnOptions = {},
  reference: ForeignKeyReference | null = null,
): ColumnDefinition {
  return {
    name,
    dataType,
    required: options.required ?? false,
    unique: options.unique ?? false,
    searchIndex: options.searchIndex ?? false,
    pii: options.pii ?? false,
    maxLength,
    defaultValue: options.defaultValue ?? null,
    reference,
  };
}

function varchar(name: string, maxLength: number, options: ColumnOptions = {}): ColumnDefinition {
  return column(name, "varchar", maxLength, options);
}

function text(name: string, options: Omit<ColumnOptions, "unique" | "searchIndex"> = {}): ColumnDefinition {
  return column(name, "text", 10_000, options);
}

function bigint(name: string, options: ColumnOptions = {}): ColumnDefinition {
  return column(name, "bigint", 19, options);
}

function date(name: string, options: Omit<ColumnOptions, "unique"> = {}): ColumnDefinition {
  return column(name, "date", 50, options);
}

function datetime(name: string, options: Omit<ColumnOptions, "unique"> = {}): ColumnDefinition {
  return column(name, "datetime", 50, options);
}

function bool(name: string, options: Omit<ColumnOptions, "unique"> = {}): ColumnDefinition {
  return column(name, "boolean", 50, options);
}

function foreignKey(
  name: string,
  parentTable: string,
  options: Omit<ColumnOptions, "defaultValue"> = {},
): ColumnDefinition {
  return column(name, "foreign key", 50, options, {
    table: parentTable,
    column: "ROWID",
    onDelete: "ON-DELETE-SET-NULL",
  });
}

const Partners: TableDefinition = {
  name: "Partners",
  columns: [
    varchar("partner_code", 50, { required: true, unique: true, searchIndex: true }),
    varchar("name", 255, { required: true, searchIndex: true, pii: true }),
    varchar("phone", 30, { pii: true }),
    varchar("email", 255, { pii: true }),
    text("address", { pii: true }),
    varchar("status", 40, { required: true, searchIndex: true }),
    text("notes", { pii: true }),
    datetime("deleted_at", { searchIndex: true }),
  ],
  applicationConstraints: [
    "status must be an allowed application status code",
    "records referenced by financial history cannot be hard-deleted",
    "deletion is soft: deleted_at is set to the deletion timestamp; the row is never physically removed",
    "all related Agreements, PartnerContributions, ProfitSchedules, PortalAccess, and Transactions rows must have their own deleted_at set in the same operation",
  ],
};

const CEOs: TableDefinition = {
  name: "CEOs",
  columns: [
    varchar("ceo_code", 50, { required: true, unique: true, searchIndex: true }),
    varchar("ceo_name", 255, { required: true, searchIndex: true, pii: true }),
    varchar("business_name", 255, { required: true, searchIndex: true }),
    varchar("phone", 30, { pii: true }),
    varchar("email", 255, { pii: true }),
    text("address", { pii: true }),
    varchar("status", 40, { required: true, searchIndex: true }),
    text("notes", { pii: true }),
  ],
  applicationConstraints: [
    "status must be an allowed application status code",
    "records referenced by financial history cannot be hard-deleted",
  ],
};

const Documents: TableDefinition = {
  name: "Documents",
  columns: [
    varchar("file_name", 255, { required: true, searchIndex: true }),
    varchar("file_type", 100, { required: true, searchIndex: true }),
    bigint("file_size_bytes", { required: true }),
    varchar("storage_reference", 255, { required: true, unique: true }),
    varchar("uploaded_by", 255, { required: true }),
  ],
  applicationConstraints: [
    "file_size_bytes must be greater than zero",
    "storage references are internal and every download requires record authorization",
  ],
};

const Agreements: TableDefinition = {
  name: "Agreements",
  columns: [
    varchar("agreement_code", 50, { required: true, unique: true, searchIndex: true }),
    varchar("party_type", 20, { required: true, searchIndex: true }),
    foreignKey("partner_id", "Partners", { searchIndex: true }),
    foreignKey("ceo_id", "CEOs", { searchIndex: true }),
    varchar("agreement_type", 20, { required: true, searchIndex: true }),
    bigint("capital_amount", { required: true }),
    date("start_date", { required: true, searchIndex: true }),
    date("end_date", { searchIndex: true }),
    varchar("profit_calculation_type", 20, { required: true, searchIndex: true }),
    varchar("profit_rate", 50),
    bigint("fixed_profit_amount"),
    text("custom_profit_terms"),
    varchar("profit_frequency", 20, { required: true, searchIndex: true }),
    text("custom_frequency_terms"),
    text("principal_repayment_terms", { required: true }),
    text("profit_payment_terms", { required: true }),
    varchar("status", 40, { required: true, searchIndex: true }),
    text("notes", { pii: true }),
    foreignKey("document_id", "Documents"),
  ],
  applicationConstraints: [
    "party_type and agreement_type must match",
    "exactly one of partner_id or ceo_id must be present and match agreement_type",
    "capital_amount is a positive integer number of paise",
    "end_date cannot precede start_date",
    "FIXED requires only fixed_profit_amount",
    "PERCENTAGE requires only profit_rate",
    "CUSTOM requires only custom_profit_terms and is never calculated implicitly",
    "CUSTOM profit frequency requires custom_frequency_terms",
  ],
};

const Transactions: TableDefinition = {
  name: "Transactions",
  columns: [
    varchar("transaction_code", 50, { required: true, unique: true, searchIndex: true }),
    date("transaction_date", { required: true, searchIndex: true }),
    varchar("transaction_type", 50, { required: true, searchIndex: true }),
    foreignKey("partner_id", "Partners", { searchIndex: true }),
    foreignKey("ceo_id", "CEOs", { searchIndex: true }),
    foreignKey("agreement_id", "Agreements", { searchIndex: true }),
    bigint("principal_amount", { required: true }),
    bigint("profit_amount", { required: true }),
    bigint("total_amount", { required: true }),
    varchar("direction", 10, { required: true, searchIndex: true }),
    varchar("payment_method", 50, { required: true, searchIndex: true }),
    varchar("reference_number", 255, { pii: true }),
    text("notes", { pii: true }),
    foreignKey("document_id", "Documents"),
  ],
  applicationConstraints: [
    "principal_amount and profit_amount are non-negative integer paise",
    "total_amount equals principal_amount plus profit_amount",
    "transaction_type determines party type, amount component, and direction",
    "the referenced agreement, when present, belongs to the referenced party",
    "posted transactions are corrected through a traceable reversal workflow and never hard-deleted",
  ],
};

const PartnerContributions: TableDefinition = {
  name: "PartnerContributions",
  columns: [
    varchar("contribution_code", 50, { required: true, unique: true, searchIndex: true }),
    foreignKey("partner_id", "Partners", { required: true, searchIndex: true }),
    foreignKey("agreement_id", "Agreements", { required: true, searchIndex: true }),
    foreignKey("ledger_transaction_id", "Transactions", { searchIndex: true }),
    date("contribution_date", { required: true, searchIndex: true }),
    bigint("amount", { required: true }),
    varchar("payment_method", 50, { required: true, searchIndex: true }),
    varchar("reference_number", 255, { pii: true }),
    text("notes", { pii: true }),
    foreignKey("document_id", "Documents"),
  ],
  applicationConstraints: [
    "amount is a positive integer number of paise",
    "agreement_id references a PARTNER agreement owned by partner_id",
    "ledger_transaction_id, once posted, is unique and references a matching PARTNER_CAPITAL_RECEIVED transaction",
  ],
};

const CEOInvestments: TableDefinition = {
  name: "CEOInvestments",
  columns: [
    varchar("investment_code", 50, { required: true, unique: true, searchIndex: true }),
    foreignKey("ceo_id", "CEOs", { required: true, searchIndex: true }),
    foreignKey("agreement_id", "Agreements", { required: true, searchIndex: true }),
    foreignKey("ledger_transaction_id", "Transactions", { searchIndex: true }),
    date("investment_date", { required: true, searchIndex: true }),
    bigint("principal_amount", { required: true }),
    text("purpose", { required: true }),
    varchar("payment_method", 50, { required: true, searchIndex: true }),
    varchar("reference_number", 255, { pii: true }),
    varchar("status", 40, { required: true, searchIndex: true }),
    text("notes", { pii: true }),
    foreignKey("document_id", "Documents"),
  ],
  applicationConstraints: [
    "principal_amount is a positive integer number of paise",
    "agreement_id references a CEO agreement owned by ceo_id",
    "ledger_transaction_id, once posted, is unique and references a matching CEO_CAPITAL_PROVIDED transaction",
  ],
};

const ProfitSchedules: TableDefinition = {
  name: "ProfitSchedules",
  columns: [
    foreignKey("agreement_id", "Agreements", { required: true, searchIndex: true }),
    foreignKey("partner_id", "Partners", { searchIndex: true }),
    foreignKey("ceo_id", "CEOs", { searchIndex: true }),
    date("due_date", { required: true, searchIndex: true }),
    bigint("expected_principal", { required: true }),
    bigint("expected_profit", { required: true }),
    bigint("paid_principal", { required: true }),
    bigint("paid_profit", { required: true }),
    bigint("principal_pending", { required: true }),
    bigint("profit_pending", { required: true }),
    varchar("status", 40, { required: true, searchIndex: true }),
  ],
  applicationConstraints: [
    "exactly one of partner_id or ceo_id is present and owns agreement_id",
    "expected and paid amounts are non-negative integer paise",
    "pending amounts equal expected minus paid and cannot hide overpayment",
    "agreement_id plus due_date is unique for an obligation period",
    "status is derived from due date and payment activity",
  ],
};

const PortalAccess: TableDefinition = {
  name: "PortalAccess",
  columns: [
    varchar("access_code", 50, { required: true, unique: true, searchIndex: true }),
    varchar("access_type", 20, { required: true, searchIndex: true }),
    foreignKey("partner_id", "Partners", { searchIndex: true }),
    foreignKey("ceo_id", "CEOs", { searchIndex: true }),
    varchar("token_hash", 64, { required: true, unique: true, searchIndex: true }),
    bool("active", { required: true, searchIndex: true, defaultValue: "true" }),
    datetime("revoked_at", { searchIndex: true }),
    datetime("last_access_at", { searchIndex: true }),
  ],
  applicationConstraints: [
    "exactly one party reference is present and matches access_type",
    "token_hash is a unique lowercase SHA-256 hash; raw tokens are never stored",
    "at most one active token exists per party",
    "inactive tokens record revoked_at and fail authorization immediately",
  ],
};

const AuditEvents: TableDefinition = {
  name: "AuditEvents",
  columns: [
    varchar("event_code", 50, { required: true, unique: true, searchIndex: true }),
    varchar("entity_type", 50, { required: true, searchIndex: true }),
    bigint("entity_id", { required: true, searchIndex: true }),
    varchar("action", 40, { required: true, searchIndex: true }),
    varchar("actor_id", 255, { required: true, searchIndex: true, pii: true }),
    text("before_state", { pii: true }),
    text("after_state", { pii: true }),
    text("reason", { pii: true }),
    datetime("occurred_at", { required: true, searchIndex: true }),
  ],
  applicationConstraints: [
    "audit events are append-only",
    "sensitive snapshots are never returned through public APIs",
  ],
};

const SchemaVersions: TableDefinition = {
  name: "SchemaVersions",
  columns: [
    varchar("version", 50, { required: true, unique: true, searchIndex: true }),
    varchar("checksum", 64, { required: true, unique: true }),
    varchar("description", 255, { required: true }),
    datetime("applied_at", { required: true, searchIndex: true }),
    varchar("applied_by", 255, { required: true, pii: true }),
  ],
  applicationConstraints: [
    "schema versions are append-only and checksums are immutable",
  ],
};

const COS_CreditCards: TableDefinition = {
  name: "COS_CreditCards",
  columns: [
    foreignKey("partner_id", "Partners", { required: true, searchIndex: true }),
    varchar("card_name", 255, { required: true, searchIndex: true }),
    bigint("card_limit", { required: true }),
    bigint("pending_limit"),
    date("bill_generation_date", { required: true }),
    date("due_date", { required: true }),
    text("notes"),
  ],
  applicationConstraints: [
    "card_limit and pending_limit are non-negative integer rupees",
    "bill_generation_date and due_date encode the monthly billing cycle pattern",
    "soft-delete via DELETED: prefix in notes column (same pattern as COS_* tables)",
  ],
};

// Additive tables used by the active COS API. IDs are varchar references to COS_*
// records, not foreign keys to the older Stage 1 tables.
export const OPERATIONS_TABLES: readonly TableDefinition[] = [
  {
    name: "COS_Activity",
    columns: [
      varchar("event_id", 80, { required: true, unique: true }),
      varchar("operation_id", 80, { required: true, searchIndex: true }),
      varchar("entity_type", 50, { required: true, searchIndex: true }),
      varchar("entity_id", 50, { searchIndex: true }),
      varchar("action", 40, { required: true }),
      varchar("status", 40, { required: true }),
      varchar("actor", 255, { required: true, pii: true }),
      varchar("occurred_at", 50, { required: true, searchIndex: true }),
      text("before_state", { pii: true }), text("after_state", { pii: true }), text("reason"),
    ],
    applicationConstraints: ["Append-only intents and outcomes; no application update/delete route", "Actor is explicitly unverified until server authentication is implemented"],
  },
  {
    name: "COS_Reminders",
    columns: [
      varchar("event_id", 80, { required: true, unique: true }),
      varchar("obligation_id", 255, { required: true, searchIndex: true }),
      varchar("partner_id", 50, { required: true, searchIndex: true }),
      varchar("allocation_id", 50, { required: true, searchIndex: true }),
      varchar("kind", 40, { required: true }), varchar("action", 40, { required: true }),
      varchar("channel", 40, { required: true }), bigint("amount_paise", { required: true }),
      date("due_date", { required: true }), date("follow_up_date"), text("notes", { pii: true }),
      varchar("occurred_at", 50, { required: true, searchIndex: true }),
    ],
    applicationConstraints: ["Append-only manual reminder events; sent means confirmed by the operator, not provider delivery", "Profit estimates are not booked liabilities"],
  },
  {
    name: "COS_Imports",
    columns: [
      varchar("import_key", 80, { required: true, unique: true }),
      varchar("entity_type", 50, { required: true }), varchar("entity_id", 50),
      varchar("status", 40, { required: true }), varchar("occurred_at", 50, { required: true }),
    ],
    applicationConstraints: ["Unique row fingerprints prevent repeating an import", "Unconfirmed writes require record inspection before another import attempt"],
  },
];

export const DATASTORE_SCHEMA = {
  version: "1.0.0",
  moneyStorage: "BIGINT_PAISE",
  tables: [
    Partners,
    CEOs,
    Documents,
    Agreements,
    Transactions,
    PartnerContributions,
    CEOInvestments,
    ProfitSchedules,
    PortalAccess,
    AuditEvents,
    SchemaVersions,
    COS_CreditCards,
    ...OPERATIONS_TABLES,
  ],
} as const satisfies DatastoreSchema;
