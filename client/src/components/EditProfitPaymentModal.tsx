import { ProfitSplitPreview, profitPreview, profitOptions } from './ProfitSplitPreview';
import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { getAllocations, updateProfitRecord, type ProfitRecord } from "../store";
const fmt = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

function workflowFreeNotes(notes: string): string {
  return notes
    .replace(/\s*·?\s*Capital reinvested/g, "")
    .replace(/\s*·?\s*Partial payment · Remaining: ₹[\d,]+/g, "")
    .replace(/\s*·?\s*Partial payment · Remaining %: [\d.]+%/g, "")
    .replace(/\s*·?\s*Partial payment/g, "")
    .replace(/\s*·?\s*WA_CONFIRMED\s*/g, " ")
    .replace(/\s*·\s*·\s*/g, " · ")
    .trim();
}

function initialPartialRemaining(notes: string): string {
  const match = notes.match(/Partial payment · Remaining: ₹([\d,]+)/);
  return match?.[1]?.replace(/,/g, "") ?? "";
}

// ─── Edit Profit Payment Modal ───────────────────────────────────────────────

export function EditProfitPaymentModal({
  record,
  expectedMonthlyProfit,
  onClose,
}: {
  record: ProfitRecord;
  expectedMonthlyProfit: number;
  onClose: () => void;
}) {
  const capital = record.profitCapitalRupees ?? getAllocations().find(a => a.id === record.allocationId)?.amountRupees;
  const [customPercent, setCustomPercent] = useState<string | null>(record.partnerAmountRupees !== undefined ? `amount:${record.partnerAmountRupees}` : record.noCfoSplit ? 'no-cfo' : record.partnerProfitPercent === undefined ? null : String(record.partnerProfitPercent));
  const [amountStr, setAmountStr] = useState(String(record.combinedAmountRupees ?? record.amountRupees));
  const [paidDate, setPaidDate] = useState(record.paidDate);
  const [notes, setNotes] = useState(() => workflowFreeNotes(record.notes || ""));
  const [isPartial, setIsPartial] = useState(() => (record.notes || "").includes("Partial payment"));
  const [remainingStr, setRemainingStr] = useState(() => initialPartialRemaining(record.notes || ""));
  const [remainingPercent, setRemainingPercent] = useState(() => record.notes.match(/Remaining %: ([\d.]+)%/)?.[1] ?? "");
  const [recurring, setRecurring] = useState(() => (record.notes || "").includes("Capital reinvested"));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const amount = Number(amountStr);
    const preview = profitPreview(amount, capital, customPercent);
    if (record.combinedAmountRupees !== undefined && preview.error) return setError(preview.error);
    const partnerAmount = record.combinedAmountRupees !== undefined ? preview.split!.amountRupees : amount;
    const remaining = remainingStr.trim() === "" ? Math.max(0, expectedMonthlyProfit - partnerAmount) : Math.round(Number(remainingStr));
    if (!Number.isSafeInteger(amount) || amount <= 0) return setError("Enter a valid amount.");
    if (!paidDate) return setError("Payment date is required.");
    if (isPartial && (!Number.isFinite(remaining) || remaining < 0)) return setError("Enter a valid remaining amount.");

    if (isPartial && remainingPercent !== "" && (!Number.isFinite(Number(remainingPercent)) || Number(remainingPercent) < 0 || Number(remainingPercent) > 100)) return setError("Enter a remaining percentage from 0 to 100.");

    const noteParts = notes.trim() ? [notes.trim()] : [];
    if (recurring) noteParts.push("Capital reinvested");
    if (isPartial) noteParts.push(remainingPercent !== "" ? `Partial payment · Remaining %: ${Number(remainingPercent)}%` : `Partial payment · Remaining: ₹${remaining.toLocaleString("en-IN")}`);
    if (record.notes.includes("WA_CONFIRMED")) noteParts.push("WA_CONFIRMED");

    setSaving(true);
    try {
      await updateProfitRecord(record.id, { amountRupees: amount, ...(record.combinedAmountRupees !== undefined ? { ...profitOptions(customPercent) } : {}), paidDate, notes: noteParts.join(" · ") });
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save payment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-profit-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="edit-profit-title"><Pencil size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Edit Profit Payment</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="edit-profit-amount">{record.combinedAmountRupees !== undefined ? 'Partner + CFO amount' : 'Amount paid'} (₹) *</label>
              <input id="edit-profit-amount" className="form-input" type="number" min="1" value={amountStr} onChange={(e) => { setAmountStr(e.target.value); setError(""); }} autoFocus />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="edit-profit-date">Paid date *</label>
              <input id="edit-profit-date" className="form-input" type="date" value={paidDate} onChange={(e) => { setPaidDate(e.target.value); setError(""); }} />
            </div>
          </div>
          {record.combinedAmountRupees !== undefined && <ProfitSplitPreview amount={Number(amountStr)} capital={capital} customPercent={customPercent} onPercentChange={setCustomPercent} disabled={saving} />}
          <label className="checkbox-row">
            <input type="checkbox" checked={isPartial} onChange={(e) => setIsPartial(e.target.checked)} />
            <span><strong>This was a partial payment</strong><small>Keep the remaining profit due.</small></span>
          </label>
          {isPartial && (
            <div className="form-field" style={{ marginTop: 10 }}>
              <label className="form-label" htmlFor="edit-profit-remaining">Profit still due (₹)</label>
              <input id="edit-profit-remaining" className="form-input" type="number" min="0" value={remainingStr} onChange={(e) => { setRemainingStr(e.target.value); setRemainingPercent(""); }} placeholder={`Auto: ${fmt(Math.max(0, expectedMonthlyProfit - (record.combinedAmountRupees !== undefined && Number.isSafeInteger(Number(amountStr)) && Number(amountStr) > 0 ? profitPreview(Number(amountStr), capital, customPercent).split?.amountRupees ?? 0 : Number(amountStr) || 0)))}`} />
              <label className="form-label" htmlFor="edit-profit-percent">Or remaining profit rate (%)</label>
              <input id="edit-profit-percent" className="form-input" type="number" min="0" max="100" step="0.01" value={remainingPercent} onChange={(e) => { setRemainingPercent(e.target.value); setRemainingStr(""); }} />
              <span className="form-label__optional">Leave both blank to calculate from the expected monthly profit.</span>
            </div>
          )}
          <label className="checkbox-row" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            <span><strong>Principal will recur</strong><small>Keep capital deployed and create the next month&apos;s profit obligation.</small></span>
          </label>
          <div className="form-field" style={{ marginTop: 12 }}>
            <label className="form-label" htmlFor="edit-profit-notes">Notes</label>
            <textarea id="edit-profit-notes" className="form-input form-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment reference or note…" />
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={saving}>{saving ? "Saving…" : <><Pencil size={14} />Save changes</>}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
