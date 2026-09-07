/**
 * BulkPaymentPage — F1: Bulk Payment Recording ("Pay All Pending" flow)
 *
 * Multi-step workflow:
 *   Step 1 — Select: checklist of all pending profit obligations
 *   Step 2 — Review: confirm amounts, add optional refs/notes
 *   Step 3 — Confirm: post all in one action
 */

import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  IndianRupee,
  Loader2,
  Square,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { amountToWords } from "../lib/amountWords";
import { addProfitRecord } from "../store";
import { useStore } from "../useStore";
import { useRole } from "../context/RoleContext";

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentItem {
  allocationId: string;
  partnerId: string;
  partnerName: string;
  allocationLabel: string;
  pendingAmount: number;
  selected: boolean;
  /** Editable fields for review step */
  editedAmount: string;
  date: string;
  notes: string;
  referenceNumber: string;
}

type Step = "select" | "review" | "posting" | "done";

// ─── Step 1 — Select ─────────────────────────────────────────────────────────

function SelectStep({
  items,
  onToggle,
  onToggleAll,
  onNext,
}: {
  items: PaymentItem[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onNext: () => void;
}) {
  const selectedCount = items.filter((i) => i.selected).length;
  const totalSelected = items.filter((i) => i.selected).reduce((s, i) => s + i.pendingAmount, 0);
  const allSelected = items.length > 0 && selectedCount === items.length;

  return (
    <div>
      <div className="bulk-step-header">
        <div>
          <h2>Step 1 — Select payments</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Choose which profit obligations to pay in this cycle. Deselect any you want to skip.
          </p>
        </div>
        {selectedCount > 0 && (
          <div className="bulk-total-chip">
            <IndianRupee size={14} />
            <strong>{fmt(totalSelected)}</strong>
            <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>({selectedCount} selected)</span>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 48 }}>
          <span className="empty-state__icon"><TrendingUp size={28} /></span>
          <h3>No pending profits</h3>
          <p>All profit obligations are settled.</p>
          <Link className="button button--secondary" to="/pending-profits">View profit schedule</Link>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table" aria-label="Select payments">
              <thead>
                <tr>
                  <th className="table-th" style={{ width: 40 }}>
                    <button
                      type="button"
                      className="icon-button"
                      style={{ width: 24, height: 24, minWidth: 24 }}
                      onClick={onToggleAll}
                      aria-label={allSelected ? "Deselect all" : "Select all"}
                      title={allSelected ? "Deselect all" : "Select all"}
                    >
                      {allSelected
                        ? <CheckSquare size={16} style={{ color: "var(--accent)" }} />
                        : <Square size={16} style={{ color: "var(--muted)" }} />
                      }
                    </button>
                  </th>
                  <th className="table-th">Partner</th>
                  <th className="table-th">Allocation</th>
                  <th className="table-th table-th--money">Pending profit</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.allocationId}
                    className={`table-row${item.selected ? " table-row--selected" : ""}`}
                    onClick={() => onToggle(item.allocationId)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="icon-button"
                        style={{ width: 24, height: 24, minWidth: 24 }}
                        onClick={() => onToggle(item.allocationId)}
                        aria-label={item.selected ? "Deselect" : "Select"}
                      >
                        {item.selected
                          ? <CheckSquare size={16} style={{ color: "var(--accent)" }} />
                          : <Square size={16} style={{ color: "var(--muted)" }} />
                        }
                      </button>
                    </td>
                    <td className="table-cell">
                      <span className="entity-link">{item.partnerName}</span>
                    </td>
                    <td className="table-cell" style={{ color: "var(--muted)", fontSize: 12 }}>
                      {item.allocationLabel}
                    </td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--outgoing)", fontWeight: 700 }}>
                      {fmt(item.pendingAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)" }}>
                  <td className="table-cell" colSpan={3} style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                    TOTAL SELECTED ({selectedCount} of {items.length})
                  </td>
                  <td className="table-cell table-cell--money" style={{ color: "var(--outgoing)", fontWeight: 700 }}>
                    {fmt(totalSelected)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, gap: 12 }}>
            <Link className="button button--secondary" to="/">Cancel</Link>
            <button
              className="button button--primary"
              type="button"
              onClick={onNext}
              disabled={selectedCount === 0}
            >
              Review {selectedCount} payment{selectedCount !== 1 ? "s" : ""}
              <ChevronRight size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step 2 — Review ──────────────────────────────────────────────────────────

function ReviewStep({
  items,
  onChange,
  onBack,
  onConfirm,
}: {
  items: PaymentItem[];
  onChange: (allocationId: string, field: string, value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const selected = items.filter((i) => i.selected);
  const totalAmount = selected.reduce((s, i) => s + (Number(i.editedAmount) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);

  const hasError = selected.some((i) => {
    const amt = Number(i.editedAmount);
    return !i.editedAmount || isNaN(amt) || amt <= 0;
  });

  return (
    <div>
      <div className="bulk-step-header">
        <div>
          <h2>Step 2 — Review payments</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Adjust amounts if needed. Add reference numbers and notes for each payment.
          </p>
        </div>
        <div className="bulk-total-chip">
          <IndianRupee size={14} />
          <strong style={{ color: totalAmount > 0 ? "var(--outgoing)" : "var(--muted)" }}>{fmt(totalAmount)}</strong>
          <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>total</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {selected.map((item) => {
          const amtNum = Number(item.editedAmount);
          const amtValid = !isNaN(amtNum) && amtNum > 0;
          return (
            <div key={item.allocationId} className="bulk-review-card">
              <div className="bulk-review-card__header">
                <div>
                  <strong>{item.partnerName}</strong>
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{item.allocationLabel}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Suggested: <strong style={{ color: "var(--outgoing)" }}>{fmt(item.pendingAmount)}</strong>
                </span>
              </div>
              <div className="form-row" style={{ marginTop: 10 }}>
                <div className="form-field">
                  <label className="form-label" htmlFor={`amt-${item.allocationId}`}>Amount (₹) *</label>
                  <input
                    id={`amt-${item.allocationId}`}
                    className={`form-input ${!amtValid && item.editedAmount ? "form-input--error" : ""}`}
                    type="number"
                    min="1"
                    value={item.editedAmount}
                    onChange={(e) => onChange(item.allocationId, "editedAmount", e.target.value)}
                  />
                  {amtValid && amtNum > 0 && (
                    <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, display: "block" }}>
                      {amountToWords(amtNum)}
                    </span>
                  )}
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor={`date-${item.allocationId}`}>Date *</label>
                  <input
                    id={`date-${item.allocationId}`}
                    className="form-input"
                    type="date"
                    value={item.date || today}
                    onChange={(e) => onChange(item.allocationId, "date", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor={`ref-${item.allocationId}`}>Reference <span className="form-label__optional">(opt)</span></label>
                  <input
                    id={`ref-${item.allocationId}`}
                    className="form-input"
                    type="text"
                    value={item.referenceNumber}
                    onChange={(e) => onChange(item.allocationId, "referenceNumber", e.target.value)}
                    placeholder="UTR / ref no."
                  />
                </div>
              </div>
              <div className="form-field" style={{ marginTop: 8 }}>
                <label className="form-label" htmlFor={`notes-${item.allocationId}`}>Notes <span className="form-label__optional">(opt)</span></label>
                <input
                  id={`notes-${item.allocationId}`}
                  className="form-input"
                  type="text"
                  value={item.notes}
                  onChange={(e) => onChange(item.allocationId, "notes", e.target.value)}
                  placeholder="e.g. Monthly profit — June 2026"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total summary */}
      <div className="bulk-confirm-summary">
        <IndianRupee size={18} style={{ color: "var(--outgoing)" }} />
        <span>Total payout: </span>
        <strong style={{ fontSize: 20, color: "var(--outgoing)" }}>{fmt(totalAmount)}</strong>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>across {selected.length} partner{selected.length !== 1 ? "s" : ""}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, gap: 12 }}>
        <button className="button button--secondary" type="button" onClick={onBack}>← Back</button>
        <button
          className="button button--primary"
          type="button"
          onClick={onConfirm}
          disabled={hasError || totalAmount <= 0}
        >
          <CheckCircle2 size={15} />
          Post {selected.length} payment{selected.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 — Done ────────────────────────────────────────────────────────────

function DoneStep({ count, total }: { count: number; total: number }) {
  return (
    <div className="empty-state" style={{ paddingTop: 64 }}>
      <span className="empty-state__icon" style={{ color: "var(--incoming)" }}>
        <CheckCircle2 size={40} />
      </span>
      <h3 style={{ color: "var(--incoming)" }}>Payments posted!</h3>
      <p>
        Successfully recorded <strong>{count}</strong> profit payment{count !== 1 ? "s" : ""} totalling <strong>{fmt(total)}</strong>.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <Link className="button button--secondary" to="/pending-profits">View pending profits</Link>
        <Link className="button button--primary" to="/">Back to dashboard</Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function BulkPaymentPage() {
  const { allocationSummaries } = useStore();
  const { isCFO } = useRole();
  const [step, setStep] = useState<Step>("select");
  const [doneCount, setDoneCount] = useState(0);
  const [doneTotal, setDoneTotal] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  // Build initial payment items from pending allocations
  const initialItems = useMemo<PaymentItem[]>(() =>
    allocationSummaries
      .filter((a) => !a.isFullyReturned && a.profitPending > 0)
      .map((a) => ({
        allocationId: a.id,
        partnerId: a.partnerId,
        partnerName: a.partner?.name ?? a.partnerId,
        allocationLabel: `${fmt(a.amountRupees)} @ ${a.profitPercent}% p.m.`,
        pendingAmount: a.profitPending,
        selected: true,
        editedAmount: String(Math.round(a.profitPending)),
        date: today,
        notes: "",
        referenceNumber: "",
      }))
      .sort((a, b) => b.pendingAmount - a.pendingAmount),
  [allocationSummaries, today]);

  const [items, setItems] = useState<PaymentItem[]>(() => initialItems);

  // Sync items if store changes while on select step
  const pendingItems = useMemo(() =>
    allocationSummaries
      .filter((a) => !a.isFullyReturned && a.profitPending > 0),
  [allocationSummaries]);

  function toggle(id: string) {
    setItems((prev) => prev.map((i) => i.allocationId === id ? { ...i, selected: !i.selected } : i));
  }

  function toggleAll() {
    const allSelected = items.every((i) => i.selected);
    setItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })));
  }

  function handleChange(allocationId: string, field: string, value: string) {
    setItems((prev) => prev.map((i) => i.allocationId === allocationId ? { ...i, [field]: value } : i));
  }

  async function handlePost() {
    const selected = items.filter((i) => i.selected);
    setStep("posting");
    let count = 0;
    let total = 0;
    for (const item of selected) {
      const amt = Math.round(Number(item.editedAmount));
      if (amt <= 0) continue;
      const notes = [item.notes.trim(), item.referenceNumber ? `Ref: ${item.referenceNumber}` : ""].filter(Boolean).join(" · ");
      try {
        await addProfitRecord({
          allocationId: item.allocationId,
          partnerId: item.partnerId,
          amountRupees: amt,
          paidDate: item.date || today,
          notes: notes || "Bulk profit payment",
        });
        count++;
        total += amt;
      } catch (err) {
        console.error(`[BulkPay] Failed for ${item.partnerName}:`, err);
      }
    }
    setDoneCount(count);
    setDoneTotal(total);
    setStep("done");
  }

  const stepIndex = step === "select" ? 1 : step === "review" ? 2 : step === "posting" ? 3 : 3;

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Payment cycle"
        title="Bulk Payment"
        description="Pay all pending profit obligations in one go."
      />

      {/* Progress stepper */}
      {step !== "done" && (
        <div className="bulk-stepper">
          {[
            { n: 1, label: "Select" },
            { n: 2, label: "Review" },
            { n: 3, label: "Post" },
          ].map(({ n, label }) => (
            <div
              key={n}
              className={`bulk-step${stepIndex === n ? " bulk-step--active" : stepIndex > n ? " bulk-step--done" : ""}`}
            >
              <span className="bulk-step__num">
                {stepIndex > n ? <CheckCircle2 size={14} /> : n}
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* CEO read-only notice */}
      {!isCFO && (
        <div className="attention-banner" style={{ marginBottom: 24, borderColor: "var(--accent)", background: "var(--accent-soft, #e8f5f0)" }}>
          <AlertTriangle size={16} style={{ color: "var(--accent)" }} />
          <span style={{ color: "var(--accent)" }}>
            <strong>Read-only view.</strong> Unlock the CFO workspace to record bulk payments.
          </span>
        </div>
      )}

      {/* Attention banner if no pending */}
      {isCFO && pendingItems.length === 0 && step === "select" && (
        <div className="attention-banner" style={{ marginBottom: 24 }}>
          <AlertTriangle size={16} />
          <span>No pending profit obligations found. All payments are up to date.</span>
        </div>
      )}

      {isCFO && step === "select" && (
        <SelectStep
          items={items}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onNext={() => setStep("review")}
        />
      )}
      {step === "review" && (
        <ReviewStep
          items={items}
          onChange={handleChange}
          onBack={() => setStep("select")}
          onConfirm={handlePost}
        />
      )}
      {step === "posting" && (
        <div className="empty-state" style={{ paddingTop: 64 }}>
          <Loader2 size={36} style={{ color: "var(--accent)", animation: "spin 1s linear infinite" }} />
          <h3>Posting payments…</h3>
          <p>Recording {items.filter((i) => i.selected).length} profit payments. Please wait.</p>
        </div>
      )}
      {step === "done" && <DoneStep count={doneCount} total={doneTotal} />}
    </div>
  );
}
