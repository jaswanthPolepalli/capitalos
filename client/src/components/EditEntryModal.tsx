import { CashbackModal } from './CashbackModal';
import { useState } from "react";
import { X } from "lucide-react";
import { EditContributionModal } from "./EditContributionModal";
import { EditProfitPaymentModal } from "./EditProfitPaymentModal";
import { getCreditCards, getPartners, getProfitRecords, updateCapitalReturn, type AllocationSummary, type LedgerEvent } from "../store";

/** One editor per record type, shared by ledger and partner histories. */
export function EditEntryModal({ event, allocationSummaries, onClose }: {
  event: LedgerEvent;
  allocationSummaries: AllocationSummary[];
  onClose: () => void;
}) {
  const allocation = allocationSummaries.find(a => a.id === event.allocationId);
  const [amount, setAmount] = useState(String(event.amountRupees));
  const [date, setDate] = useState(event.date);
  const [notes, setNotes] = useState(event.notes);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (event.eventType === "CASHBACK_PAID" && allocation) return <CashbackModal allocation={allocation} onClose={onClose} />;
  if (event.eventType === "PROFIT_PAID") {
    const record = getProfitRecords().find(r => r.id === event.refId);
    if (record) return <EditProfitPaymentModal record={record} expectedMonthlyProfit={allocation?.currentCycleProfit ?? 0} onClose={onClose} />;
  }
  if (event.eventType === "CAPITAL_RECEIVED" && allocation) {
    return <EditContributionModal allocation={allocation} partners={getPartners()} creditCards={getCreditCards()} onClose={onClose} />;
  }
  if (event.eventType !== "CAPITAL_RETURNED") {
    return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Record unavailable"><div className="modal"><div className="modal__body"><p role="alert">This record is no longer available. Refresh the page to load the latest records.</p><button className="button button--secondary" onClick={onClose}>Close</button></div></div></div>;
  }
  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) return setError("Enter a valid amount.");
    if (!date) return setError("Return date is required.");
    if (allocation && value > allocation.amountRupees - allocation.totalCapitalReturned + event.amountRupees) return setError("Return amount exceeds the available capital.");
    if (allocation && date < allocation.receivedDate) return setError("Return date cannot be before the contribution date.");
    setSaving(true);
    try {
      await updateCapitalReturn(event.refId, { amountRupees: value, returnedDate: date, notes });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save return.");
    } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-return-title">
    <div className="modal">
      <div className="modal__header"><h2 id="edit-return-title">Edit Capital Return</h2><button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Close"><X size={18} /></button></div>
      <form className="modal__body" onSubmit={save}>
        <div className="form-field"><label className="form-label" htmlFor="return-amount">Amount returned (₹)</label><input id="return-amount" className="form-input" type="number" min="1" required value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <div className="form-field"><label className="form-label" htmlFor="return-date">Date returned</label><input id="return-date" className="form-input" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="form-field"><label className="form-label" htmlFor="return-notes">Notes</label><textarea id="return-notes" className="form-input" value={notes} onChange={e => setNotes(e.target.value)} /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal__footer"><button className="button button--secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button><button className="button button--primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
      </form>
    </div>
  </div>;
}
