import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  CircleDashed,
  PlusCircle,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { FilterBar, SelectFilter } from "../components/FilterBar";
import { LoadingRows } from "../components/LoadingRows";
import { MoneyDisplay } from "../components/MoneyDisplay";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../lib/format";
import { useInvestments } from "../mocks/contributionHooks";
import { MOCK_AGREEMENTS, MOCK_CEOS } from "../mocks/data";
import type { CEOInvestment } from "../types/domain";

// ─── Filter options ────────────────────────────────────────────────────────────

const CEO_OPTIONS = [
  { value: "ALL", label: "All businesses" },
  ...MOCK_CEOS.map((c) => ({ value: c.id, label: c.businessName })),
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PARTIALLY_REPAID", label: "Partially repaid" },
  { value: "FULLY_REPAID", label: "Fully repaid" },
  { value: "WRITTEN_OFF", label: "Written off" },
];

const METHOD_OPTIONS = [
  { value: "ALL", label: "All methods" },
  { value: "RTGS", label: "RTGS" },
  { value: "NEFT", label: "NEFT" },
  { value: "UPI", label: "UPI" },
  { value: "CHEQUE", label: "Cheque" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCEOBusinessName(ceoId: string): { business: string; name: string } {
  const ceo = MOCK_CEOS.find((c) => c.id === ceoId);
  return { business: ceo?.businessName ?? ceoId, name: ceo?.ceoName ?? "" };
}

function getAgreementCode(agreementId: string): string {
  return MOCK_AGREEMENTS.find((a) => a.id === agreementId)?.agreementCode ?? agreementId;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function InvestmentRow({
  investment,
  index,
}: {
  investment: CEOInvestment;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const { business, name } = getCEOBusinessName(investment.ceoId);

  return (
    <motion.tr
      className="table-row"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.15 }}
    >
      <td className="table-cell">
        <div className="ledger-code-cell">
          <TrendingUp size={16} className="ledger-code-cell__icon" aria-hidden="true" />
          <code>{investment.investmentCode}</code>
        </div>
      </td>
      <td className="table-cell">
        <Link className="table-name-link" to={`/businesses/${investment.ceoId}`}>
          <span className="table-name-link__avatar table-name-link__avatar--business" aria-hidden="true">
            {business.charAt(0).toUpperCase()}
          </span>
          <span>
            <strong>{business}</strong>
            <small>{name}</small>
          </span>
        </Link>
      </td>
      <td className="table-cell table-cell--secondary">
        <Link
          className="entity-link entity-link--muted"
          to={`/agreements/${investment.agreementId}`}
        >
          {getAgreementCode(investment.agreementId)}
        </Link>
      </td>
      <td className="table-cell table-cell--secondary">
        {formatDate(investment.investmentDate)}
      </td>
      <td className="table-cell table-cell--money">
        <MoneyDisplay paise={investment.principalAmount} tone="pending" prominent />
      </td>
      <td className="table-cell table-cell--secondary" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {investment.purpose}
      </td>
      <td className="table-cell table-cell--secondary">{investment.paymentMethod}</td>
      <td className="table-cell">
        <StatusBadge status={investment.status} />
      </td>
      <td className="table-cell table-cell--action">
        <Link
          aria-label={`View ${investment.investmentCode}`}
          className="icon-button"
          to={`/ceo-investments/${investment.id}`}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </Link>
      </td>
    </motion.tr>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function CEOInvestmentsPage() {
  const [search, setSearch] = useState("");
  const [ceoId, setCeoId] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [paymentMethod, setPaymentMethod] = useState("ALL");

  const { data: investments, isLoading, total } = useInvestments({
    search,
    ceoId,
    status,
    paymentMethod,
  });

  const totalDeployed = investments.reduce((sum, inv) => sum + inv.principalAmount, 0n);

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Capital deployment"
        title="CEO Investments"
        description="Track capital deployed to CEO and business partners. Each investment is linked to its ledger transaction."
        actions={
          <button className="button button--primary" type="button">
            <PlusCircle size={16} aria-hidden="true" />
            Record Investment
          </button>
        }
      />

      <div className="list-page__toolbar">
        <FilterBar
          trailing={
            <div className="filter-trailing-stats">
              <span className="record-count">
                {isLoading ? "—" : `${total} record${total !== 1 ? "s" : ""}`}
              </span>
              {!isLoading && total > 0 ? (
                <span className="filter-total-amount">
                  Total deployed: <MoneyDisplay paise={totalDeployed} prominent tone="pending" />
                </span>
              ) : null}
            </div>
          }
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search investments…"
            label="Search investments"
          />
          <SelectFilter
            label="Filter by business"
            value={ceoId}
            options={CEO_OPTIONS}
            onChange={setCeoId}
          />
          <SelectFilter
            label="Filter by status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
          <SelectFilter
            label="Filter by method"
            value={paymentMethod}
            options={METHOD_OPTIONS}
            onChange={setPaymentMethod}
          />
        </FilterBar>
      </div>

      <div className="table-wrapper">
        <table className="data-table" aria-label="CEO investments">
          <thead>
            <tr>
              <th className="table-th">Code</th>
              <th className="table-th">Business / CEO</th>
              <th className="table-th">Agreement</th>
              <th className="table-th">Date</th>
              <th className="table-th table-th--money">Principal</th>
              <th className="table-th">Purpose</th>
              <th className="table-th">Method</th>
              <th className="table-th">Status</th>
              <th className="table-th table-th--action">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows columns={9} rows={5} />
            ) : investments.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="table-empty">
                    <span className="empty-state__icon" aria-hidden="true">
                      <TrendingUp size={24} />
                    </span>
                    <h3>No investments found</h3>
                    <p>
                      {search || ceoId !== "ALL" || status !== "ALL" || paymentMethod !== "ALL"
                        ? "No investments match the current filters."
                        : "Record a CEO investment to begin tracking capital deployment."}
                    </p>
                    {(search || ceoId !== "ALL" || status !== "ALL" || paymentMethod !== "ALL") ? (
                      <button
                        className="button button--primary"
                        onClick={() => {
                          setSearch("");
                          setCeoId("ALL");
                          setStatus("ALL");
                          setPaymentMethod("ALL");
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
              investments.map((inv, i) => (
                <InvestmentRow key={inv.id} investment={inv} index={i} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
