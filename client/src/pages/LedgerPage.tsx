/**
 * Ledger — audit log of all financial events.
 * Filters: partner, event type, date range.
 * Supports edit, soft-delete with confirmation, and 5-second undo toast.
 * Shows entries newest-first with date + time display.
 */

import { ArrowDownLeft, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Pencil, Search, Trash2, TrendingDown, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { formatDate } from "../lib/format";
import type { LedgerEvent, LedgerEventType } from "../store";
import {
  deleteAllocation, deleteCapitalReturn, deleteProfitRecord,
  restoreAllocation, restoreCapitalReturn, restoreProfitRecord,
  updateAllocation, updateCapitalReturn, updateProfitRecord,
} from "../store";
import { useStore } from "../useStore";

const PAGE_SIZE = 25;

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

/** Format a ledger event's date — shows date only (time is implicit via ordering) */
function formatLedgerDate(event: LedgerEvent): string {
  return formatDate(event.date);
}

const EVENT_LABELS: Record<LedgerEventType, string> = {
  CAPITAL_RECEIVED: "Capital received",
  CAPITAL_RETURNED: "Capital returned",
  PROFIT_PAID: "Profit paid",
};

const EVENT_TONE: Record<LedgerEventType, string> = {
  CAPITAL_RECEIVED: "var(--incoming)",
  CAPITAL_RETURNED: "var(--accent)",
  PROFIT_PAID: "var(--outgoing)",
};

function EventIcon({ type }: { type: LedgerEventType }) {
  if (type === "CAPITAL_RECEIVED") return <ArrowUpRight size={15} style={{ color: "var(--incoming)" }} />;
  if (type === "CAPITAL_RETURNED") return <ArrowDownLeft size={15} style={{ color: "var(--accent)" }} />;
  return <TrendingDown size={15} style={{ color: "var(--outgoing)" }} />;
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  event,
  onConfirm,
  onClose,
  isDeleting,
}: {
  event: LedgerEvent;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}) {
  const isAllocation = event.eventType === "CAPITAL_RECEIVED";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="del-entry-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="del-entry-title" style={{ color: "var(--outgoing)" }}>
            <Trash2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Delete Entry
          </h2>
          <button className="icon-button" onClick={onClose} type="button" disabled={isDeleting}><X size={18} /></button>
        </div>
        <div className="modal__body">
          <div className="form-hint" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <EventIcon type={event.eventType} />
              <span style={{ fontWeight: 700, color: EVENT_TONE[event.eventType] }}>
                {EVENT_LABELS[event.eventType]}
              </span>
            </div>
            <strong>{fmt(event.amountRupees)}</strong> &nbsp;·&nbsp; {formatDate(event.date)}
            {event.notes && <span style={{ color: "var(--muted)" }}> · {event.notes}</span>}
          </div>

          {isAllocation && (
            <div className="form-hint" style={{ borderLeft: "3px solid var(--outgoing)", paddingLeft: 10, marginBottom: 12 }}>
              ⚠️ <strong>Capital Received entry:</strong> Deleting this will hide the entire allocation and all its associated profit payments from the ledger and dashboards.
            </div>
          )}

          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            This is a <strong>soft delete</strong> — the record is hidden but not permanently removed.
            You can undo this immediately after deletion.
          </p>
        </div>
        <div className="modal__footer">
          <button className="button button--secondary" type="button" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button
            className="button button--danger"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{ minWidth: 120 }}
          >
            {isDeleting ? "Deleting…" : <><Trash2 size={14} /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Entry Modal ─────────────────────────────────────────────────────────

function EditEntryModal({
  event,
  allocationSummaries,
  onClose,
}: {
  event: LedgerEvent;
  allocationSummaries: import("../store").AllocationSummary[];
  onClose: () => void;
}) {
  const [amountStr, setAmountStr] = useState(String(event.amountRupees));
  const [date, setDate] = useState(
    event.eventType === "PROFIT_PAID" ? (event as { paidDate?: string }).paidDate || event.date
      : event.eventType === "CAPITAL_RETURNED" ? (event as { returnedDate?: string }).returnedDate || event.date
      : event.date
  );
  const [notes, setNotes] = useState(event.notes || "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // For CAPITAL_RECEIVED: allow editing the profit percentage
  const alloc = allocationSummaries.find((a) => a.id === event.allocationId);
  const [profitPercentStr, setProfitPercentStr] = useState(
    event.eventType === "CAPITAL_RECEIVED" ? String(alloc?.profitPercent ?? "") : ""
  );

  const dateLabel =
    event.eventType === "PROFIT_PAID" ? "Date paid"
    : event.eventType === "CAPITAL_RETURNED" ? "Date returned"
    : "Date received";

  function validate() {
    const e: Record<string, string> = {};
    const amt = Number(amountStr);
    if (!amountStr || isNaN(amt) || amt <= 0) e.amount = "Enter a valid amount";
    if (!date) e.date = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const amt = Math.round(Number(amountStr));
      if (event.eventType === "PROFIT_PAID") {
        await updateProfitRecord(event.refId, { amountRupees: amt, paidDate: date, notes });
      } else if (event.eventType === "CAPITAL_RETURNED") {
        await updateCapitalReturn(event.refId, { amountRupees: amt, returnedDate: date, notes });
      } else {
        const pct = Number(profitPercentStr);
        await updateAllocation(event.refId, {
          amountRupees: amt,
          receivedDate: date,
          notes,
          ...(profitPercentStr && !isNaN(pct) && pct > 0 ? { profitPercent: pct } : {}),
        });
      }
      onClose();
    } catch (err) {
      console.error("Edit failed:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-entry-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="edit-entry-title">
            <Pencil size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Edit Entry
          </h2>
          <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form className="modal__body" onSubmit={handleSave} noValidate>
          <div className="form-hint" style={{ marginBottom: 12 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <EventIcon type={event.eventType} />
              <span style={{ fontWeight: 700, fontSize: 12, color: EVENT_TONE[event.eventType] }}>
                {EVENT_LABELS[event.eventType]}
              </span>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="edit-amt">Amount (₹) *</label>
              <input
                id="edit-amt"
                className={`form-input ${errors.amount ? "form-input--error" : ""}`}
                type="number"
                min="1"
                value={amountStr}
                onChange={(e) => { setAmountStr(e.target.value); setErrors((p) => ({ ...p, amount: "" })); }}
                autoFocus
              />
              {errors.amount && <span className="form-error">{errors.amount}</span>}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="edit-date">{dateLabel} *</label>
              <input
                id="edit-date"
                className={`form-input ${errors.date ? "form-input--error" : ""}`}
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: "" })); }}
              />
              {errors.date && <span className="form-error">{errors.date}</span>}
            </div>
          </div>
          {event.eventType === "CAPITAL_RECEIVED" && (
            <div className="form-field">
              <label className="form-label" htmlFor="edit-profit-pct">Profit % per month *</label>
              <input
                id="edit-profit-pct"
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                value={profitPercentStr}
                onChange={(e) => setProfitPercentStr(e.target.value)}
                placeholder="e.g. 3.5"
              />
            </div>
          )}
          <div className="form-field">
            <label className="form-label" htmlFor="edit-notes">Notes</label>
            <textarea
              id="edit-notes"
              className="form-input form-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note…"
            />
          </div>
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : <><Pencil size={14} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Undo Toast ───────────────────────────────────────────────────────────────

interface UndoToastEntry {
  id: string;
  label: string;
  eventType: LedgerEventType;
  refId: string;
  timer: ReturnType<typeof setTimeout>;
}

function UndoToast({
  toast,
  onUndo,
  onDismiss,
}: {
  toast: UndoToastEntry;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      background: "var(--surface-elevated, #1e2a23)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "12px 18px",
      display: "flex",
      alignItems: "center",
      gap: 14,
      boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      minWidth: 280,
    }}>
      <Trash2 size={15} style={{ color: "var(--outgoing)", flexShrink: 0 }} />
      <span style={{ fontSize: 13, flex: 1 }}>
        <strong>{EVENT_LABELS[toast.eventType]}</strong> entry deleted
      </span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "5px 12px",
          fontWeight: 700,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="icon-button"
        style={{ marginLeft: -4 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page, totalPages, totalItems, pageSize, onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div className="pagination">
      <span className="pagination__info">Showing {start}–{end} of {totalItems}</span>
      <div className="pagination__controls">
        <button
          className="pagination__btn"
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="pagination__pages">
          Page {page} of {totalPages}
        </span>
        <button
          className="pagination__btn"
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function LedgerPage() {
  const { ledger, partners, allocationSummaries } = useStore();

  const [filterPartnerId, setFilterPartnerId] = useState("ALL");
  const [filterType, setFilterType] = useState<LedgerEventType | "ALL">("ALL");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Modal state
  const [confirmDelete, setConfirmDelete] = useState<LedgerEvent | null>(null);
  const [editEvent, setEditEvent] = useState<LedgerEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Undo toast
  const [undoToast, setUndoToast] = useState<UndoToastEntry | null>(null);
  const undoToastRef = useRef<UndoToastEntry | null>(null);

  // Keep ref in sync so timer callbacks can access latest value
  useEffect(() => { undoToastRef.current = undoToast; }, [undoToast]);

  // Ledger is already sorted newest-first from store (by date desc, then by row ID)
  const filtered = useMemo(() => {
    let result = ledger;
    if (filterPartnerId !== "ALL") result = result.filter((e) => e.partnerId === filterPartnerId);
    if (filterType !== "ALL") result = result.filter((e) => e.eventType === filterType);
    if (filterFrom) result = result.filter((e) => e.date >= filterFrom);
    if (filterTo) result = result.filter((e) => e.date <= filterTo);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((e) => {
        const partner = partners.find((p) => p.id === e.partnerId);
        const alloc = allocationSummaries.find((a) => a.id === e.allocationId);
        return (
          (partner?.name || "").toLowerCase().includes(q) ||
          (e.notes || "").toLowerCase().includes(q) ||
          String(e.amountRupees).includes(q) ||
          EVENT_LABELS[e.eventType].toLowerCase().includes(q) ||
          (alloc ? `${alloc.amountRupees}` : "").includes(q)
        );
      });
    }
    return result;
  }, [ledger, filterPartnerId, filterType, filterFrom, filterTo, searchQuery, partners, allocationSummaries]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterPartnerId, filterType, filterFrom, filterTo, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summaries (of ALL filtered, not just current page)
  const totalIn = filtered.filter((e) => e.eventType === "CAPITAL_RECEIVED").reduce((s, e) => s + e.amountRupees, 0);
  const totalReturned = filtered.filter((e) => e.eventType === "CAPITAL_RETURNED").reduce((s, e) => s + e.amountRupees, 0);
  const totalProfit = filtered.filter((e) => e.eventType === "PROFIT_PAID").reduce((s, e) => s + e.amountRupees, 0);

  function dismissToast() {
    if (undoToastRef.current) clearTimeout(undoToastRef.current.timer);
    setUndoToast(null);
  }

  async function handleDelete(event: LedgerEvent) {
    setIsDeleting(true);
    try {
      if (event.eventType === "PROFIT_PAID") await deleteProfitRecord(event.refId);
      else if (event.eventType === "CAPITAL_RETURNED") await deleteCapitalReturn(event.refId);
      else await deleteAllocation(event.refId);

      setConfirmDelete(null);

      // Dismiss any previous toast
      if (undoToastRef.current) clearTimeout(undoToastRef.current.timer);

      const timer = setTimeout(() => setUndoToast(null), 5000);
      const toast: UndoToastEntry = {
        id: event.id,
        label: EVENT_LABELS[event.eventType],
        eventType: event.eventType,
        refId: event.refId,
        timer,
      };
      setUndoToast(toast);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleUndo() {
    if (!undoToastRef.current) return;
    const toast = undoToastRef.current;
    clearTimeout(toast.timer);
    setUndoToast(null);
    try {
      if (toast.eventType === "PROFIT_PAID") await restoreProfitRecord(toast.refId);
      else if (toast.eventType === "CAPITAL_RETURNED") await restoreCapitalReturn(toast.refId);
      else await restoreAllocation(toast.refId);
    } catch (err) {
      console.error("Undo failed:", err);
    }
  }

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Audit trail"
        title="Ledger"
        description="Complete record of all financial events — capital received, returned, and profit paid."
      />

      {/* Confirm delete modal */}
      {confirmDelete && (
        <ConfirmDeleteModal
          event={confirmDelete}
          onConfirm={() => handleDelete(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Edit modal */}
      {editEvent && (
        <EditEntryModal
          event={editEvent}
          allocationSummaries={allocationSummaries}
          onClose={() => setEditEvent(null)}
        />
      )}

      {/* Undo toast */}
      {undoToast && (
        <UndoToast
          toast={undoToast}
          onUndo={handleUndo}
          onDismiss={dismissToast}
        />
      )}

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="ledger-summary" style={{ marginBottom: 12 }}>
          <div className="ledger-summary__item">
            <span>Capital received</span>
            <strong style={{ fontSize: 16, color: "var(--incoming)" }}>{fmt(totalIn)}</strong>
          </div>
          <div className="ledger-summary__divider" />
          <div className="ledger-summary__item">
            <span>Capital returned</span>
            <strong style={{ fontSize: 16, color: "var(--accent)" }}>{fmt(totalReturned)}</strong>
          </div>
          <div className="ledger-summary__divider" />
          <div className="ledger-summary__item">
            <span>Profit paid</span>
            <strong style={{ fontSize: 16, color: "var(--outgoing)" }}>{fmt(totalProfit)}</strong>
          </div>
          <div className="ledger-summary__divider" />
          <div className="ledger-summary__item">
            <span>Entries</span>
            <strong style={{ fontSize: 16 }}>{filtered.length}</strong>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="list-page__toolbar">
        <div className="filter-bar ledger-filter-bar">
          <div className="filter-bar__controls">
            {/* Global search */}
            <div className="search-input ledger-filter-bar__search">
              <Search size={15} className="search-input__icon" />
              <input
                className="search-input__field"
                type="search"
                placeholder="Search notes, partner, amount…"
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
            <select className="select-filter__control" value={filterType} onChange={(e) => setFilterType(e.target.value as LedgerEventType | "ALL")}>
              <option value="ALL">All event types</option>
              <option value="CAPITAL_RECEIVED">Capital received</option>
              <option value="CAPITAL_RETURNED">Capital returned</option>
              <option value="PROFIT_PAID">Profit paid</option>
            </select>
            <div className="ledger-date-range">
              <span className="date-range-label">From</span>
              <input className="date-input" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              <span className="date-range-label">To</span>
              <input className="date-input" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
              {(filterFrom || filterTo) && (
                <button className="button button--secondary" style={{ minHeight: 36, padding: "4px 10px", fontSize: 12 }} type="button" onClick={() => { setFilterFrom(""); setFilterTo(""); }}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="filter-bar__trailing">
            <span className="record-count">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table" aria-label="Ledger">
          <thead>
            <tr>
              <th className="table-th">Date</th>
              <th className="table-th">Event</th>
              <th className="table-th">Partner</th>
              <th className="table-th">Allocation</th>
              <th className="table-th table-th--money">Amount</th>
              <th className="table-th">Notes</th>
              <th className="table-th table-th--action"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="table-empty">
                    <span className="empty-state__icon"><BookOpen size={22} /></span>
                    <h3>No entries</h3>
                    <p>
                      {partners.length === 0
                        ? "Add partners and record contributions to see ledger entries."
                        : "No entries match the current filters."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((event) => {
                const partner = partners.find((p) => p.id === event.partnerId);
                const alloc = allocationSummaries.find((a) => a.id === event.allocationId);
                return (
                  <tr className="table-row" key={event.id}>
                    <td className="table-cell table-cell--secondary" data-label="Date" style={{ whiteSpace: "nowrap" }}>
                      {formatLedgerDate(event)}
                    </td>
                    <td className="table-cell" data-label="Event">
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <EventIcon type={event.eventType} />
                        <span style={{ color: EVENT_TONE[event.eventType], fontWeight: 600, fontSize: 12 }}>
                          {EVENT_LABELS[event.eventType]}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell" data-label="Partner">
                      {partner ? (
                        <Link className="entity-link" to={`/partners/${event.partnerId}`}>
                          {partner.name}
                        </Link>
                      ) : event.partnerId}
                    </td>
                    <td className="table-cell table-cell--secondary" data-label="Allocation">
                      {alloc ? `${fmt(alloc.amountRupees)} @ ${alloc.profitPercent}% p.m.` : "—"}
                    </td>
                    <td className="table-cell table-cell--money" data-label="Amount">
                      <strong style={{ color: EVENT_TONE[event.eventType] }}>
                        {event.eventType === "CAPITAL_RECEIVED" ? "+" : "−"}{fmt(event.amountRupees)}
                      </strong>
                    </td>
                    <td className="table-cell table-cell--secondary" data-label="Notes">{(event.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}</td>
                    <td className="table-cell table-cell--action">
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button
                          className="icon-button"
                          type="button"
                          title="Edit entry"
                          onClick={() => setEditEvent(event)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          title="Delete entry"
                          onClick={() => setConfirmDelete(event)}
                          style={{ color: "var(--outgoing)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                    {/* Mobile-only action row */}
                    <td className="table-cell-actions">
                      <div className="table-cell-actions__inner">
                        <button
                          className="button button--secondary"
                          type="button"
                          onClick={() => setEditEvent(event)}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          className="button button--secondary"
                          type="button"
                          onClick={() => setConfirmDelete(event)}
                          style={{ color: "var(--outgoing)", borderColor: "var(--outgoing)" }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
