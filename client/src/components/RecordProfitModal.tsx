import { CloseProfitPanel } from './CloseProfitPanel';
import { CheckCircle2, MessageCircle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { buildProfitPaymentWhatsAppLink } from "../lib/whatsapp";
import { getAllocations, addProfitRecord, updateAllocationReturnDate, type AddProfitRecordInput } from "../store";

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);
}

export function RecordProfitModal({
  allocationId, partnerId, pendingAmount, expectedMonthlyProfit, allocationLabel, partnerPhone, partnerName, capitalOutstanding, profitPercent, fundingSource, cardName, amountGivenDate, canRecur = true, embedded = false, onClose,
}: {
  allocationId: string;
  partnerId: string;
  pendingAmount: number;
  expectedMonthlyProfit: number;
  allocationLabel: string;
  canRecur?: boolean;
  embedded?: boolean;
  partnerPhone?: string | null;
  partnerName?: string;
  capitalOutstanding?: number;
  profitPercent?: number;
  fundingSource?: "cash" | "card";
  cardName?: string | null;
  amountGivenDate?: string | null;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const capitalReturned = capitalOutstanding === 0;
  const remainingBasis = pendingAmount > 0 ? pendingAmount : expectedMonthlyProfit;
  const [form, setForm] = useState({
    amountStr: pendingAmount > 0 ? String(Math.max(1, Math.round(pendingAmount))) : "",
    paidDate: today,
    notes: "",
  });
  const [closing, setClosing] = useState(false);
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
    return Math.max(0, remainingBasis - paidAmt);
  }, [isPartial, remainingAmtStr, remainingPercent, remainingBasis, paidAmt]);

  function validate() {
    const e: Record<string, string> = {};
    const amt = Number(form.amountStr);
    if (!form.amountStr || isNaN(amt) || amt <= 0) e.amountStr = "Enter a valid amount";
    if (!form.paidDate) e.paidDate = "Required";
    if (capitalReturned && isPartial && pendingAmount <= 0 && remainingAmtStr.trim() === "") {
      e.remainingAmtStr = "Enter the profit amount still owed after this payment.";
    }
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
        const autoRemaining = Math.max(0, remainingBasis - paidAmt);
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

    try {
      await addProfitRecord(input);
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Unable to record payment.' });
      return;
    }

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

  if (closing) return <CloseProfitPanel allocationId={allocationId} partnerId={partnerId} pendingAmount={pendingAmount} partnerName={partnerName} canRecur={canRecur && capitalOutstanding !== 0} embedded={embedded} onCancel={() => setClosing(false)} onClose={onClose} />;

  // ── Post-submit: show WhatsApp share option ──
  if (submitted) {
    const waLink = buildProfitPaymentWhatsAppLink({
      partnerName: partnerName ?? "Partner",
      partnerPhone: partnerPhone ?? null,
      amountRupees: submittedAmount,
      paidDate: submittedDate,
      contributionAmountRupees: getAllocations().find(a => a.id === allocationId)?.amountRupees ?? null,
      capitalOutstanding: capitalOutstanding ?? null,
      profitPercent: profitPercent ?? null,
      fundingSource: fundingSource ?? null,
      cardName: cardName ?? null,
      amountGivenDate: amountGivenDate ?? null,
    });

    return (
      <div className={embedded ? "overview-payment" : "modal-backdrop"} role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : true} aria-labelledby="pp-done-title">
        <div className="modal">
          <div className="modal__header">
            <h2 id="pp-done-title" style={{ color: "var(--incoming)", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={18} /> Payment Recorded
            </h2>
            <button className="icon-button" onClick={onClose} type="button" aria-label="Close profit form"><X size={18} /></button>
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
    <div className={embedded ? "overview-payment" : "modal-backdrop"} role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : true} aria-labelledby="pp-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="pp-title">Record Profit Payment</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close profit form"><X size={18} /></button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          {pendingAmount > 0 && <button type="button" className="button button--secondary" onClick={() => setClosing(true)}>Close profit without payment</button>}
          {errors.submit && <p className="form-error" role="alert">{errors.submit}</p>}
          <div className="form-hint">
            Allocation: <strong>{allocationLabel}</strong>
            {!capitalReturned && <>{" · "}Expected: <strong>{fmt(expectedMonthlyProfit)}</strong></>}
            {" · "}Pending: <strong style={{ color: "var(--outgoing)" }}>{pendingAmount > 0 && pendingAmount < 1 ? "< ₹1" : fmt(pendingAmount)}</strong>
            {capitalReturned && <p>Capital is fully returned. Enter the actual profit paid for this contribution.</p>}
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
                  Enter the profit still owed after this payment. If a pending balance is shown, leave blank to subtract this payment from it.
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
                  {!capitalReturned && <div className="form-field">
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
                  </div>}
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
                disabled={!canRecur || capitalReturned}
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
