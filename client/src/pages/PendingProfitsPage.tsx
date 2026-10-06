import { cashbackStatus } from '../../../functions/capitalos-api/cashback.mjs';
import { CashbackList, cashbackLabels } from '../components/CashbackList';
import { PaymentSelectionActions } from '../components/PaymentSelectionActions';
import { RecordRow } from "../components/RecordRow";
import { EditProfitPaymentModal } from "../components/EditProfitPaymentModal";
/**
 * Profits — profit obligations and payments, filterable by month and status.
 *
 * Status filter: All / Unpaid / Paid.
 * Unpaid is only ever tracked for the current month (live pending balance) and
 * the immediately upcoming month (allocations recurring via "Principal will
 * recur"). Paid works for any month by filtering profit payment records whose
 * paid date falls in the selected month.
 *
 * Allows recording a profit payment directly from the Unpaid section.
 * Supports partial payment via a checkbox — the remaining amount is stored
 * in the notes tag "Partial payment · Remaining: ₹<amount>" so the system
 * can correctly continue tracking the outstanding balance.
 */

import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, CreditCard as CreditCardIcon, Download, ExternalLink, Pencil, RefreshCw, Search, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { formatDate } from "../lib/format";
import { downloadCSV, csvFilename } from "../lib/csv";
import { RecordProfitModal } from "../components/RecordProfitModal";
import { SearchableSelect } from "../components/SearchableSelect";
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

function getMonthLabel(monthOffset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthOffset);
  return d.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

