import { RecordRow } from "../components/RecordRow";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  IndianRupee,
  TrendingUp,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { toast } from "../components/Toast";
import { getAvatarColorClass } from "../lib/currency";
import { formatDate } from "../lib/format";
import { downloadCSV, csvFilename } from "../lib/csv";
import { PageHeader } from "../components/PageHeader";
import type { AddPartnerInput } from "../store";
import { useStore } from "../useStore";
import { useRole } from "../context/RoleContext";

const PAGE_SIZE = 20;

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// ─── Urgency helpers ──────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

type UrgencyLevel = "overdue" | "attention" | "clear";

function getUrgency(ps: ReturnType<typeof import("../useStore").useStore>["partnerSummaries"][number]): UrgencyLevel {
  // Profit debt carries forward without accumulating extra monthly cycles.
  if (ps.nextReturnDate && ps.nextReturnDate < today) return "overdue";

  // Attention: has profit pending or upcoming return date within 7 days
  if (ps.totalProfitPending > 0) return "attention";
  const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  if (ps.nextReturnDate && ps.nextReturnDate <= sevenDaysOut) return "attention";
  return "clear";
}

function UrgencyDot({ level }: { level: UrgencyLevel }) {
  if (level === "overdue") {
    return (
      <span className="urgency-dot urgency-dot--overdue" title="Overdue — requires immediate attention">
        <AlertTriangle size={11} aria-label="Overdue" />
      </span>
    );
  }
  if (level === "attention") {
    return (
      <span className="urgency-dot urgency-dot--attention" title="Attention — profit pending or return due soon">
        <TrendingUp size={11} aria-label="Attention needed" />
      </span>
    );
  }
  return (
    <span className="urgency-dot urgency-dot--clear" title="All clear">
      <CheckCircle2 size={11} aria-label="Clear" />
    </span>
  );
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = "urgency" | "name" | "totalCapital" | "capitalOutstanding" | "totalProfitPending" | "nextReturnDate";
type SortDir = "asc" | "desc";

function SortButton({
  col, current, dir, onClick,
}: { col: SortKey; current: SortKey; dir: SortDir; onClick: () => void }) {
  const isActive = col === current;
  return (
    <button
      className={`sort-btn${isActive ? " sort-btn--active" : ""}`}
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={`Sort by ${col}`}
      style={{ verticalAlign: "middle", marginLeft: 4 }}
    >
      {isActive
        ? dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
        : <ArrowUpDown size={10} />}
    </button>
  );
}

// ─── Add Partner Modal ────────────────────────────────────────────────────────

function AddPartnerModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: AddPartnerInput) => void;
}) {
  const [form, setForm] = useState<AddPartnerInput>({ name: "", phone: "", email: "", notes: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof AddPartnerInput, string>>>({});

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    onSave(form);
    toast.success(`Partner "${form.name}" added successfully.`);
    onClose();
  }

  function set(field: keyof AddPartnerInput, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-partner-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="add-partner-title">Add Partner</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="p-name" className="form-label">Full name *</label>
            <input id="p-name" className={`form-input ${errors.name ? "form-input--error" : ""}`} type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ramesh Nair" autoFocus />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="p-phone" className="form-label">Phone</label>
              <input id="p-phone" className="form-input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98400 12345" />
            </div>
            <div className="form-field">
              <label htmlFor="p-email" className="form-label">Email</label>
              <input id="p-email" className="form-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="partner@email.com" />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="p-notes" className="form-label">Notes</label>
            <textarea id="p-notes" className="form-input form-textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Arrangement details, preferences…" rows={3} />
          </div>
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit">
              <UserPlus size={16} aria-hidden="true" /> Add Partner
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

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

// ─── Partners page ────────────────────────────────────────────────────────────

export function PartnersPage() {
  const { partnerSummaries, addPartner } = useStore();
  const { isCFO } = useRole();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("urgency");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "returned">("all");

  // Toggle sort
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  // Build urgency scores with memoization
  const enriched = useMemo(() =>
    partnerSummaries.map((ps) => ({ ...ps, urgency: getUrgency(ps) })),
    [partnerSummaries],
  );

  // Status filter
  const statusFiltered = useMemo(() =>
    enriched.filter((ps) => {
      if (statusFilter === "active") return ps.capitalOutstanding > 0;
      if (statusFilter === "returned") return ps.capitalOutstanding === 0 && ps.totalCapital > 0;
      return true;
    }),
    [enriched, statusFilter],
  );

  // Search filter
  const filtered = useMemo(() =>
    search.trim()
      ? statusFiltered.filter((ps) =>
          ps.partner.name.toLowerCase().includes(search.toLowerCase()) ||
          (ps.partner.notes || "").toLowerCase().includes(search.toLowerCase()) ||
          (ps.partner.phone || "").includes(search) ||
          (ps.partner.email || "").toLowerCase().includes(search.toLowerCase()),
        )
      : statusFiltered,
    [statusFiltered, search],
  );

  // Sort
  const urgencyRank = (u: UrgencyLevel) => u === "overdue" ? 2 : u === "attention" ? 1 : 0;

  const sorted = useMemo(() => {
    const mult = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "urgency": return mult * (urgencyRank(b.urgency) - urgencyRank(a.urgency));
        case "name": return mult * a.partner.name.localeCompare(b.partner.name);
        case "totalCapital": return mult * (b.totalCapital - a.totalCapital);
        case "capitalOutstanding": return mult * (b.capitalOutstanding - a.capitalOutstanding);
        case "totalProfitPending": return mult * (b.totalProfitPending - a.totalProfitPending);
        case "nextReturnDate":
          if (!a.nextReturnDate && !b.nextReturnDate) return 0;
          if (!a.nextReturnDate) return 1;
          if (!b.nextReturnDate) return -1;
          return mult * a.nextReturnDate.localeCompare(b.nextReturnDate);
        default: return 0;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const totalCapital = filtered.reduce((s, ps) => s + ps.totalCapital, 0);

  // Urgency counts for status bar
  const overdueCount = enriched.filter((p) => p.urgency === "overdue").length;
  const attentionCount = enriched.filter((p) => p.urgency === "attention").length;

  useEffect(() => { setPage(1); }, [search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleExportCSV() {
    downloadCSV(
      csvFilename("partners"),
      ["Partner", "Phone", "Email", "Total Capital (₹)", "Capital Outstanding (₹)", "Capital Returned (₹)", "Regular Profit Paid (₹)", "Cashback Paid (₹)", "Total Profits Received (₹)", "Unrecorded Cashback Amounts", "Profit Pending (₹)", "Exp. Monthly Profit (₹)", "Next Return Date", "Since", "Status"],
      sorted.map(({ partner, totalCapital, capitalOutstanding, totalCapitalReturned, totalProfitPaid, totalCashbackPaid, totalProfitsReceived, unknownCashbackCount, totalProfitPending, expectedMonthlyProfit, nextReturnDate, urgency }) => [
        partner.name,
        partner.phone || "",
        partner.email || "",
        totalCapital,
        capitalOutstanding,
        totalCapitalReturned,
        totalProfitPaid, totalCashbackPaid, totalProfitsReceived, unknownCashbackCount,
        totalProfitPending,
        expectedMonthlyProfit,
        nextReturnDate || "",
        partner.createdAt,
        urgency === "overdue" ? "Overdue" : urgency === "attention" ? "Attention" : "Clear",
      ]),
    );
  }

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Capital partners"
        title="Partners"
        description="Add and manage capital partners. View each partner's total capital, outstanding, and profit obligations."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {sorted.length > 0 && (
              <button className="button button--secondary" type="button" onClick={handleExportCSV}>
                <Download size={15} /> Export CSV
              </button>
            )}
            {isCFO && (
              <button className="button button--primary" type="button" onClick={() => setShowAddModal(true)}>
                <UserPlus size={16} aria-hidden="true" /> Add Partner
              </button>
            )}
          </div>
        }
      />

      {showAddModal && (
        <AddPartnerModal onClose={() => setShowAddModal(false)} onSave={(input) => addPartner(input)} />
      )}

      {/* Urgency summary banner */}
      {(overdueCount > 0 || attentionCount > 0) && (
        <div className="urgency-banner">
          {overdueCount > 0 && (
            <span className="urgency-banner__item urgency-banner__item--overdue">
              <AlertTriangle size={13} />
              {overdueCount} partner{overdueCount !== 1 ? "s" : ""} overdue
            </span>
          )}
          {attentionCount > 0 && (
            <span className="urgency-banner__item urgency-banner__item--attention">
              <TrendingUp size={13} />
              {attentionCount} partner{attentionCount !== 1 ? "s" : ""} need attention
            </span>
          )}
        </div>
      )}

      <div className="list-page__toolbar">
        {/* Status filter tabs */}
        <div className="status-tabs" role="group" aria-label="Filter partners by status">
          {(["all", "active", "returned"] as const).map((s) => (
            <button
              key={s}
              className={`status-tab${statusFilter === s ? " status-tab--active" : ""}`}
              type="button"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : s === "active" ? "Active" : "Returned"}
              <span className="status-tab__count">
                {s === "all" ? enriched.length
                  : s === "active" ? enriched.filter((p) => p.capitalOutstanding > 0).length
                  : enriched.filter((p) => p.capitalOutstanding === 0 && p.totalCapital > 0).length}
              </span>
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <div className="filter-bar__controls">
            <div className="search-input">
              <span className="search-input__icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                className="search-input__field"
                type="search"
                placeholder="Search partners…"
                aria-label="Search partners"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="filter-bar__trailing">
            <span className="record-count">{filtered.length} partner{filtered.length !== 1 ? "s" : ""}</span>
            {filtered.length > 0 && (
              <span className="record-count">· Total: <strong>{fmt(totalCapital)}</strong></span>
            )}
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table" aria-label="Partners">
          <thead>
            <tr>
              <th className="table-th table-th--urgency">
                <SortButton col="urgency" current={sortKey} dir={sortDir} onClick={() => toggleSort("urgency")} />
              </th>
              <th className="table-th">
                Partner
                <SortButton col="name" current={sortKey} dir={sortDir} onClick={() => toggleSort("name")} />
              </th>
              <th className="table-th table-th--money">
                Total capital
                <SortButton col="totalCapital" current={sortKey} dir={sortDir} onClick={() => toggleSort("totalCapital")} />
              </th>
              <th className="table-th table-th--money">
                Outstanding
                <SortButton col="capitalOutstanding" current={sortKey} dir={sortDir} onClick={() => toggleSort("capitalOutstanding")} />
              </th>
              <th className="table-th table-th--money">Regular profit paid</th><th className="table-th table-th--money">Cashback paid</th><th className="table-th table-th--money">Total profits received</th>
              <th className="table-th table-th--money">
                Profit pending
                <SortButton col="totalProfitPending" current={sortKey} dir={sortDir} onClick={() => toggleSort("totalProfitPending")} />
              </th>
              <th className="table-th">
                Next return
                <SortButton col="nextReturnDate" current={sortKey} dir={sortDir} onClick={() => toggleSort("nextReturnDate")} />
              </th>
              <th className="table-th">Since</th>
              <th className="table-th table-th--action"><span className="sr-only">View</span></th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <div className="table-empty">
                    <span className="empty-state__icon"><IndianRupee size={22} /></span>
                    <h3>{search ? "No partners match your search" : "No partners yet"}</h3>
                    <p>{search ? "Try a different name." : "Add your first partner to start tracking capital."}</p>
                    {!search && (
                      <button className="button button--primary" onClick={() => setShowAddModal(true)} type="button">
                        <UserPlus size={15} /> Add Partner
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map(({ partner, totalCapital, capitalOutstanding, totalProfitPaid, totalCashbackPaid, totalProfitsReceived, unknownCashbackCount, totalProfitPending, expectedMonthlyProfit, nextReturnDate, urgency }) => {
                const isOverdue = nextReturnDate ? nextReturnDate < today : false;
                return (
                  <RecordRow className={`table-row${urgency === "overdue" ? " table-row--overdue" : urgency === "attention" ? " table-row--attention" : ""}`} key={partner.id}>
                    <td className="table-cell table-cell--urgency">
                      <UrgencyDot level={urgency} />
                    </td>
                    <td className="table-cell">
                      <Link className="table-name-link" to={`/partners/${partner.id}`}>
                        <span className={`table-name-link__avatar ${getAvatarColorClass(partner.id)}`}>
                          {partner.name.charAt(0).toUpperCase()}
                        </span>
                        <span>
                          <strong>{partner.name}</strong>
                          <small>{partner.notes ? partner.notes.slice(0, 40) + (partner.notes.length > 40 ? "…" : "") : "—"}</small>
                        </span>
                      </Link>
                    </td>
                    <td className="table-cell table-cell--money" data-label="Total capital"><strong>{fmt(totalCapital)}</strong></td>
                    <td className="table-cell table-cell--money" data-label="Outstanding" style={{ color: capitalOutstanding > 0 ? "var(--pending)" : "var(--muted)" }}>
                      {fmt(capitalOutstanding)}
                    </td>
                    <td className="table-cell table-cell--money" data-label="Profit paid" style={{ color: "var(--incoming)" }}>
                      {fmt(totalProfitPaid)}
                    </td>
                    <td className="table-cell table-cell--money" data-label="Cashback paid">{fmt(totalCashbackPaid)}{unknownCashbackCount > 0 && <small> + {unknownCashbackCount} unrecorded</small>}</td>
                    <td className="table-cell table-cell--money" data-label="Total profits received">{fmt(totalProfitsReceived)}{unknownCashbackCount > 0 && <small> (known amounts)</small>}</td>
                    <td className="table-cell table-cell--money" data-label="Profit pending" style={{ color: totalProfitPending > 0 ? "var(--outgoing)" : expectedMonthlyProfit > 0 ? "var(--text-soft)" : "var(--muted)" }}>
                      {totalProfitPending > 0 ? (
                        <>
                          <TrendingUp size={13} style={{ verticalAlign: "middle", marginRight: 3 }} />
                          {fmt(totalProfitPending)}
                        </>
                      ) : expectedMonthlyProfit > 0 ? (
                        <span style={{ fontSize: 11 }}>{fmt(expectedMonthlyProfit)} this month</span>
                      ) : "—"}
                    </td>
                    <td className="table-cell table-cell--secondary" data-label="Next return">
                      {nextReturnDate ? (
                        <span style={{ color: isOverdue ? "var(--outgoing)" : "var(--pending)" }}>
                          <CalendarClock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                          {formatDate(nextReturnDate)}
                          {isOverdue && <span className="status-badge status-badge--overdue" style={{ marginLeft: 6, fontSize: 10 }}>Overdue</span>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="table-cell table-cell--secondary" data-label="Since">{formatDate(partner.createdAt)}</td>
                    <td className="table-cell table-cell--action">
                      <Link className="icon-button" to={`/partners/${partner.id}`} aria-label={`View ${partner.name}`}>
                        <ChevronRight size={17} />
                      </Link>
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
        totalItems={sorted.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
