import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeftRight,
  CircleDashed,
  Download,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { FilterBar, SelectFilter } from "../components/FilterBar";
import { LoadingRows } from "../components/LoadingRows";
import { MoneyDisplay } from "../components/MoneyDisplay";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { TransactionTypeBadge } from "../components/TransactionTypeBadge";
import { formatDate } from "../lib/format";
import { downloadCSV, csvFilename } from "../lib/csv";
import { MOCK_AGREEMENTS, MOCK_CEOS, MOCK_PARTNERS } from "../mocks/data";
import { useTransactions } from "../mocks/transactionHooks";
import type { LedgerTransaction, TransactionType } from "../types/domain";

// ─── Filter options ────────────────────────────────────────────────────────────

const PARTNER_OPTIONS = [
  { value: "ALL", label: "All partners" },
  ...MOCK_PARTNERS.map((p) => ({ value: p.id, label: p.name })),
];

const CEO_OPTIONS = [
  { value: "ALL", label: "All businesses" },
  ...MOCK_CEOS.map((c) => ({ value: c.id, label: c.businessName })),
];

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All types" },
  { value: "PARTNER_CAPITAL_RECEIVED", label: "Capital received" },
  { value: "CEO_CAPITAL_PROVIDED", label: "Capital provided" },
  { value: "CEO_PRINCIPAL_RECEIVED", label: "Principal received" },
  { value: "CEO_PROFIT_RECEIVED", label: "Profit received" },
  { value: "PARTNER_PRINCIPAL_PAID", label: "Principal paid" },
  { value: "PARTNER_PROFIT_PAID", label: "Profit paid" },
];

