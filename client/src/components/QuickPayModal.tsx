import { ProfitSplitPreview, profitPreview, profitOptions } from './ProfitSplitPreview';
import { combinedForPartner } from '../../../functions/capitalos-api/profit-sharing.mjs';
/**
 * QuickPayModal — F3: Quick-Pay from Dashboard
 *
 * Inline modal to record a single profit or principal payment
 * without navigating away from the current page.
 */

import { CheckCircle2, X } from "lucide-react";
import { useState } from "react";

import { amountToWords } from "../lib/amountWords";
import { getAllocations, addCapitalReturn, addProfitRecord } from "../store";

export type QuickPayType = "profit" | "capital";

export interface QuickPayTarget {
  allocationId: string;
  partnerId: string;
  partnerName: string;
  payType: QuickPayType;
  pendingAmount: number;
  allocationLabel: string;
}

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

const PAYMENT_METHODS = ["NEFT", "RTGS", "IMPS", "UPI", "Cash", "Cheque"] as const;

export function QuickPayModal({
  target,
  onClose,
}: {
  target: QuickPayTarget;
  onClose: () => void;
}) {
  const capital = getAllocations().find(a => a.id === target.allocationId)?.amountRupees;
  const [customPercent, setCustomPercent] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    amountStr: String(Math.max(1, target.payType === 'profit' ? combinedForPartner(target.pendingAmount) : Math.round(target.pendingAmount))),
    date: today,
    method: "NEFT",
    referenceNumber: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const amountNum = Number(form.amountStr);
  const amountValid = Number.isSafeInteger(amountNum) && amountNum > 0;

  function validate() {
    const e: Record<string, string> = {};
    if (!form.amountStr || !amountValid) e.amountStr = "Enter a valid amount";
    if (target.payType === 'profit') { const preview = profitPreview(amountNum, capital, customPercent); if (preview.error) e.submit = preview.error; }
    if (!form.date) e.date = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const notes = [form.notes.trim(), form.referenceNumber ? `Ref: ${form.referenceNumber}` : ""].filter(Boolean).join(" · ");
      if (target.payType === "profit") {
        await addProfitRecord({
          allocationId: target.allocationId,
          partnerId: target.partnerId,
          amountRupees: Math.round(amountNum),
          paidDate: form.date,
          ...profitOptions(customPercent),
          notes: notes || "Profit paid",
        });
      } else {
        await addCapitalReturn({
          allocationId: target.allocationId,
          partnerId: target.partnerId,
          amountRupees: Math.round(amountNum),
          returnedDate: form.date,
          notes: notes || "Capital returned",
        });
      }
      onClose();
    } catch (err) {
      console.error("[QuickPay] Error:", err);
      setErrors({ submit: "Failed to record payment. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const set = (f: string, v: string) => {
    setForm((p) => ({ ...p, [f]: v }));
    setErrors((e) => ({ ...e, [f]: "" }));
  };

  const typeLabel = target.payType === "profit" ? "Profit Payment" : "Capital Return";
  const typeColor = target.payType === "profit" ? "var(--outgoing)" : "var(--pending)";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="qp-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="qp-title" style={{ color: typeColor }}>
            <CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Quick Pay — {typeLabel}
          </h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          {/* Context */}
          <div className="form-hint" style={{ marginBottom: 14 }}>
            <strong>{target.partnerName}</strong>
            <span style={{ color: "var(--muted)", marginLeft: 6 }}>·</span>
            <span style={{ marginLeft: 6, color: "var(--muted)", fontSize: 12 }}>{target.allocationLabel}</span>
            {target.pendingAmount > 0 && (
              <span style={{ marginLeft: 8, color: typeColor, fontWeight: 700 }}>
                Pending: {fmt(target.pendingAmount)}
              </span>
            )}
          </div>

          {/* Amount + Date */}
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="qp-amt">{target.payType === 'profit' ? 'Partner + CFO amount' : 'Amount'} (₹) *</label>
              <input
                id="qp-amt"
                className={`form-input ${errors.amountStr ? "form-input--error" : ""}`}
                type="number"
                min="1"
                value={form.amountStr}
                onChange={(e) => set("amountStr", e.target.value)}
                autoFocus
              />
              {errors.amountStr && <span className="form-error">{errors.amountStr}</span>}
              {amountValid && amountNum > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, display: "block" }}>
                  {amountToWords(amountNum)}
                </span>
              )}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="qp-date">Date *</label>
              <input
                id="qp-date"
                className={`form-input ${errors.date ? "form-input--error" : ""}`}
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
              {errors.date && <span className="form-error">{errors.date}</span>}
            </div>
          </div>

          {target.payType === 'profit' && <ProfitSplitPreview amount={amountNum} capital={capital} customPercent={customPercent} onPercentChange={setCustomPercent} disabled={saving} />}
          {/* Method + Reference */}
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="qp-method">Payment method</label>
              <select
                id="qp-method"
                className="form-input"
                value={form.method}
                onChange={(e) => set("method", e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="qp-ref">
                Reference number <span className="form-label__optional">(optional)</span>
              </label>
              <input
                id="qp-ref"
                className="form-input"
                type="text"
                value={form.referenceNumber}
                onChange={(e) => set("referenceNumber", e.target.value)}
                placeholder="UTR / Cheque no."
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-field">
            <label className="form-label" htmlFor="qp-notes">Notes <span className="form-label__optional">(optional)</span></label>
            <textarea
              id="qp-notes"
              className="form-input form-textarea"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="e.g. Monthly profit — June 2026"
            />
          </div>

          {errors.submit && (
            <div className="form-error" style={{ marginTop: 4 }}>{errors.submit}</div>
          )}

          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? "Posting…" : (
                <><CheckCircle2 size={15} /> Post {typeLabel}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
