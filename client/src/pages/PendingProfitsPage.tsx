/**
 * Pending Profits — all allocations with profit pending, grouped by section.
 *
 * Section 1: Current month — allocations where profit is not fully paid yet
 *             (includes partial payments — shows remaining pending amount).
 * Section 2: Next month   — allocations where recur was checked (this month
 *                           done, next month upcoming).
 *
 * Allows recording a profit payment directly from this view.
 * Supports partial payment via a checkbox — the remaining amount is stored
 * in the notes tag "Partial payment · Remaining: ₹<amount>" so the system
 * can correctly continue tracking the outstanding balance.
 */

import { CheckCircle2, ChevronLeft, ChevronRight, Download, MessageCircle, RefreshCw, Search, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { formatDate } from "../lib/format";
import { downloadCSV, csvFilename } from "../lib/csv";
import { buildProfitPaymentWhatsAppLink } from "../lib/whatsapp";
import { addProfitRecord, updateAllocationReturnDate, type AddProfitRecordInput } from "../store";
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

// ─── Record Profit Payment Modal ──────────────────────────────────────────────

function RecordProfitModal({
  allocationId, partnerId, pendingAmount, expectedMonthlyProfit, allocationLabel, partnerPhone, partnerName, capitalOutstanding, profitPercent, onClose,
}: {
  allocationId: string;
  partnerId: string;
  pendingAmount: number;
  expectedMonthlyProfit: number;
  allocationLabel: string;
  partnerPhone?: string | null;
  partnerName?: string;
  capitalOutstanding?: number;
  profitPercent?: number;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    amountStr: String(Math.max(1, Math.round(pendingAmount))),
    paidDate: today,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Post-submit state for WhatsApp share
  const [submitted, setSubmitted] = useState(false);
  const [submittedAmount, setSubmittedAmount] = useState(0);
  const [submittedDate, setSubmittedDate] = useState(today);

  // Reinvest (recur) state
  const [reinvest, setReinvest] = useState(false);
  const [newReturnDate, setNewReturnDate] = useState("");

  // Partial payment state
  const [isPartial, setIsPartial] = useState(false);
  const [remainingAmtStr, setRemainingAmtStr] = useState("");
  const [remainingPercent, setRemainingPercent] = useState("");

  // Derived: compute what remaining will be shown to user
  const paidAmt = Number(form.amountStr) || 0;

  const computedRemaining = useMemo(() => {
    if (!isPartial) return 0;
    // If user provides remaining amount explicitly, use that
    if (remainingAmtStr.trim() !== "") {
      const v = Number(remainingAmtStr);
      return isNaN(v) ? 0 : Math.max(0, Math.round(v));
    }
    // If user provides remaining %, compute from capital
    if (remainingPercent.trim() !== "") {
      // remainingPercent is a profit rate — not directly useful unless we know capital
      // We store it as-is in notes; remaining amount will be derived by store at read time
      return null; // null = "stored as %"
    }
    // Neither provided — auto-calculate: expected - paid
    return Math.max(0, expectedMonthlyProfit - paidAmt);
  }, [isPartial, remainingAmtStr, remainingPercent, expectedMonthlyProfit, paidAmt]);

  function validate() {
    const e: Record<string, string> = {};
    const amt = Number(form.amountStr);
    if (!form.amountStr || isNaN(amt) || amt <= 0) e.amountStr = "Enter a valid amount";
    if (!form.paidDate) e.paidDate = "Required";
    if (isPartial && remainingAmtStr !== "" && (isNaN(Number(remainingAmtStr)) || Number(remainingAmtStr) < 0)) {
      e.remainingAmtStr = "Enter a valid remaining amount";
    }
    if (isPartial && remainingPercent !== "" && (isNaN(Number(remainingPercent)) || Number(remainingPercent) < 0 || Number(remainingPercent) > 100)) {
      e.remainingPercent = "Enter a valid % (0–100)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;

    // Build notes
    const noteParts: string[] = [];
    if (form.notes.trim()) noteParts.push(form.notes.trim());
    if (reinvest) noteParts.push("Capital reinvested");
    if (isPartial) {
      // Build partial tag
      if (remainingAmtStr.trim() !== "") {
        const remAmt = Math.round(Number(remainingAmtStr));
        noteParts.push(`Partial payment · Remaining: ₹${remAmt.toLocaleString("en-IN")}`);
      } else if (remainingPercent.trim() !== "") {
        noteParts.push(`Partial payment · Remaining %: ${remainingPercent}%`);
      } else {
        // Auto-calculated remaining
        const autoRemaining = Math.max(0, expectedMonthlyProfit - paidAmt);
        noteParts.push(`Partial payment · Remaining: ₹${autoRemaining.toLocaleString("en-IN")}`);
      }
    }

    const input: AddProfitRecordInput = {
      allocationId,
      partnerId,
      amountRupees: Math.round(Number(form.amountStr)),
      paidDate: form.paidDate,
      notes: noteParts.join(" · "),
    };

    addProfitRecord(input);

    // If reinvesting, also update the allocation's return date
    if (reinvest) {
      await updateAllocationReturnDate(allocationId, newReturnDate || null);
    }

    // Show WhatsApp share step
    setSubmittedAmount(Math.round(Number(form.amountStr)));
    setSubmittedDate(form.paidDate);
    setSubmitted(true);
  }

  const set = (f: string, v: string) => {
    setForm((p) => ({ ...p, [f]: v }));
    setErrors((e) => ({ ...e, [f]: undefined as unknown as string }));
  };

  // ── Post-submit: show WhatsApp share option ──
  if (submitted) {
    const waLink = buildProfitPaymentWhatsAppLink({
      partnerName: partnerName ?? "Partner",
      partnerPhone: partnerPhone ?? null,
      amountRupees: submittedAmount,
      paidDate: submittedDate,
      capitalOutstanding: capitalOutstanding ?? null,
      profitPercent: profitPercent ?? null,
    });

    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pp-done-title">
        <div className="modal">
          <div className="modal__header">
            <h2 id="pp-done-title" style={{ color: "var(--incoming)", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={18} /> Payment Recorded
            </h2>
            <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
          </div>
          <div className="modal__body">
            <div style={{
              background: "var(--incoming-soft)",
              border: "1px solid color-mix(in srgb, var(--incoming) 25%, var(--border))",
              borderRadius: 8,
              padding: "14px 16px",
              marginBottom: 16,
            }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--incoming)" }}>
                ✓ {fmt(submittedAmount)} profit payment recorded successfully
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                For {partnerName ?? "partner"} on {submittedDate}
              </p>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 12 }}>
              Share a payment confirmation with the partner on WhatsApp?
            </p>

            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="button button--primary"
              style={{ width: "100%", justifyContent: "center", background: "#25d366", borderColor: "#25d366", color: "#fff", textDecoration: "none" }}
            >
              <MessageCircle size={16} /> Share on WhatsApp
            </a>

            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>
              Opens WhatsApp with a pre-filled message. You send it.
            </p>
          </div>
          <div className="modal__footer">
            <button className="button button--primary" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pp-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="pp-title">Record Profit Payment</h2>
          <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          <div className="form-hint">
            Allocation: <strong>{allocationLabel}</strong>
            {" · "}Expected: <strong>{fmt(expectedMonthlyProfit)}</strong>
            {" · "}Pending: <strong style={{ color: "var(--outgoing)" }}>{pendingAmount < 1 ? "< ₹1" : fmt(pendingAmount)}</strong>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="pp-amt">Amount paid (₹) *</label>
              <input
                id="pp-amt"
                className={`form-input ${errors.amountStr ? "form-input--error" : ""}`}
                type="number"
                min="1"
                value={form.amountStr}
                onChange={(e) => set("amountStr", e.target.value)}
                autoFocus
              />
              {errors.amountStr && <span className="form-error">{errors.amountStr}</span>}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="pp-date">Date paid *</label>
              <input
                id="pp-date"
                className={`form-input ${errors.paidDate ? "form-input--error" : ""}`}
                type="date"
                value={form.paidDate}
                onChange={(e) => set("paidDate", e.target.value)}
              />
              {errors.paidDate && <span className="form-error">{errors.paidDate}</span>}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="pp-notes">Notes</label>
            <textarea
              id="pp-notes"
              className="form-input form-textarea"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="e.g. Monthly profit payment"
            />
          </div>

          {/* ── Partial payment option ── */}
          <div style={{
            background: isPartial ? "var(--warning-soft, #fff8e1)" : "var(--surface)",
            border: `1px solid ${isPartial ? "var(--warning, #f59e0b)" : "var(--border)"}`,
            borderRadius: 8,
            padding: "12px 14px",
            transition: "all 0.15s",
            marginBottom: 8,
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={isPartial}
                onChange={(e) => {
                  setIsPartial(e.target.checked);
                  if (!e.target.checked) {
                    setRemainingAmtStr("");
                    setRemainingPercent("");
                  }
                }}
                style={{ width: 16, height: 16, accentColor: "var(--warning, #f59e0b)", cursor: "pointer" }}
              />
              <div>
                <span style={{ fontWeight: 700, fontSize: 13, color: isPartial ? "var(--warning, #b45309)" : "var(--text)" }}>
                  This is a partial payment
                </span>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>
                  More profit for this capital is still owed — allocation stays in pending list.
                </p>
              </div>
            </label>

            {isPartial && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
                  Specify the remaining profit owed (optional — leave blank to auto-calculate from expected %).
                </p>
                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label" htmlFor="pp-remaining-amt">
                      Remaining amount (₹) <span className="form-label__optional">(optional)</span>
                    </label>
                    <input
                      id="pp-remaining-amt"
                      className={`form-input ${errors.remainingAmtStr ? "form-input--error" : ""}`}
                      type="number"
                      min="0"
                      value={remainingAmtStr}
                      onChange={(e) => {
                        setRemainingAmtStr(e.target.value);
                        if (e.target.value) setRemainingPercent(""); // clear % if amount entered
                        setErrors((err) => ({ ...err, remainingAmtStr: undefined as unknown as string }));
                      }}
                      placeholder={computedRemaining !== null ? String(computedRemaining) : "e.g. 1500"}
                    />
                    {errors.remainingAmtStr && <span className="form-error">{errors.remainingAmtStr}</span>}
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="pp-remaining-pct">
                      Or remaining % rate <span className="form-label__optional">(optional)</span>
                    </label>
                    <input
                      id="pp-remaining-pct"
                      className={`form-input ${errors.remainingPercent ? "form-input--error" : ""}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={remainingPercent}
                      onChange={(e) => {
                        setRemainingPercent(e.target.value);
                        if (e.target.value) setRemainingAmtStr(""); // clear amount if % entered
                        setErrors((err) => ({ ...err, remainingPercent: undefined as unknown as string }));
                      }}
                      placeholder="e.g. 1.5"
                    />
                    {errors.remainingPercent && <span className="form-error">{errors.remainingPercent}</span>}
                  </div>
                </div>
                {/* Show auto-calculated preview */}
                {computedRemaining !== null && computedRemaining > 0 && (
                  <p style={{ fontSize: 11, color: "var(--warning, #b45309)", marginTop: 6 }}>
                    Remaining will be recorded as <strong>{fmt(computedRemaining)}</strong>
                    {remainingAmtStr === "" && remainingPercent === "" ? " (auto-calculated)" : ""}.
                  </p>
                )}
                {computedRemaining === null && remainingPercent !== "" && (
                  <p style={{ fontSize: 11, color: "var(--warning, #b45309)", marginTop: 6 }}>
                    Remaining will be stored as <strong>{remainingPercent}% rate</strong> — pending amount will be calculated from capital.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Reinvest / Recur capital option ── */}
          <div style={{
            background: reinvest ? "var(--accent-soft, #e8f5f0)" : "var(--surface)",
            border: `1px solid ${reinvest ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 8,
            padding: "12px 14px",
            transition: "all 0.15s",
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={reinvest}
                onChange={(e) => setReinvest(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }}
              />
              <div>
                <span style={{ fontWeight: 700, fontSize: 13, color: reinvest ? "var(--accent)" : "var(--text)" }}>
                  Principal will recur (capital stays deployed)
                </span>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>
                  Capital is reinvested and continues earning profit next month — not being returned.
                </p>
              </div>
            </label>
            {reinvest && (
              <div style={{ marginTop: 12 }}>
                <label className="form-label" htmlFor="pp-new-return" style={{ display: "block", marginBottom: 4 }}>
                  New return obligation date <span className="form-label__optional">(optional)</span>
                </label>
                <input
                  id="pp-new-return"
                  className="form-input"
                  type="date"
                  value={newReturnDate}
                  min={form.paidDate}
                  onChange={(e) => setNewReturnDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit">
              <CheckCircle2 size={15} />
              {isPartial ? "Record Partial Payment" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Allocation table row ─────────────────────────────────────────────────────

function AllocationRow({
  a,
  onPay,
  isNextMonth,
  canEdit,
}: {
  a: ReturnType<typeof import("../useStore").useStore>["allocationSummaries"][number];
  onPay: () => void;
  isNextMonth?: boolean;
  canEdit?: boolean;
}) {
  const amount = isNextMonth ? a.nextMonthProfit : a.profitPending;
  const isSmallAmount = amount > 0 && amount < 1;
  const showPartialBadge = !isNextMonth && a.isPartiallyPaid && a.profitPending > 0;

  return (
    <tr className="table-row">
      <td className="table-cell">
        <Link className="entity-link" to={`/partners/${a.partnerId}`}>
          {a.partner?.name ?? a.partnerId}
        </Link>
      </td>
      <td className="table-cell table-cell--money" data-label="Capital"><strong>{fmt(a.amountRupees)}</strong></td>
      <td className="table-cell" data-label="Rate">
        <span className="party-type-chip party-type-chip--partner">{a.profitPercent}% p.m.</span>
      </td>
      <td className="table-cell table-cell--secondary" data-label="Since">{formatDate(a.receivedDate)}</td>
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
            Paid: {fmt(a.totalProfitPaid)} · Expected: {fmt(a.expectedMonthlyProfit)}
          </span>
        )}
      </td>
      <td className="table-cell table-cell--action">
        {!isNextMonth && canEdit && (
          <button className="pay-btn" type="button" onClick={onPay}>
            <CheckCircle2 size={13} />
            {showPartialBadge ? `Pay ${isSmallAmount ? "< ₹1" : fmt(amount)} more` : `Pay ${isSmallAmount ? "< ₹1" : fmt(amount)}`}
          </button>
        )}
      </td>
    </tr>
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
  const { allocationSummaries, partners } = useStore();
  const { isCFO } = useRole();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [filterPartnerId, setFilterPartnerId] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const currentMonth = getMonthLabel(0);
  const nextMonth = getMonthLabel(1);

  // Global search filter function
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

  // Current month: allocations where profit is still pending (including partial payments)
  const currentPending = useMemo(() => allocationSummaries
    .filter((a) => !a.isFullyReturned && a.capitalOutstanding > 0 && a.profitPending > 0)
    .filter((a) => filterPartnerId === "ALL" || a.partnerId === filterPartnerId)
    .filter(matchesSearch)
    .sort((a, b) => b.profitPending - a.profitPending),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allocationSummaries, filterPartnerId, searchQuery]);

  // Next month: recur allocations where this month is fully paid (not partial)
  const nextMonthPending = useMemo(() => allocationSummaries
    .filter((a) => !a.isFullyReturned && a.nextMonthProfit > 0)
    .filter((a) => filterPartnerId === "ALL" || a.partnerId === filterPartnerId)
    .filter(matchesSearch)
    .sort((a, b) => b.nextMonthProfit - a.nextMonthProfit),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allocationSummaries, filterPartnerId, searchQuery]);

  const totalCurrentPending = currentPending.reduce((s, a) => s + a.profitPending, 0);
  const totalNextMonthPending = nextMonthPending.reduce((s, a) => s + a.nextMonthProfit, 0);
  const totalAllPending = totalCurrentPending + totalNextMonthPending;

  const payingAlloc = payingId ? allocationSummaries.find((a) => a.id === payingId) : null;
  const payingPartner = payingAlloc ? partners.find((p) => p.id === payingAlloc.partnerId) : null;

  const hasAny = currentPending.length > 0 || nextMonthPending.length > 0;

  // Pagination for current month section
  const currentTotalPages = Math.max(1, Math.ceil(currentPending.length / PAGE_SIZE));
  const currentPaginated = currentPending.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterPartnerId, searchQuery]);

  // Count partially paid allocations for section label
  const partialCount = currentPending.filter((a) => a.isPartiallyPaid).length;

  function handleExportCSV() {
    const allRows = [
      ...currentPending.map((a) => [
        a.partner?.name ?? a.partnerId,
        a.amountRupees,
        `${a.profitPercent}% p.m.`,
        a.receivedDate,
        a.profitPending,
        a.expectedMonthlyProfit,
        a.isPartiallyPaid ? "Partial" : "Full",
        currentMonth,
        (a.notes ?? "").replace(/\s*WA_CONFIRMED\s*/g, "").trim(),
      ]),
      ...nextMonthPending.map((a) => [
        a.partner?.name ?? a.partnerId,
        a.amountRupees,
        `${a.profitPercent}% p.m.`,
        a.receivedDate,
        a.nextMonthProfit,
        a.expectedMonthlyProfit,
        "Upcoming",
        nextMonth,
        (a.notes ?? "").replace(/\s*WA_CONFIRMED\s*/g, "").trim(),
      ]),
    ];
    downloadCSV(
      csvFilename("pending-profits"),
      ["Partner", "Capital (₹)", "Rate", "Since", "Profit Pending (₹)", "Expected / Month (₹)", "Status", "Month", "Notes"],
      allRows,
    );
  }

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Profit obligations"
        title="Pending Profits"
        description="All allocations with profit pending or upcoming. Record payments directly from here."
        actions={
          hasAny ? (
            <button className="button button--secondary" type="button" onClick={handleExportCSV}>
              <Download size={15} /> Export CSV
            </button>
          ) : undefined
        }
      />

      {payingAlloc && payingId && (
        <RecordProfitModal
          allocationId={payingId}
          partnerId={payingAlloc.partnerId}
          pendingAmount={payingAlloc.profitPending}
          expectedMonthlyProfit={payingAlloc.expectedMonthlyProfit}
          allocationLabel={`${payingPartner?.name ?? "—"} — ${fmt(payingAlloc.amountRupees)} @ ${payingAlloc.profitPercent}% p.m.`}
          {...(payingPartner?.name !== undefined ? { partnerName: payingPartner.name } : {})}
          partnerPhone={payingPartner?.phone ?? null}
          capitalOutstanding={payingAlloc.capitalOutstanding}
          profitPercent={payingAlloc.profitPercent}
          onClose={() => setPayingId(null)}
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
          </div>
          <div className="filter-bar__trailing">
            <span className="record-count" style={{ color: "var(--outgoing)" }}>
              Total pending: <strong>{fmt(totalAllPending)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3-column summary strip */}
      {hasAny && (
        <div className="ledger-summary" style={{ marginBottom: 20 }}>
          <div className="ledger-summary__item">
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
              {currentMonth}
            </span>
            <strong style={{ fontSize: 18, color: "var(--outgoing)" }}>{fmt(totalCurrentPending)}</strong>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {currentPending.length} allocation{currentPending.length !== 1 ? "s" : ""}
              {partialCount > 0 && (
                <span style={{ color: "var(--warning, #b45309)", marginLeft: 4 }}>
                  ({partialCount} partial)
                </span>
              )}
            </span>
          </div>
          <div className="ledger-summary__divider" />
          <div className="ledger-summary__item">
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
              {nextMonth} <RefreshCw size={10} style={{ verticalAlign: "middle" }} />
            </span>
            <strong style={{ fontSize: 18, color: "var(--accent)" }}>{fmt(totalNextMonthPending)}</strong>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{nextMonthPending.length} recurring</span>
          </div>
          <div className="ledger-summary__divider" />
          <div className="ledger-summary__item">
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>Total pending</span>
            <strong style={{ fontSize: 18, color: "var(--outgoing)" }}>{fmt(totalAllPending)}</strong>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{currentPending.length + nextMonthPending.length} allocations</span>
          </div>
        </div>
      )}

      {/* ── Current Month Section ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--outgoing)" }}>
            {currentMonth} — Profit Pending
          </h3>
          {currentPending.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>({currentPending.length})</span>
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

        <div className="table-wrapper">
          <table className="data-table" aria-label="Current month pending profits">
            <thead>
              <tr>
                <th className="table-th">Partner</th>
                <th className="table-th table-th--money">Capital</th>
                <th className="table-th">Rate</th>
                <th className="table-th">Since</th>
                <th className="table-th">Notes</th>
                <th className="table-th table-th--money">Profit pending</th>
                <th className="table-th table-th--action"><span className="sr-only">Pay</span></th>
              </tr>
            </thead>
            <tbody>
              {currentPending.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="table-empty">
                      <span className="empty-state__icon"><TrendingUp size={22} /></span>
                      <h3>All caught up!</h3>
                      <p>No profit payments pending for {currentMonth}.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentPaginated.map((a) => (
                  <AllocationRow key={a.id} a={a} onPay={() => setPayingId(a.id)} canEdit={isCFO} />
                ))
              )}
            </tbody>
            {currentPaginated.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)" }}>
                  <td className="table-cell" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>TOTAL</td>
                  <td className="table-cell table-cell--money" style={{ fontWeight: 700 }}>{fmt(currentPending.reduce((s, a) => s + a.amountRupees, 0))}</td>
                  <td className="table-cell" colSpan={3} />
                  <td className="table-cell table-cell--money" style={{ color: "var(--outgoing)", fontWeight: 700 }}>{fmt(totalCurrentPending)}</td>
                  <td className="table-cell" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={currentTotalPages}
          totalItems={currentPending.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* ── Next Month Section ── */}
      {nextMonthPending.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <RefreshCw size={14} style={{ color: "var(--accent)" }} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
              {nextMonth} — Upcoming (Recurring)
            </h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>({nextMonthPending.length})</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -4, marginBottom: 10 }}>
            These allocations had profit paid with the "Principal will recur" option — capital stays deployed and next month's profit is upcoming.
          </p>

          <div className="table-wrapper">
            <table className="data-table" aria-label="Next month pending profits">
              <thead>
                <tr>
                  <th className="table-th">Partner</th>
                  <th className="table-th table-th--money">Capital</th>
                  <th className="table-th">Rate</th>
                  <th className="table-th">Since</th>
                  <th className="table-th">Notes</th>
                  <th className="table-th table-th--money">Expected next month</th>
                  <th className="table-th table-th--action"><span className="sr-only">—</span></th>
                </tr>
              </thead>
              <tbody>
                {nextMonthPending.map((a) => (
                  <AllocationRow key={a.id} a={a} onPay={() => setPayingId(a.id)} isNextMonth />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)" }}>
                  <td className="table-cell" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>TOTAL</td>
                  <td className="table-cell table-cell--money" style={{ fontWeight: 700 }}>{fmt(nextMonthPending.reduce((s, a) => s + a.amountRupees, 0))}</td>
                  <td className="table-cell" colSpan={3} />
                  <td className="table-cell table-cell--money" style={{ color: "var(--accent)", fontWeight: 700 }}>{fmt(totalNextMonthPending)}</td>
                  <td className="table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Empty state when nothing pending at all */}
      {!hasAny && (
        <div className="table-empty" style={{ paddingTop: 48 }}>
          <span className="empty-state__icon"><TrendingUp size={28} /></span>
          <h3>No pending profits</h3>
          <p>All profit obligations are settled. Add capital contributions to start tracking.</p>
        </div>
      )}
    </div>
  );
}