/** Inclusive ISO date bounds (YYYY-MM-DD) for the month at the given offset from today. */
function getMonthBounds(monthOffset: number): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`,
    end: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
  };
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = "amount" | "received" | "paidDate";
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

// ─── Allocation table row ─────────────────────────────────────────────────────

function MobileProfitSource({ allocation }: {
  allocation: ReturnType<typeof useStore>["allocationSummaries"][number] | undefined;
}) {
  const source = allocation
    ? allocation.creditCard?.cardName ?? (allocation.creditCardId ? "Credit card" : "Cash")
    : "Source unavailable";
  return (
    <span className="profit-mobile-source">
      {allocation?.creditCardId && <CreditCardIcon size={13} aria-hidden="true" />}
      <span><span className="sr-only">Source: </span>{source}</span>
    </span>
  );
}

function AllocationRow({
  a,
  onPay,
  isNextMonth,
  canEdit,
  selected = false,
  onSelect,
}: {
  a: ReturnType<typeof import("../useStore").useStore>["allocationSummaries"][number];
  onPay: () => void;
  isNextMonth?: boolean;
  canEdit?: boolean;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
}) {
  const amount = isNextMonth ? a.nextMonthProfit : a.profitPending;
  const isSmallAmount = amount > 0 && amount < 1;
  const showPartialBadge = !isNextMonth && a.isPartiallyPaid && a.profitPending > 0;

  return (
    <RecordRow className="table-row">
      <td className="table-cell profit-partner-cell">
        {canEdit && onSelect && <input className="payment-row-selection" type="checkbox" aria-label={`Select payment entry ${a.id}`} checked={selected} onChange={e => onSelect(e.target.checked)} />}
        <Link className="entity-link" to={`/partners/${a.partnerId}`}>
          {a.partner?.name ?? a.partnerId}
        </Link>
        <MobileProfitSource allocation={a} />
        {a.combinationReserved && <small style={{ display: 'block' }}>Unpaid profit from original capital</small>}
        {a.isFullyReturned && !a.combinationReserved && <small style={{ display: 'block' }}>Capital fully returned</small>}
      </td>
      <td className="table-cell table-cell--money" data-label="Capital"><strong>{fmt(a.amountRupees)}</strong></td>
      <td className="table-cell" data-label="Rate">
        <span className="party-type-chip party-type-chip--partner">{a.profitPercent}% p.m.</span>
      </td>
      <td className="table-cell table-cell--secondary" data-label="Received">{formatDate(a.receivedDate)}</td>
      <td className="table-cell profit-source-cell" data-label="Source">
        {a.creditCard ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
            <CreditCardIcon size={13} />
            {a.creditCard.cardName}
          </span>
        ) : (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>Cash</span>
        )}
      </td>
      <td className="table-cell table-cell--secondary" data-label="Notes" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {(a.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}
      </td>
      <td className="table-cell table-cell--money" data-label="Profit" style={{ color: isNextMonth ? "var(--accent)" : "var(--pending)", fontWeight: 700 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          {isSmallAmount ? "< ₹1" : fmt(amount)}
          {showPartialBadge && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              background: "var(--warning-soft, #fff8e1)",
              color: "var(--warning, #b45309)",
              border: "1px solid var(--warning, #f59e0b)",
              borderRadius: 4,
              padding: "1px 5px",
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
            }}>
              Partial
            </span>
          )}
        </span>
        {showPartialBadge && (
          <span style={{ fontSize: 10, color: "var(--muted)", display: "block", textAlign: "right" }}>
            Paid: {fmt(a.totalProfitPaid)} · Expected: {fmt(a.currentCycleProfit)}
          </span>
        )}
      </td>
      <td className="table-cell table-cell--action table-cell--desktop-action">
        {!isNextMonth && canEdit && (
          <button className="pay-btn" type="button" onClick={onPay}>
            <CheckCircle2 size={13} />
            {showPartialBadge ? `Pay ${isSmallAmount ? "< ₹1" : fmt(amount)} more` : `Pay ${isSmallAmount ? "< ₹1" : fmt(amount)}`}
          </button>
        )}
      </td>
      {/* Mobile-only action row */}
      {!isNextMonth && canEdit && (
        <td className="table-cell-actions" colSpan={8}>
          <div className="table-cell-actions__inner">
            <button className="button button--primary" type="button" onClick={onPay} style={{ flex: 1 }}>
              <CheckCircle2 size={14} />
              {showPartialBadge ? `Pay ${isSmallAmount ? "< ₹1" : fmt(amount)} more` : `Pay ${isSmallAmount ? "< ₹1" : fmt(amount)}`}
            </button>
          </div>
        </td>
      )}
    </RecordRow>
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
        <button className="pagination__btn" type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span className="pagination__pages">Page {page} of {totalPages}</span>
        <button className="pagination__btn" type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PendingProfitsPage() {
  const { allocationSummaries, partners, creditCards, profitRecords } = useStore();
  const { isCFO } = useRole();
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [choosingContribution, setChoosingContribution] = useState(false);
  const [editingProfitId, setEditingProfitId] = useState<string | null>(null);
  const [filterPartnerId, setFilterPartnerId] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL"); // ALL | CASH | CARD
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [view, setView] = useState('profits');
  const [cashbackFilter, setCashbackFilter] = useState('ALL');
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, relative to today
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const hasCards = creditCards.length > 0;

  const monthLabel = getMonthLabel(monthOffset);
  const showUnpaid = view !== "cashback" && (statusFilter === "ALL" || statusFilter === "UNPAID") && (monthOffset === 0 || monthOffset === 1);
  const showPaid = view !== "cashback" && (statusFilter === "ALL" || statusFilter === "PAID");
  const showCashback = view !== "profits";

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  // Global search filter function (allocation-based, used for the unpaid list)
  const matchesSearch = (a: typeof allocationSummaries[number]) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (a.partner?.name || "").toLowerCase().includes(q) ||
      (a.notes || "").toLowerCase().includes(q) ||
      String(a.amountRupees).includes(q) ||
      `${a.profitPercent}`.includes(q)
    );
  };

  // Unpaid is only ever tracked for the current month (live pending balance)
  // and the immediately upcoming month (recurring allocations).
  const unpaidList = useMemo(() => {
    if (monthOffset !== 0 && monthOffset !== 1) return [];
    const mult = sortDir === "asc" ? 1 : -1;
    return allocationSummaries
      .filter((a) => monthOffset === 0 ? a.profitPending > 0 : a.nextMonthProfit > 0)
      .filter((a) => filterPartnerId === "ALL" || a.partnerId === filterPartnerId)
      .filter((a) => filterSource === "ALL" || (filterSource === "CASH" ? !a.creditCardId : !!a.creditCardId))
      .filter(matchesSearch)
      .sort((a, b) => {
        if (sortKey === "received") return mult * a.receivedDate.localeCompare(b.receivedDate);
        const amtA = monthOffset === 0 ? a.profitPending : a.nextMonthProfit;
        const amtB = monthOffset === 0 ? b.profitPending : b.nextMonthProfit;
        return mult * (amtA - amtB);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocationSummaries, monthOffset, filterPartnerId, filterSource, searchQuery, sortKey, sortDir]);

  useEffect(() => { setSelectedPaymentIds([]); }, [monthOffset, filterPartnerId, filterSource, searchQuery, statusFilter]);

  // Paid: profit payments recorded within the selected month — works for any month
  const paidRecords = useMemo(() => {
    const { start, end } = getMonthBounds(monthOffset);
    const mult = sortDir === "asc" ? 1 : -1;
    const q = searchQuery.trim().toLowerCase();
    return profitRecords
      .filter((r) => r.paidDate >= start && r.paidDate <= end)
      .filter((r) => filterPartnerId === "ALL" || r.partnerId === filterPartnerId)
      .filter((r) => {
        if (filterSource === "ALL") return true;
        const alloc = allocationSummaries.find((a) => a.id === r.allocationId);
        return filterSource === "CASH" ? !alloc?.creditCardId : !!alloc?.creditCardId;
      })
      .filter((r) => {
        if (!q) return true;
        const partnerName = (partners.find((p) => p.id === r.partnerId)?.name || "").toLowerCase();
        return partnerName.includes(q) || (r.notes || "").toLowerCase().includes(q) || String(r.amountRupees).includes(q);
      })
      .sort((a, b) => sortKey === "amount"
        ? mult * (a.amountRupees - b.amountRupees)
        : mult * a.paidDate.localeCompare(b.paidDate));
  }, [profitRecords, allocationSummaries, partners, monthOffset, filterPartnerId, filterSource, searchQuery, sortKey, sortDir]);

  const totalUnpaid = unpaidList.reduce((s, a) => s + (monthOffset === 0 ? a.profitPending : a.nextMonthProfit), 0);
  const { start: periodStart, end: periodEnd } = getMonthBounds(monthOffset);
  const cashbackPaidInPeriod = allocationSummaries.filter(a => (filterPartnerId === 'ALL' || a.partnerId === filterPartnerId) && filterSource !== 'CASH' && matchesSearch(a) && a.cashback?.status === 'paid' && a.cashback.paidDate >= periodStart && a.cashback.paidDate <= periodEnd);
  const cashbackTotal = cashbackPaidInPeriod.reduce((sum, a) => sum + (a.cashback?.status === 'paid' ? a.cashback.amountRupees ?? 0 : 0), 0);
  const totalPaid = paidRecords.reduce((s, r) => s + r.amountRupees, 0);

  const payingAlloc = payingId ? allocationSummaries.find((a) => a.id === payingId) : null;
  const payingPartner = payingAlloc ? partners.find((p) => p.id === payingAlloc.partnerId) : null;
  const editingProfit = editingProfitId ? profitRecords.find((r) => r.id === editingProfitId) : null;
  const editingProfitAllocation = editingProfit ? allocationSummaries.find((a) => a.id === editingProfit.allocationId) : null;

  const cashbackEntries = useMemo(() => {
    const { start, end } = getMonthBounds(monthOffset);
    const statuses: Record<string, string> = { CB_UNPAID: 'unpaid', CB_PAID: 'paid', CB_NA: 'not_applicable', CB_REVIEW: 'review', CB_NOT_FIRST: 'not_first_transaction' };
    const q = searchQuery.trim().toLowerCase();
    return allocationSummaries.filter(a => a.creditCardId && !a.combination)
      .filter(a => filterSource !== 'CASH' && (filterPartnerId === 'ALL' || a.partnerId === filterPartnerId))
      .filter(a => !q || [a.partner?.name, a.creditCard?.cardName, a.notes, a.cashback?.notes, String(a.amountRupees), cashbackLabels[cashbackStatus(a)]].some(v => v?.toLowerCase().includes(q)))
      .filter(a => cashbackFilter === 'ALL' ? !['not_applicable', 'not_first_transaction'].includes(cashbackStatus(a)) : cashbackStatus(a) === statuses[cashbackFilter])
      .filter(a => cashbackFilter === 'CB_NOT_FIRST' || a.cashback?.status !== 'paid' || (a.cashback.paidDate >= start && a.cashback.paidDate <= end))
      .sort((a, b) => a.receivedDate.localeCompare(b.receivedDate));
  }, [allocationSummaries, filterSource, filterPartnerId, searchQuery, cashbackFilter, monthOffset]);

  const hasAny = (showCashback && cashbackEntries.length > 0) || (showUnpaid && unpaidList.length > 0) || (showPaid && paidRecords.length > 0);

  // Pagination
  const unpaidTotalPages = Math.max(1, Math.ceil(unpaidList.length / PAGE_SIZE));
  const unpaidPaginated = unpaidList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paidTotalPages = Math.max(1, Math.ceil(paidRecords.length / PAGE_SIZE));
  const paidPaginated = paidRecords.slice((paidPage - 1) * PAGE_SIZE, paidPage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); setPaidPage(1); }, [filterPartnerId, filterSource, statusFilter, monthOffset, searchQuery]);

  // Count partially paid allocations for section label (current month only)
  const partialCount = monthOffset === 0 ? unpaidList.filter((a) => a.isPartiallyPaid).length : 0;

  function handleExportCSV() {
    const rows: (string | number)[][] = [];
    if (showUnpaid) {
      unpaidList.forEach((a) => {
        rows.push([
          a.partner?.name ?? a.partnerId,
          a.amountRupees,
          `${a.profitPercent}% p.m.`,
          a.receivedDate,
          monthOffset === 0 ? a.profitPending : a.nextMonthProfit,
          monthOffset === 0 ? (a.isPartiallyPaid ? "Partial" : "Pending") : "Upcoming",
          monthLabel,
          (a.notes ?? "").replace(/\s*WA_CONFIRMED\s*/g, "").trim(),
        ]);
      });
    }
    if (showPaid) {
      paidRecords.forEach((r) => {
        const alloc = allocationSummaries.find((a) => a.id === r.allocationId);
        rows.push([
          alloc?.partner?.name ?? r.partnerId,
          alloc?.amountRupees ?? "",
          alloc ? `${alloc.profitPercent}% p.m.` : "",
          alloc?.receivedDate ?? "",
          r.amountRupees,
          "Paid",
          monthLabel,
          (r.notes ?? "").replace(/\s*WA_CONFIRMED\s*/g, "").trim(),
        ]);
      });
    }
    if (showCashback) cashbackEntries.forEach(a => rows.push([
      a.partner?.name ?? a.partnerId, a.amountRupees, '', a.receivedDate,
      a.cashback?.status === 'paid' ? a.cashback.amountRupees ?? 'Amount not recorded' : '', cashbackLabels[cashbackStatus(a)],
      a.cashback?.status === 'paid' ? a.cashback.paidDate : 'All months', a.cashback?.notes || '',
    ]));
    downloadCSV(
      csvFilename("profits"),
      ["Partner", "Capital (₹)", "Rate", "Received", "Amount (₹)", "Status", "Month", "Notes"],
      rows,
    );
  }

  return (
    <div className="list-page profits-page">
      <PageHeader
        eyebrow="Profit obligations"
        title="Profits"
        description="Profit obligations and payments — filter by month and status."
        actions={
          <>
          {hasAny && (
            <button className="button button--secondary" type="button" onClick={handleExportCSV}>
              <Download size={15} /> Export CSV
            </button>
          )}
          {isCFO && view !== "cashback" && <button className="button button--primary" type="button" onClick={() => setChoosingContribution(true)}>
            <CheckCircle2 size={15} /> Record Profit
          </button>}
          </>
        }
      />

      {isCFO && showUnpaid && monthOffset === 0 && <>
        <label className="checkbox-row"><input type="checkbox" aria-label="Select all filtered profit entries" checked={unpaidList.length > 0 && unpaidList.every(a => selectedPaymentIds.includes(a.id))} onChange={e => setSelectedPaymentIds(e.target.checked ? unpaidList.map(a => a.id) : [])} />Select all filtered profit entries</label>
        <PaymentSelectionActions profitOnly entries={allocationSummaries.filter(a => selectedPaymentIds.includes(a.id))} onClear={() => setSelectedPaymentIds([])} />
      </>}
      {isCFO && choosingContribution && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="profit-contribution-title">
          <div className="modal">
            <div className="modal__header">
              <h2 id="profit-contribution-title">Select contribution</h2>
              <button className="icon-button" type="button" aria-label="Close contribution selection" onClick={() => setChoosingContribution(false)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              <p className="form-hint">Record a profit payment for active or fully returned capital.</p>
              <label className="form-label" htmlFor="profit-contribution">Contribution</label>
              <SearchableSelect
                id="profit-contribution"
                value=""
                placeholder="Select contribution…"
                searchPlaceholder="Search partner, amount, source…"
                options={allocationSummaries
                  .filter(a => a.receivedDate <= new Date().toLocaleDateString('en-CA') && (!a.combinationReserved || a.profitPending > 0))
                  .map(a => ({
                    value: a.id,
                    label: `${a.partner?.name ?? a.partnerId} — ${fmt(a.amountRupees)} @ ${a.profitPercent}% p.m.`,
                    sublabel: `${formatDate(a.receivedDate)} · ${a.creditCard?.cardName ?? 'Cash'} · ${a.combinationReserved ? 'Original profit remaining' : a.isFullyReturned ? 'Capital fully returned' : 'Active capital'} · ${a.notes.replace(/\s*WA_CONFIRMED\s*/g, '').trim()}`,
                  }))}
                onChange={id => { setPayingId(id); setChoosingContribution(false); }}
              />
            </div>
            <div className="modal__footer"><button className="button button--secondary" type="button" onClick={() => setChoosingContribution(false)}>Cancel</button></div>
          </div>
        </div>
      )}

      {isCFO && payingAlloc && payingId && (
        <RecordProfitModal
          allocationId={payingId}
          partnerId={payingAlloc.partnerId}
          pendingAmount={payingAlloc.profitPending}
          expectedMonthlyProfit={payingAlloc.combinationReserved ? payingAlloc.profitPending : payingAlloc.currentCycleProfit}
          canRecur={!payingAlloc.combinationReserved && !payingAlloc.isFullyReturned}
          allocationLabel={`${payingPartner?.name ?? "—"} — ${fmt(payingAlloc.amountRupees)} @ ${payingAlloc.profitPercent}% p.m.`}
          {...(payingPartner?.name !== undefined ? { partnerName: payingPartner.name } : {})}
          partnerPhone={payingPartner?.phone ?? null}
          capitalOutstanding={payingAlloc.capitalOutstanding}
          profitPercent={payingAlloc.profitPercent}
          fundingSource={payingAlloc.creditCardId ? "card" : "cash"}
          cardName={payingAlloc.creditCard?.cardName ?? null}
          amountGivenDate={payingAlloc.receivedDate ?? null}
          onClose={() => setPayingId(null)}
        />
      )}
      {editingProfit && (
        <EditProfitPaymentModal
          record={editingProfit}
          expectedMonthlyProfit={editingProfitAllocation?.currentCycleProfit ?? 0}
          onClose={() => setEditingProfitId(null)}
        />
      )}

      <div className="list-page__toolbar">
        <div className="filter-bar">
          <div className="filter-bar__controls" style={{ flexWrap: "wrap" }}>
            {/* Global search */}
            <div className="search-input" style={{ minWidth: 200, flex: "1 1 200px" }}>
              <Search size={15} className="search-input__icon" />
              <input
                className="search-input__field"
                type="search"
                placeholder="Search partner, notes, amount, rate…"
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
            {hasCards && (
              <select className="select-filter__control" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                <option value="ALL">All sources</option>
                <option value="CASH">Cash only</option>
                <option value="CARD">Card only</option>
              </select>
            )}
            <label className="profit-filter-label">Show<select aria-label="Payment view" className="select-filter__control" value={view} onChange={e => setView(e.target.value)}>
              <option value="profits">Profits</option><option value="cashback">Cashback</option><option value="all">Profits and cashback</option>
            </select></label>
            {view !== 'cashback' && <label className="profit-filter-label">Profit status<select aria-label="Profit status" className="select-filter__control" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="ALL">All profits</option><option value="UNPAID">Unpaid only</option><option value="PAID">Paid only</option>
            </select></label>}
            {showCashback && <label className="profit-filter-label">Filter cashback<select aria-label="Cashback filter" className="select-filter__control" value={cashbackFilter} onChange={e => setCashbackFilter(e.target.value)}>
              <option value="ALL">All applicable cashback</option><option value="CB_UNPAID">Cashback not paid</option><option value="CB_PAID">Cashback paid</option><option value="CB_NA">Cashback not applicable</option><option value="CB_REVIEW">Cashback needs review</option><option value="CB_NOT_FIRST">Not first transaction</option>
            </select></label>}
            <div className="profit-month-control" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button className="icon-button" type="button" onClick={() => setMonthOffset((o) => o - 1)} aria-label="Previous month">
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 130, textAlign: "center" }}>{monthLabel}</span>
              <button className="icon-button" type="button" onClick={() => setMonthOffset((o) => o + 1)} aria-label="Next month">
                <ChevronRight size={16} />
              </button>
              {monthOffset !== 0 && (
                <button className="button button--secondary" type="button" onClick={() => setMonthOffset(0)} style={{ padding: "4px 10px", fontSize: 12 }}>
                  Today
                </button>
              )}
            </div>
          </div>
          <div className="filter-bar__trailing">
            <span className="record-count">
              {showUnpaid && <span style={{ color: "var(--outgoing)" }}>Profit pending: <strong>{fmt(totalUnpaid)}</strong></span>}
              {showUnpaid && showPaid && <span style={{ margin: "0 8px", color: "var(--muted)" }}>·</span>}
              {showPaid && <span style={{ color: "var(--incoming)" }}>Regular profit paid: <strong>{fmt(totalPaid)}</strong></span>}
            </span>
          </div>
        </div>
      </div>

      {showCashback && <CashbackList entries={cashbackEntries} canEdit={isCFO} />}

      {view === 'all' && <div className="earnings-summary"><div><span>Cashback paid in {monthLabel}</span><strong>{fmt(cashbackTotal)}</strong></div><div><span>Total profits received in {monthLabel}</span><strong>{fmt(totalPaid + cashbackTotal)}</strong></div><p className="earnings-note">Known amounts only. Pending profit excludes cashback.</p></div>}
      {/* Summary strip */}
      {hasAny && (showUnpaid || showPaid) && (
        <div className="ledger-summary" style={{ marginBottom: 20 }}>
          {showUnpaid && (
            <div className="ledger-summary__item">
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                {monthLabel} — {monthOffset === 0 ? "Pending" : "Upcoming"}
              </span>
              <strong style={{ fontSize: 18, color: "var(--outgoing)" }}>{fmt(totalUnpaid)}</strong>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {unpaidList.length} allocation{unpaidList.length !== 1 ? "s" : ""}
                {partialCount > 0 && (
                  <span style={{ color: "var(--warning, #b45309)", marginLeft: 4 }}>
                    ({partialCount} partial)
                  </span>
                )}
              </span>
            </div>
          )}
          {showUnpaid && showPaid && <div className="ledger-summary__divider" />}
          {showPaid && (
            <div className="ledger-summary__item">
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                {monthLabel} — Paid
              </span>
              <strong style={{ fontSize: 18, color: "var(--incoming)" }}>{fmt(totalPaid)}</strong>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{paidRecords.length} payment{paidRecords.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Unpaid Section ── */}
      {showUnpaid && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {monthOffset === 1 && <RefreshCw size={14} style={{ color: "var(--accent)" }} />}
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: monthOffset === 0 ? "var(--outgoing)" : "var(--accent)" }}>
              {monthLabel} — {monthOffset === 0 ? "Profit Pending" : "Upcoming (Recurring)"}
            </h3>
            {unpaidList.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>({unpaidList.length})</span>
            )}
            {partialCount > 0 && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                background: "var(--warning-soft, #fff8e1)",
                color: "var(--warning, #b45309)",
                border: "1px solid var(--warning, #f59e0b)",
                borderRadius: 4,
                padding: "2px 7px",
              }}>
                {partialCount} partially paid
              </span>
            )}
          </div>
          {monthOffset === 1 && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -4, marginBottom: 10 }}>
              Upcoming profit includes capital marked Principal will recur when recording profit.
            </p>
          )}

          <div className="table-wrapper">
            <table className="data-table" aria-label={`${monthLabel} pending profits`}>
              <thead>
                <tr>
                  <th className="table-th">Partner</th>
                  <th className="table-th table-th--money">Capital</th>
                  <th className="table-th">Rate</th>
                  <th className="table-th">
                    Received
                    <SortButton col="received" current={sortKey} dir={sortDir} onClick={() => toggleSort("received")} />
                  </th>
                  <th className="table-th">Source</th>
                  <th className="table-th">Notes</th>
                  <th className="table-th table-th--money">
                    {monthOffset === 0 ? "Profit pending" : "Expected amount"}
                    <SortButton col="amount" current={sortKey} dir={sortDir} onClick={() => toggleSort("amount")} />
                  </th>
                  <th className="table-th table-th--action"><span className="sr-only">Pay</span></th>
                </tr>
              </thead>
              <tbody>
                {unpaidList.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="table-empty">
                        <span className="empty-state__icon"><TrendingUp size={22} /></span>
                        <h3>{monthOffset === 0 ? "All caught up!" : "Nothing recurring"}</h3>
                        <p>{monthOffset === 0 ? `No profit payments pending for ${monthLabel}.` : `No recurring allocations upcoming for ${monthLabel}.`}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  unpaidPaginated.map((a) => (
                    <AllocationRow key={a.id} a={a} selected={selectedPaymentIds.includes(a.id)} onSelect={checked => setSelectedPaymentIds(ids => checked ? [...ids, a.id] : ids.filter(id => id !== a.id))} onPay={() => setPayingId(a.id)} isNextMonth={monthOffset === 1} canEdit={monthOffset === 0 && isCFO} />
                  ))
                )}
              </tbody>
              {unpaidPaginated.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)" }}>
                    <td className="table-cell" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>TOTAL</td>
                    <td className="table-cell table-cell--money" style={{ fontWeight: 700 }}>{fmt(unpaidList.reduce((s, a) => s + a.amountRupees, 0))}</td>
                    <td className="table-cell" colSpan={4} />
                    <td className="table-cell table-cell--money" style={{ color: "var(--outgoing)", fontWeight: 700 }}>{fmt(totalUnpaid)}</td>
                    <td className="table-cell" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={unpaidTotalPages}
            totalItems={unpaidList.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {view !== "cashback" && !showUnpaid && (statusFilter === "ALL" || statusFilter === "UNPAID") && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
          Pending obligations are only tracked for the current and next month. Switch to {getMonthLabel(0)} or {getMonthLabel(1)} to view pending profits, or use "Paid only" to see payment history for {monthLabel}.
        </p>
      )}

      {/* ── Paid Section ── */}
      {showPaid && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--incoming)" }}>
              {monthLabel} — Paid
            </h3>
            {paidRecords.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>({paidRecords.length})</span>
            )}
          </div>

          <div className="table-wrapper">
            <table className="data-table" aria-label={`${monthLabel} paid profits`}>
              <thead>
                <tr>
                  <th className="table-th">Partner</th>
                  <th className="table-th table-th--money">Capital</th>
                  <th className="table-th">Rate</th>
                  <th className="table-th">Source</th>
                  <th className="table-th">
                    Paid on
                    <SortButton col="paidDate" current={sortKey} dir={sortDir} onClick={() => toggleSort("paidDate")} />
                  </th>
                  <th className="table-th">Notes</th>
                  <th className="table-th table-th--money">
                    Amount paid
                    <SortButton col="amount" current={sortKey} dir={sortDir} onClick={() => toggleSort("amount")} />
                  </th>
                  <th className="table-th table-th--action"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {paidRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="table-empty">
                        <span className="empty-state__icon"><CheckCircle2 size={22} /></span>
                        <h3>No payments recorded</h3>
                        <p>No profit payments were recorded for {monthLabel}.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paidPaginated.map((r) => {
                    const alloc = allocationSummaries.find((a) => a.id === r.allocationId);
                    return (
                      <RecordRow className="table-row" key={r.id}>
                        <td className="table-cell profit-partner-cell">
                          <Link className="entity-link" to={`/partners/${r.partnerId}`}>
                            {alloc?.partner?.name ?? r.partnerId}
                          </Link>
                          <MobileProfitSource allocation={alloc} />
                        </td>
                        <td className="table-cell table-cell--money" data-label="Capital">{alloc ? fmt(alloc.amountRupees) : "—"}</td>
                        <td className="table-cell" data-label="Rate">
                          {alloc ? <span className="party-type-chip party-type-chip--partner">{alloc.profitPercent}% p.m.</span> : "—"}
                        </td>
                        <td className="table-cell profit-source-cell" data-label="Source">
                          {alloc?.creditCard ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                              <CreditCardIcon size={13} />
                              {alloc.creditCard.cardName}
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>Cash</span>
                          )}
                        </td>
                        <td className="table-cell table-cell--secondary" data-label="Paid on">{formatDate(r.paidDate)}</td>
                        <td className="table-cell table-cell--secondary" data-label="Notes" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {(r.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}
                        </td>
                        <td className="table-cell table-cell--money" data-label="Amount paid" style={{ color: "var(--incoming)", fontWeight: 700 }}>{fmt(r.amountRupees)}</td>
                        <td className="table-cell table-cell--action table-cell--desktop-action">
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            {isCFO && (
                              <button className="icon-button" type="button" onClick={() => setEditingProfitId(r.id)} title="Edit profit payment" aria-label="Edit profit payment">
                                <Pencil size={14} />
                              </button>
                            )}
                            <Link className="icon-button" to={`/ledger?highlight=l-pr-${r.id}`} title="View in Ledger" aria-label="View in Ledger">
                              <ExternalLink size={14} />
                            </Link>
                          </div>
                        </td>
                        {isCFO && (
                          <td className="table-cell-actions" colSpan={8}>
                            <div className="table-cell-actions__inner">
                              <button className="button button--secondary" type="button" onClick={() => setEditingProfitId(r.id)}><Pencil size={13} /> Edit payment</button>
                              <Link className="button button--secondary" to={`/ledger?highlight=l-pr-${r.id}`}><ExternalLink size={13} /> Ledger</Link>
                            </div>
                          </td>
                        )}
                      </RecordRow>
                    );
                  })
                )}
              </tbody>
              {paidPaginated.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)" }}>
                    <td className="table-cell" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }} colSpan={6}>TOTAL</td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--incoming)", fontWeight: 700 }}>{fmt(totalPaid)}</td>
                    <td className="table-cell" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <Pagination
            page={paidPage}
            totalPages={paidTotalPages}
            totalItems={paidRecords.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPaidPage}
          />
        </div>
      )}

      {/* Empty state when nothing to show at all */}
      {!hasAny && view !== "cashback" && (
        <div className="table-empty" style={{ paddingTop: 48 }}>
          <span className="empty-state__icon"><TrendingUp size={28} /></span>
          <h3>Nothing to show</h3>
          <p>No profit obligations or payments found for {monthLabel} with the current filters.</p>
        </div>
      )}
    </div>
  );
}
