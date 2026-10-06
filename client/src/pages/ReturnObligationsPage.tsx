import { RecordRow } from "../components/RecordRow";
import { OptionalDateInput } from "../components/OptionalDateInput";
/**
 * Return Obligations — all active allocations that have a return date set,
 * sorted by return date ascending.
 */

import { CalendarClock, ChevronLeft, ChevronRight, CreditCard as CreditCardIcon, Download, Edit2, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { formatDate } from "../lib/format";
import { downloadCSV, csvFilename } from "../lib/csv";
import { updateAllocationReturnDate } from "../store";
import { useStore } from "../useStore";
import { useRole } from "../context/RoleContext";

const PAGE_SIZE = 25;

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

function EditReturnDateModal({ allocationId, currentReturnDate, onClose }: { allocationId: string; currentReturnDate: string | null; onClose: () => void }) {
  const [value, setValue] = useState(currentReturnDate ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      await updateAllocationReturnDate(allocationId, value || null);
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save return date."); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ro-edit-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="ro-edit-title">Edit Return Date</h2>
          <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="ro-date" className="form-label">Return date <span className="form-label__optional">(leave blank to remove)</span></label>
            <OptionalDateInput id="ro-date" className="form-input" value={value} onValueChange={setValue} disabled={saving} autoFocus />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={saving}><CalendarClock size={16} /> Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Pagination({
  page, totalPages, totalItems, pageSize, onPageChange,
}: {
  page: number; totalPages: number; totalItems: number; pageSize: number; onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div className="pagination">
      <span className="pagination__info">Showing {start}–{end} of {totalItems}</span>
      <div className="pagination__controls">
        <button className="pagination__btn" type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <span className="pagination__pages">Page {page} of {totalPages}</span>
        <button className="pagination__btn" type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function ReturnObligationsPage() {
  const { allocationSummaries, partners } = useStore();
  const { isCFO } = useRole();
  const [editId, setEditId] = useState<string | null>(null);
  const [filterPartnerId, setFilterPartnerId] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);

  const today = new Date().toISOString().slice(0, 10);

  const matchesSearch = (a: typeof allocationSummaries[number]) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (a.partner?.name || "").toLowerCase().includes(q) ||
      (a.creditCard?.cardName ?? "Cash").toLowerCase().includes(q) ||
      String(a.amountRupees).includes(q) ||
      `${a.profitPercent}`.includes(q) ||
      (a.returnDate || "").includes(q)
    );
  };

  // Allocations with return dates set, not fully returned, sorted by return date asc
  const withReturnDate = useMemo(() => allocationSummaries
    .filter((a) => !a.isFullyReturned && a.returnDate !== null)
    .filter((a) => filterPartnerId === "ALL" || a.partnerId === filterPartnerId)
    .filter(matchesSearch)
    .sort((a, b) => a.returnDate!.localeCompare(b.returnDate!)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allocationSummaries, filterPartnerId, searchQuery]);

  // Allocations without return dates (for "no date set" section)
  const withoutReturnDate = useMemo(() => allocationSummaries
    .filter((a) => !a.isFullyReturned && a.returnDate === null)
    .filter((a) => filterPartnerId === "ALL" || a.partnerId === filterPartnerId)
    .filter(matchesSearch),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allocationSummaries, filterPartnerId, searchQuery]);

  const totalOutstanding = allocationSummaries
    .filter((a) => !a.isFullyReturned)
    .filter((a) => filterPartnerId === "ALL" || a.partnerId === filterPartnerId)
    .reduce((s, a) => s + a.capitalOutstanding, 0);

  const overdueCount = withReturnDate.filter((a) => a.returnDate! < today).length;

  const editingAlloc = editId ? allocationSummaries.find((a) => a.id === editId) : null;

  // Pagination for "with return date" section
  const totalPages = Math.max(1, Math.ceil(withReturnDate.length / PAGE_SIZE));
  const paginated = withReturnDate.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [filterPartnerId, searchQuery]);

  function handleExportCSV() {
    downloadCSV(
      csvFilename("return-obligations"),
      ["Partner", "Source", "Capital (₹)", "Returned (₹)", "Outstanding (₹)", "Return Date", "Status", "Rate"],
      withReturnDate.map((a) => [
        a.partner?.name ?? a.partnerId,
        a.creditCard?.cardName ?? "Cash",
        a.amountRupees,
        a.totalCapitalReturned,
        a.capitalOutstanding,
        a.returnDate ?? "",
        a.returnDate! < today ? "Overdue" : "Upcoming",
        `${a.profitPercent}% p.m.`,
      ]),
    );
  }

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Capital obligations"
        title="Return Obligations"
        description="Capital that needs to be returned to partners, sorted by return date. Overdue items appear first."
        actions={
          withReturnDate.length > 0 ? (
            <button className="button button--secondary" type="button" onClick={handleExportCSV}>
              <Download size={15} /> Export CSV
            </button>
          ) : undefined
        }
      />

      {editingAlloc && (
        <EditReturnDateModal allocationId={editingAlloc.id} currentReturnDate={editingAlloc.returnDate} onClose={() => setEditId(null)} />
      )}

      {overdueCount > 0 && (
        <div className="schedule-alert">
          <CalendarClock size={17} />
          <span><strong>{overdueCount} allocation{overdueCount !== 1 ? "s" : ""}</strong> past their return date.</span>
        </div>
      )}

      {/* No-date warning banner — shown always, not dependent on filters */}
      {(() => {
        const totalNoDate = allocationSummaries.filter((a) => !a.isFullyReturned && a.returnDate === null).length;
        return totalNoDate > 0 ? (
          <div className="no-date-warning">
            <CalendarClock size={16} />
            <span>
              <strong>{totalNoDate} allocation{totalNoDate !== 1 ? "s" : ""}</strong> have no return date set —{" "}
              <a onClick={() => setShowAll(true)} href="#no-date-section" style={{ cursor: "pointer" }}>
                Set dates →
              </a>
            </span>
          </div>
        ) : null;
      })()}

      <div className="list-page__toolbar">
        <div className="filter-bar">
          <div className="filter-bar__controls" style={{ flexWrap: "wrap" }}>
            {/* Global search */}
            <div className="search-input" style={{ minWidth: 180, flex: "1 1 180px" }}>
              <Search size={15} className="search-input__icon" />
              <input
                className="search-input__field"
                type="search"
                placeholder="Search partner, source, amount, date…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-input__clear" type="button" onClick={() => setSearchQuery("")} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>
            <select className="select-filter__control" value={filterPartnerId} onChange={(e) => setFilterPartnerId(e.target.value)}>
              <option value="ALL">All partners</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="filter-bar__trailing">
            <span className="record-count">Total outstanding: <strong>{fmt(totalOutstanding)}</strong></span>
          </div>
        </div>
      </div>

      {/* Allocations with return dates */}
      <section aria-labelledby="with-date-title">
        <h2 id="with-date-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
          With return dates ({withReturnDate.length})
        </h2>
        <div className="table-wrapper" style={{ marginBottom: 8 }}>
          <table className="data-table" aria-label="Return obligations">
            <thead>
              <tr>
                <th className="table-th">Partner</th>
                <th className="table-th">Source</th>
                <th className="table-th table-th--money">Capital</th>
                <th className="table-th table-th--money">Returned so far</th>
                <th className="table-th table-th--money">Outstanding</th>
                <th className="table-th">Return date</th>
                <th className="table-th">Rate</th>
                <th className="table-th table-th--action"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {withReturnDate.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="table-empty" style={{ minHeight: 140 }}>
                      <span className="empty-state__icon"><CalendarClock size={22} /></span>
                      <h3>No return dates set</h3>
                      <p>Set a return date on an allocation to track it here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((a) => {
                  const isOverdue = a.returnDate! < today;
                  return (
                    <RecordRow className="table-row" key={a.id}>
                      <td className="table-cell" data-label="Partner">
                        <Link className="entity-link" to={`/partners/${a.partnerId}`}>
                          {a.partner?.name ?? a.partnerId}
                        </Link>
                      </td>
                      <td className="table-cell" data-label="Source">
                        {a.creditCard ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                            <CreditCardIcon size={13} />
                            {a.creditCard.cardName}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>Cash</span>
                        )}
                      </td>
                      <td className="table-cell table-cell--money" data-label="Capital"><strong>{fmt(a.amountRupees)}</strong></td>
                      <td className="table-cell table-cell--money" data-label="Returned" style={{ color: "var(--incoming)" }}>{fmt(a.totalCapitalReturned)}</td>
                      <td className="table-cell table-cell--money" data-label="Outstanding" style={{ color: "var(--pending)", fontWeight: 700 }}>{fmt(a.capitalOutstanding)}</td>
                      <td className="table-cell" data-label="Return date">
                        <span style={{ color: isOverdue ? "var(--outgoing)" : "var(--pending)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CalendarClock size={13} />{formatDate(a.returnDate!)}
                          {isOverdue && <span className="status-badge status-badge--overdue" style={{ marginLeft: 6 }}>Overdue</span>}
                        </span>
                      </td>
                      <td className="table-cell" data-label="Rate">
                        <span className="party-type-chip party-type-chip--partner">{a.profitPercent}% p.m.</span>
                      </td>
                      <td className="table-cell table-cell--action">
                        {isCFO && (
                          <button className="icon-button" type="button" title="Edit return date" aria-label="Edit date" onClick={() => setEditId(a.id)}>
                            <Edit2 size={15} />
                          <span className="mobile-action-label">Edit date</span></button>
                        )}
                      </td>
                    </RecordRow>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={withReturnDate.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </section>

      {/* Allocations without return dates */}
      {withoutReturnDate.length > 0 && (
        <section aria-labelledby="no-date-title" style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <h2 id="no-date-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
              No return date set ({withoutReturnDate.length})
            </h2>
            <button className="button button--secondary" style={{ fontSize: 11, minHeight: 28, padding: "3px 10px" }} type="button" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Hide" : "Show"}
            </button>
          </div>
          {showAll && (
            <div className="table-wrapper">
              <table className="data-table" aria-label="Allocations without return date">
                <thead>
                  <tr>
                    <th className="table-th">Partner</th>
                    <th className="table-th">Source</th>
                    <th className="table-th table-th--money">Capital</th>
                    <th className="table-th table-th--money">Outstanding</th>
                    <th className="table-th">Rate</th>
                    <th className="table-th">Since</th>
                    <th className="table-th table-th--action"><span className="sr-only">Edit</span></th>
                  </tr>
                </thead>
                <tbody>
                  {withoutReturnDate.map((a) => (
                    <RecordRow className="table-row" key={a.id}>
                      <td className="table-cell" data-label="Partner">
                        <Link className="entity-link" to={`/partners/${a.partnerId}`}>{a.partner?.name ?? a.partnerId}</Link>
                      </td>
                      <td className="table-cell" data-label="Source">
                        {a.creditCard ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                            <CreditCardIcon size={13} />
                            {a.creditCard.cardName}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>Cash</span>
                        )}
                      </td>
                      <td className="table-cell table-cell--money" data-label="Capital"><strong>{fmt(a.amountRupees)}</strong></td>
                      <td className="table-cell table-cell--money" style={{ color: "var(--pending)" }} data-label="Outstanding">{fmt(a.capitalOutstanding)}</td>
                      <td className="table-cell" data-label="Rate"><span className="party-type-chip party-type-chip--partner">{a.profitPercent}% p.m.</span></td>
                      <td className="table-cell table-cell--secondary" data-label="Since">{formatDate(a.receivedDate)}</td>
                      <td className="table-cell table-cell--action">
                        {isCFO && (
                          <button className="icon-button" type="button" title="Set return date" aria-label="Set date" onClick={() => setEditId(a.id)}>
                            <CalendarClock size={15} />
                          <span className="mobile-action-label">Set date</span></button>
                        )}
                      </td>
                    </RecordRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