const DIRECTION_OPTIONS = [
  { value: "", label: "All directions" },
  { value: "IN", label: "Inflow (IN)" },
  { value: "OUT", label: "Outflow (OUT)" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPartyName(txn: LedgerTransaction): string {
  if (txn.partnerId) {
    return MOCK_PARTNERS.find((p) => p.id === txn.partnerId)?.name ?? txn.partnerId;
  }
  if (txn.ceoId) {
    return MOCK_CEOS.find((c) => c.id === txn.ceoId)?.businessName ?? txn.ceoId;
  }
  return "—";
}

function getPartyPath(txn: LedgerTransaction): string | null {
  if (txn.partnerId) return `/partners/${txn.partnerId}`;
  if (txn.ceoId) return `/businesses/${txn.ceoId}`;
  return null;
}

function getAgreementCode(agreementId: string | null): string {
  if (!agreementId) return "—";
  return MOCK_AGREEMENTS.find((a) => a.id === agreementId)?.agreementCode ?? agreementId;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function TransactionRow({
  txn,
  index,
}: {
  txn: LedgerTransaction;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const partyName = getPartyName(txn);
  const partyPath = getPartyPath(txn);
  const isIn = txn.direction === "IN";

  return (
    <motion.tr
      className="table-row"
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.14 }}
    >
      <td className="table-cell">
        <div className="ledger-code-cell">
          <ArrowLeftRight
            size={14}
            className={isIn ? "ledger-code-cell__icon--in" : "ledger-code-cell__icon--out"}
            aria-hidden="true"
          />
          <code>{txn.transactionCode}</code>
        </div>
      </td>
      <td className="table-cell table-cell--secondary">
        {formatDate(txn.transactionDate)}
      </td>
      <td className="table-cell">
        <TransactionTypeBadge type={txn.transactionType} direction={txn.direction} />
      </td>
      <td className="table-cell">
        {partyPath ? (
          <Link className="entity-link" to={partyPath}>
            {partyName}
          </Link>
        ) : (
          partyName
        )}
      </td>
      <td className="table-cell table-cell--secondary">
        {txn.agreementId ? (
          <Link
            className="entity-link entity-link--muted"
            to={`/agreements/${txn.agreementId}`}
          >
            {getAgreementCode(txn.agreementId)}
          </Link>
        ) : (
          "—"
        )}
      </td>
      <td className="table-cell table-cell--money">
        {txn.principalAmount > 0n ? (
          <MoneyDisplay paise={txn.principalAmount} />
        ) : (
          <span className="txn-zero">—</span>
        )}
      </td>
      <td className="table-cell table-cell--money">
        {txn.profitAmount > 0n ? (
          <MoneyDisplay paise={txn.profitAmount} />
        ) : (
          <span className="txn-zero">—</span>
        )}
      </td>
      <td className="table-cell table-cell--money">
        <MoneyDisplay
          paise={txn.totalAmount}
          prominent
          tone={isIn ? "positive" : "pending"}
        />
      </td>
      <td className="table-cell table-cell--secondary">{txn.paymentMethod}</td>
      <td className="table-cell table-cell--secondary">
        <code>{txn.referenceNumber ?? "—"}</code>
      </td>
    </motion.tr>
  );
}

// ─── Summary strip ─────────────────────────────────────────────────────────────

function LedgerSummary({ transactions }: { transactions: LedgerTransaction[] }) {
  const totalIn = transactions
    .filter((t) => t.direction === "IN")
    .reduce((s, t) => s + t.totalAmount, 0n);
  const totalOut = transactions
    .filter((t) => t.direction === "OUT")
    .reduce((s, t) => s + t.totalAmount, 0n);

  if (transactions.length === 0) return null;

  return (
    <div className="ledger-summary">
      <div className="ledger-summary__item">
        <span>Total inflow</span>
        <MoneyDisplay paise={totalIn} prominent tone="positive" />
      </div>
      <div className="ledger-summary__divider" aria-hidden="true" />
      <div className="ledger-summary__item">
        <span>Total outflow</span>
        <MoneyDisplay paise={totalOut} prominent tone="pending" />
      </div>
      <div className="ledger-summary__divider" aria-hidden="true" />
      <div className="ledger-summary__item">
        <span>Net</span>
        <MoneyDisplay
          paise={totalIn > totalOut ? totalIn - totalOut : totalOut - totalIn}
          prominent
          tone={totalIn >= totalOut ? "positive" : "pending"}
        />
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [partnerId, setPartnerId] = useState("ALL");
  const [ceoId, setCeoId] = useState("ALL");
  const [transactionType, setTransactionType] = useState<TransactionType | "">("");
  const [direction, setDirection] = useState<"IN" | "OUT" | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: transactions, isLoading, total } = useTransactions({
    search,
    partnerId,
    ceoId,
    transactionType,
    direction,
    dateFrom,
    dateTo,
  });

  const hasFilters =
    search ||
    partnerId !== "ALL" ||
    ceoId !== "ALL" ||
    transactionType ||
    direction ||
    dateFrom ||
    dateTo;

  function handleExportCSV() {
    downloadCSV(
      csvFilename("transactions"),
      ["Code", "Date", "Type", "Direction", "Party", "Agreement", "Principal (₹)", "Profit (₹)", "Total (₹)", "Method", "Reference", "Notes"],
      transactions.map((txn) => [
        txn.transactionCode,
        txn.transactionDate,
        txn.transactionType,
        txn.direction,
        getPartyName(txn),
        txn.agreementId ? getAgreementCode(txn.agreementId) : "",
        Number(txn.principalAmount) / 100,
        Number(txn.profitAmount) / 100,
        Number(txn.totalAmount) / 100,
        txn.paymentMethod ?? "",
        txn.referenceNumber ?? "",
        txn.notes ?? "",
      ]),
    );
  }

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Financial ledger"
        title="Transactions"
        description="The authoritative financial record. Principal and profit are always tracked separately. Posted transactions are never deleted."
        actions={
          !isLoading && transactions.length > 0 ? (
            <button className="button button--secondary" type="button" onClick={handleExportCSV}>
              <Download size={15} /> Export CSV
            </button>
          ) : undefined
        }
      />

      <div className="list-page__toolbar">
        <FilterBar
          trailing={
            <div className="filter-trailing-stats">
              <span className="record-count">
                {isLoading ? "—" : `${total} transaction${total !== 1 ? "s" : ""}`}
              </span>
            </div>
          }
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search transactions…"
            label="Search transactions"
          />
          <SelectFilter
            label="Filter by partner"
            value={partnerId}
            options={PARTNER_OPTIONS}
            onChange={setPartnerId}
          />
          <SelectFilter
            label="Filter by business"
            value={ceoId}
            options={CEO_OPTIONS}
            onChange={setCeoId}
          />
          <SelectFilter
            label="Transaction type"
            value={transactionType}
            options={TYPE_OPTIONS}
            onChange={(v) => setTransactionType(v as TransactionType | "")}
          />
          <SelectFilter
            label="Direction"
            value={direction}
            options={DIRECTION_OPTIONS}
            onChange={(v) => setDirection(v as "IN" | "OUT" | "")}
          />
        </FilterBar>
      </div>

      {/* Date range filters */}
      <div className="date-range-bar">
        <label className="date-range-label" htmlFor="date-from">From</label>
        <input
          className="date-input"
          id="date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <label className="date-range-label" htmlFor="date-to">To</label>
        <input
          className="date-input"
          id="date-to"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        {hasFilters ? (
          <button
            className="button button--secondary"
            onClick={() => {
              setSearch("");
              setPartnerId("ALL");
              setCeoId("ALL");
              setTransactionType("");
              setDirection("");
              setDateFrom("");
              setDateTo("");
            }}
            type="button"
          >
            <CircleDashed size={14} aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
      </div>

      {!isLoading && transactions.length > 0 ? (
        <LedgerSummary transactions={transactions} />
      ) : null}

      <div className="table-wrapper">
        <table className="data-table" aria-label="Transaction ledger">
          <thead>
            <tr>
              <th className="table-th">Code</th>
              <th className="table-th">Date</th>
              <th className="table-th">Type</th>
              <th className="table-th">Party</th>
              <th className="table-th">Agreement</th>
              <th className="table-th table-th--money">Principal</th>
              <th className="table-th table-th--money">Profit</th>
              <th className="table-th table-th--money">Total</th>
              <th className="table-th">Method</th>
              <th className="table-th">Reference</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows columns={10} rows={6} />
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className="table-empty">
                    <span className="empty-state__icon" aria-hidden="true">
                      <ArrowLeftRight size={24} />
                    </span>
                    <h3>No transactions found</h3>
                    <p>
                      {hasFilters
                        ? "No transactions match the current filters."
                        : "Ledger entries will appear here once financial transactions are recorded."}
                    </p>
                    {hasFilters ? (
                      <button
                        className="button button--primary"
                        onClick={() => {
                          setSearch("");
                          setPartnerId("ALL");
                          setCeoId("ALL");
                          setTransactionType("");
                          setDirection("");
                          setDateFrom("");
                          setDateTo("");
                        }}
                        type="button"
                      >
                        <CircleDashed size={15} aria-hidden="true" />
                        Clear filters
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((txn, i) => (
                <TransactionRow key={txn.id} txn={txn} index={i} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
