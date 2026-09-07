import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  CircleDashed,
  PlusCircle,
  ScrollText,
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
import { useAgreements } from "../mocks/agreementHooks";
import { MOCK_CEOS, MOCK_PARTNERS } from "../mocks/data";
import type { Agreement } from "../types/domain";

// ─── Filter options ────────────────────────────────────────────────────────────

const PARTY_TYPE_OPTIONS = [
  { value: "ALL", label: "All parties" },
  { value: "PARTNER", label: "Partners" },
  { value: "CEO", label: "CEOs / Businesses" },
];

const PROFIT_TYPE_OPTIONS = [
  { value: "ALL", label: "All profit types" },
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FIXED", label: "Fixed" },
  { value: "CUSTOM", label: "Custom" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "DRAFT", label: "Draft" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPartyName(agreement: Agreement): string {
  if (agreement.partyType === "PARTNER" && agreement.partnerId) {
    return MOCK_PARTNERS.find((p) => p.id === agreement.partnerId)?.name ?? agreement.partnerId;
  }
  if (agreement.partyType === "CEO" && agreement.ceoId) {
    const ceo = MOCK_CEOS.find((c) => c.id === agreement.ceoId);
    return ceo ? `${ceo.businessName}` : agreement.ceoId;
  }
  return "—";
}

function profitRateSummary(agreement: Agreement): string {
  if (agreement.profitCalculationType === "PERCENTAGE" && agreement.profitRate) {
    return `${parseFloat(agreement.profitRate).toFixed(1)}% p.a.`;
  }
  if (agreement.profitCalculationType === "FIXED" && agreement.fixedProfitAmount) {
    return `Fixed / ${agreement.profitFrequency.toLowerCase()}`;
  }
  if (agreement.profitCalculationType === "CUSTOM") {
    return "Custom terms";
  }
  return "—";
}

// ─── Row component ─────────────────────────────────────────────────────────────

function AgreementRow({
  agreement,
  index,
}: {
  agreement: Agreement;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const partyName = getPartyName(agreement);

  return (
    <motion.tr
      className="table-row"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.15 }}
    >
      <td className="table-cell">
        <Link className="table-name-link" to={`/agreements/${agreement.id}`}>
          <span
            className={`table-name-link__avatar${agreement.partyType === "CEO" ? " table-name-link__avatar--business" : ""}`}
          >
            {agreement.agreementCode.slice(-1)}
          </span>
          <span>
            <strong>{agreement.agreementCode}</strong>
            <small>{partyName}</small>
          </span>
        </Link>
      </td>
      <td className="table-cell">
        <span className={`party-type-chip party-type-chip--${agreement.partyType.toLowerCase()}`}>
          {agreement.partyType === "PARTNER" ? "Partner" : "CEO / Business"}
        </span>
      </td>
      <td className="table-cell table-cell--money">
        <MoneyDisplay paise={agreement.capitalAmount} compact />
      </td>
      <td className="table-cell">
        <span className="profit-type-chip">
          {agreement.profitCalculationType}
        </span>
        <span className="profit-rate-detail">
          {profitRateSummary(agreement)}
        </span>
      </td>
      <td className="table-cell table-cell--secondary">
        {agreement.profitFrequency.toLowerCase().replace(/_/g, " ")}
      </td>
      <td className="table-cell table-cell--secondary">
        {formatDate(agreement.startDate)}
      </td>
      <td className="table-cell table-cell--secondary">
        {agreement.endDate ? formatDate(agreement.endDate) : "Open-ended"}
      </td>
      <td className="table-cell">
        <StatusBadge status={agreement.status} />
      </td>
      <td className="table-cell table-cell--action">
        <Link
          aria-label={`View ${agreement.agreementCode}`}
          className="icon-button"
          to={`/agreements/${agreement.id}`}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </Link>
      </td>
    </motion.tr>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function AgreementsPage() {
  const [search, setSearch] = useState("");
  const [partyType, setPartyType] = useState("ALL");
  const [profitType, setProfitType] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const { data: agreements, isLoading, total } = useAgreements({
    search,
    partyType,
    profitCalculationType: profitType,
    status,
  });

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Financial terms"
        title="Agreements"
        description="Manage partner and CEO agreements, profit structures, and repayment terms."
        actions={
          <button className="button button--primary" type="button">
            <PlusCircle size={16} aria-hidden="true" />
            New Agreement
          </button>
        }
      />

      <div className="list-page__toolbar">
        <FilterBar
          trailing={
            <span className="record-count">
              {isLoading ? "—" : `${total} agreement${total !== 1 ? "s" : ""}`}
            </span>
          }
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search agreements…"
            label="Search agreements"
          />
          <SelectFilter
            label="Party type"
            value={partyType}
            options={PARTY_TYPE_OPTIONS}
            onChange={setPartyType}
          />
          <SelectFilter
            label="Profit type"
            value={profitType}
            options={PROFIT_TYPE_OPTIONS}
            onChange={setProfitType}
          />
          <SelectFilter
            label="Status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
        </FilterBar>
      </div>

      <div className="table-wrapper">
        <table className="data-table" aria-label="Agreements">
          <thead>
            <tr>
              <th className="table-th">Agreement</th>
              <th className="table-th">Party type</th>
              <th className="table-th table-th--money">Capital</th>
              <th className="table-th">Profit type</th>
              <th className="table-th">Frequency</th>
              <th className="table-th">Start</th>
              <th className="table-th">End</th>
              <th className="table-th">Status</th>
              <th className="table-th table-th--action">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows columns={9} rows={5} />
            ) : agreements.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="table-empty">
                    <span className="empty-state__icon" aria-hidden="true">
                      <ScrollText size={24} />
                    </span>
                    <h3>No agreements found</h3>
                    <p>
                      {search || partyType !== "ALL" || profitType !== "ALL" || status !== "ALL"
                        ? "No agreements match the current filters."
                        : "Create an agreement to define capital and profit terms."}
                    </p>
                    {(search || partyType !== "ALL" || profitType !== "ALL" || status !== "ALL") ? (
                      <button
                        className="button button--primary"
                        onClick={() => {
                          setSearch("");
                          setPartyType("ALL");
                          setProfitType("ALL");
                          setStatus("ALL");
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
              agreements.map((agreement, i) => (
                <AgreementRow
                  key={agreement.id}
                  agreement={agreement}
                  index={i}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
