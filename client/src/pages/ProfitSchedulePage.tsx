import { paidRateLabel } from "../lib/profitDisplay";
import { EarningsSummary } from '../components/EarningsSummary';
import {
  CalendarClock,
  CheckCircle2,
  PlusCircle,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { formatDate } from "../lib/format";
import type { AddProfitRecordInput } from "../store";
import { useStore } from "../useStore";
import { UpiPaymentPanel, emptyUpiPayment, upiPaymentNote, type UpiPaymentState } from "../components/UpiPaymentPanel";

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// ─── Record Profit Payment Modal ──────────────────────────────────────────────

function RecordProfitModal({
  onClose,
  onSave,
  allocationSummaries,
  partners,
  defaultAllocationId = "",
}: {
  onClose: () => void;
  onSave: (input: AddProfitRecordInput) => void;
  allocationSummaries: ReturnType<typeof useStore>["allocationSummaries"];
  partners: ReturnType<typeof useStore>["partners"];
  defaultAllocationId?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    allocationId: defaultAllocationId || allocationSummaries[0]?.id || "",
    amountStr: "",
    paidDate: today,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [upiState, setUpiState] = useState<UpiPaymentState>(emptyUpiPayment);

  const selectedAlloc = allocationSummaries.find((a) => a.id === form.allocationId);
  const partner = selectedAlloc ? partners.find((p) => p.id === selectedAlloc.partnerId) : undefined;

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.allocationId) e.allocationId = "Select an allocation";
    const amt = Number(form.amountStr);
    if (!form.amountStr || isNaN(amt) || amt <= 0) e.amountStr = "Enter a valid amount";
    if (!form.paidDate) e.paidDate = "Date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    if (!selectedAlloc) return;
    onSave({
      allocationId: form.allocationId,
      partnerId: selectedAlloc.partnerId,
      amountRupees: Math.round(Number(form.amountStr)),
      paidDate: form.paidDate,
      notes: [form.notes, upiPaymentNote(upiState)].filter(Boolean).join(" · "),
    });
    onClose();
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined as unknown as string }));
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="record-profit-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="record-profit-title">Record Profit Payment</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="pr-alloc" className="form-label">Allocation *</label>
            <select
              id="pr-alloc"
              className={`form-input ${errors.allocationId ? "form-input--error" : ""}`}
              value={form.allocationId}
              onChange={(e) => set("allocationId", e.target.value)}
            >
              <option value="">Select allocation…</option>
              {allocationSummaries.map((a) => {
                const p = partners.find((pt) => pt.id === a.partnerId);
                return (
                  <option key={a.id} value={a.id}>
                    {p?.name ?? a.partnerId} — {fmt(a.amountRupees)} @ {a.profitPercent}%
                  </option>
                );
              })}
            </select>
            {errors.allocationId && <span className="form-error">{errors.allocationId}</span>}
          </div>

          {selectedAlloc && (
            <div className="form-hint">
              Partner: <strong>{partner?.name}</strong> ·
              Capital: <strong>{fmt(selectedAlloc.amountRupees)}</strong> ·
              Profit pending: <strong style={{ color: "var(--pending)" }}>{fmt(selectedAlloc.profitPending)}</strong>
            </div>
          )}

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="pr-amount" className="form-label">Amount paid (₹) *</label>
              <input
                id="pr-amount"
                className={`form-input ${errors.amountStr ? "form-input--error" : ""}`}
                type="number"
                min="1"
                step="1"
                value={form.amountStr}
                onChange={(e) => set("amountStr", e.target.value)}
                placeholder={selectedAlloc ? String(Math.round(selectedAlloc.profitPending)) : ""}
              />
              {errors.amountStr && <span className="form-error">{errors.amountStr}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="pr-date" className="form-label">Payment date *</label>
              <input
                id="pr-date"
                className={`form-input ${errors.paidDate ? "form-input--error" : ""}`}
                type="date"
                value={form.paidDate}
                onChange={(e) => set("paidDate", e.target.value)}
              />
              {errors.paidDate && <span className="form-error">{errors.paidDate}</span>}
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="pr-notes" className="form-label">Notes</label>
            <textarea
              id="pr-notes"
              className="form-input form-textarea"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="e.g. Q1 profit, bank transfer ref…"
              rows={2}
            />
          </div>
          <UpiPaymentPanel amount={form.amountStr} onAmountChange={amount => set("amountStr", amount)} partnerName={partner?.name} initialPayee={partner?.phone} onStateChange={setUpiState} />

          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={upiState.enabled && !upiState.confirmed}>
              <CheckCircle2 size={16} />
              {upiState.enabled ? "Mark successful and record" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Profit Schedule page ─────────────────────────────────────────────────────

export function ProfitSchedulePage() {
  const { allocationSummaries, partners, profitRecords, addProfitRecord } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [filterPartnerId, setFilterPartnerId] = useState("ALL");

  const filtered =
    filterPartnerId === "ALL"
      ? allocationSummaries
      : allocationSummaries.filter((a) => a.partnerId === filterPartnerId);

  const totalPending = filtered.reduce((s, a) => s + a.profitPending, 0);
  const totalPaid = filtered.reduce((s, a) => s + a.totalProfitPaid, 0);

  // Profit records sorted newest first
  const recentPayments = [...profitRecords]
    .filter((r) => filterPartnerId === "ALL" || r.partnerId === filterPartnerId)
    .sort((a, b) => b.paidDate.localeCompare(a.paidDate))
    .slice(0, 20);

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Profit obligations"
        title="Profit Schedule"
        description="Track accrued profit per capital allocation, pending payments, and payment history."
        actions={
          <button className="button button--primary" type="button" onClick={() => setShowModal(true)}>
            <PlusCircle size={16} />
            Record Payment
          </button>
        }
      />

      {showModal && (
        <RecordProfitModal
          onClose={() => setShowModal(false)}
          onSave={(input) => addProfitRecord(input)}
          allocationSummaries={allocationSummaries}
          partners={partners}
        />
      )}

      <div className="list-page__toolbar">
        <div className="filter-bar">
          <div className="filter-bar__controls">
            <select
              className="select-filter__control"
              aria-label="Filter by partner"
              value={filterPartnerId}
              onChange={(e) => setFilterPartnerId(e.target.value)}
            >
              <option value="ALL">All partners</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-bar__trailing">
            <span className="record-count" style={{ color: "var(--pending)" }}>
              Pending: <strong>{fmt(totalPending)}</strong>
            </span>
            <span className="record-count" style={{ color: "var(--incoming)" }}>
              · Paid: <strong>{fmt(totalPaid)}</strong>
            </span>
          </div>
        </div>
      </div>

      <EarningsSummary allocations={filtered} regularProfit={totalPaid} />
      {/* Per-allocation accrual table */}
      <section aria-labelledby="accrual-title">
        <h2 id="accrual-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
          Accrued profit by allocation
        </h2>
        <div className="table-wrapper" style={{ marginBottom: 24 }}>
          <table className="data-table" aria-label="Accrued profit by allocation">
            <thead>
              <tr>
                <th className="table-th">Partner</th>
                <th className="table-th table-th--money">Capital</th>
                <th className="table-th">Rate</th>
                <th className="table-th">Since</th>
                <th className="table-th">Return date</th>
                <th className="table-th table-th--money">Profit accrued</th>
                <th className="table-th table-th--money">Regular profit paid</th><th className="table-th table-th--money">Cashback paid</th><th className="table-th table-th--money">Total profits received</th>
                <th className="table-th table-th--money">Pending</th>
                <th className="table-th table-th--action"><span className="sr-only">Pay</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="table-empty">
                      <span className="empty-state__icon"><TrendingUp size={22} /></span>
                      <h3>No allocations</h3>
                      <p>Record a capital contribution first to see profit accrual.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr className="table-row" key={a.id}>
                    <td className="table-cell">
                      <Link className="entity-link" to={`/partners/${a.partnerId}`}>
                        {a.partner?.name ?? a.partnerId}
                      </Link>
                    </td>
                    <td className="table-cell table-cell--money"><strong>{fmt(a.amountRupees)}</strong></td>
                    <td className="table-cell">
                      <span className="party-type-chip party-type-chip--partner">{a.profitPercent}% p.m.</span>
                    </td>
                    <td className="table-cell table-cell--secondary">{formatDate(a.receivedDate)}</td>
                    <td className="table-cell table-cell--secondary">
                      {a.returnDate ? (
                        <span style={{ color: "var(--pending)" }}>
                          <CalendarClock size={13} style={{ verticalAlign: "middle", marginRight: 3 }} />
                          {formatDate(a.returnDate)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--text-soft)" }}>
                      {fmt(a.profitAccrued)}
                    </td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--incoming)" }}>
                      {fmt(a.totalProfitPaid)}
                    </td><td className="table-cell table-cell--money" data-label="Cashback paid">{a.creditCardId ? a.unknownCashbackCount ? 'Amount not recorded' : fmt(a.totalCashbackPaid) : '—'}</td><td className="table-cell table-cell--money" data-label="Total profits received">{fmt(a.totalProfitsReceived)}{a.unknownCashbackCount > 0 && <small> + unrecorded cashback</small>}</td>
                     <td className="table-cell table-cell--money">
                      <span style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                        <strong style={{ color: a.profitPending > 0 ? "var(--pending)" : "var(--muted)" }}>
                          {fmt(a.profitPending)}
                        </strong>
                        {a.isPartiallyPaid && a.profitPending > 0 && (
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
                    </td>
                    <td className="table-cell table-cell--action">
                      {a.profitPending > 0 && (
                        <button
                          className="icon-button"
                          type="button"
                          title="Record payment"
                          onClick={() => setShowModal(true)}
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent payment history */}
      {recentPayments.length > 0 && (
        <section aria-labelledby="history-title">
          <h2 id="history-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
            Payment history
          </h2>
      <div className="table-wrapper">
            <table className="data-table" aria-label="Profit payment history">
              <thead>
                <tr>
                  <th className="table-th">Partner</th>
                  <th className="table-th">Allocation</th>
                  <th className="table-th">Date paid</th>
                  <th className="table-th table-th--money">Amount</th>
                  <th className="table-th">Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((r) => {
                  const alloc = allocationSummaries.find((a) => a.id === r.allocationId);
                  const partner = partners.find((p) => p.id === r.partnerId);
                  return (
                    <tr className="table-row" key={r.id}>
                      <td className="table-cell">
                        <Link className="entity-link" to={`/partners/${r.partnerId}`}>
                          {partner?.name ?? r.partnerId}
                        </Link>
                      </td>
                      <td className="table-cell table-cell--secondary">
                        {alloc ? `${fmt(alloc.amountRupees)} · ${paidRateLabel(r, alloc)}` : r.allocationId}
                      </td>
                      <td className="table-cell table-cell--secondary">{formatDate(r.paidDate)}</td>
                      <td className="table-cell table-cell--money" style={{ color: "var(--incoming)" }}>
                        <strong>{fmt(r.amountRupees)}</strong>
                      </td>
                      <td className="table-cell table-cell--secondary">{(r.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
