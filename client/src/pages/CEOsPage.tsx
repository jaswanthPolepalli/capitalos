import { motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  ChevronRight,
  CircleDashed,
  UserPlus,
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
import { useCEOs, useCEOSummary } from "../mocks/hooks";
import type { CEO } from "../types/domain";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
];

function CEORowSummary({ ceoId }: { ceoId: string }) {
  const { data: summary } = useCEOSummary(ceoId);

  if (!summary) {
    return (
      <>
        <td className="table-cell table-cell--money">—</td>
        <td className="table-cell table-cell--money">—</td>
        <td className="table-cell table-cell--money">—</td>
      </>
    );
  }

  return (
    <>
      <td className="table-cell table-cell--money">
        <MoneyDisplay paise={summary.totalCapitalProvided} compact />
      </td>
      <td className="table-cell table-cell--money">
        <MoneyDisplay
          paise={summary.principalOutstanding}
          tone={summary.principalOutstanding > 0n ? "pending" : "neutral"}
          compact
        />
      </td>
      <td className="table-cell table-cell--money">
        <MoneyDisplay
          paise={summary.totalOutstanding}
          tone={summary.totalOutstanding > 0n ? "pending" : "positive"}
          compact
        />
      </td>
    </>
  );
}

function CEORow({ ceo, index }: { ceo: CEO; index: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.tr
      className="table-row"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.15 }}
    >
      <td className="table-cell">
        <Link className="table-name-link" to={`/businesses/${ceo.id}`}>
          <span className="table-name-link__avatar table-name-link__avatar--business">
            {ceo.businessName.charAt(0).toUpperCase()}
          </span>
          <span>
            <strong>{ceo.businessName}</strong>
            <small>
              {ceo.ceoName} · {ceo.ceoCode}
            </small>
          </span>
        </Link>
      </td>
      <td className="table-cell table-cell--secondary">{ceo.email ?? "—"}</td>
      <td className="table-cell table-cell--secondary">{ceo.phone ?? "—"}</td>
      <CEORowSummary ceoId={ceo.id} />
      <td className="table-cell">
        <StatusBadge status={ceo.status} />
      </td>
      <td className="table-cell table-cell--secondary">
        {formatDate(ceo.updatedAt)}
      </td>
      <td className="table-cell table-cell--action">
        <Link
          aria-label={`View ${ceo.businessName}`}
          className="icon-button"
          to={`/businesses/${ceo.id}`}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </Link>
      </td>
    </motion.tr>
  );
}

export function CEOsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const { data: ceos, isLoading, total } = useCEOs({ search, status });

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Capital deployment"
        title="CEOs / Businesses"
        description="Manage businesses receiving capital, view investments, and track outstanding repayments."
        actions={
          <button className="button button--primary" type="button">
            <UserPlus size={16} aria-hidden="true" />
            Add CEO / Business
          </button>
        }
      />

      <div className="list-page__toolbar">
        <FilterBar
          trailing={
            <span className="record-count">
              {isLoading ? "—" : `${total} record${total !== 1 ? "s" : ""}`}
            </span>
          }
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search businesses…"
            label="Search CEOs and businesses"
          />
          <SelectFilter
            label="Filter by status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
        </FilterBar>
      </div>

      <div className="table-wrapper">
        <table className="data-table" aria-label="CEOs and businesses">
          <thead>
            <tr>
              <th className="table-th">Business / CEO</th>
              <th className="table-th">Email</th>
              <th className="table-th">Phone</th>
              <th className="table-th table-th--money">Capital Provided</th>
              <th className="table-th table-th--money">Principal Outstanding</th>
              <th className="table-th table-th--money">Total Outstanding</th>
              <th className="table-th">Status</th>
              <th className="table-th">Updated</th>
              <th className="table-th table-th--action">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows columns={9} rows={5} />
            ) : ceos.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="table-empty">
                    <span className="empty-state__icon" aria-hidden="true">
                      <Building2 size={24} />
                    </span>
                    <h3>No businesses found</h3>
                    <p>
                      {search || status !== "ALL"
                        ? "No businesses match the current filters."
                        : "Add your first CEO or business to begin tracking capital deployment."}
                    </p>
                    {search || status !== "ALL" ? (
                      <button
                        className="button button--primary"
                        onClick={() => {
                          setSearch("");
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
              ceos.map((ceo, i) => (
                <CEORow key={ceo.id} ceo={ceo} index={i} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
