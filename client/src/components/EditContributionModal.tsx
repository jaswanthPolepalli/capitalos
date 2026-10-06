import { OptionalDateInput } from "./OptionalDateInput";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CreditCard as CreditCardIcon, Edit2, X } from "lucide-react";
import { SearchableSelect } from "./SearchableSelect";
import { formatDate } from "../lib/format";
import { updateAllocation, computeNextDueDate, type CreditCard } from "../store";
import type { useStore } from "../useStore";
const fmt = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export function EditContributionModal({
  allocation,
  creditCards,
  partners,
  onClose,
}: {
  allocation: ReturnType<typeof useStore>["allocationSummaries"][0];
  creditCards: CreditCard[];
  partners: { id: string; name: string }[];
  onClose: () => void;
}) {
  const partnerCards = creditCards.filter((c) => c.partnerId === allocation.partnerId);
  const [form, setForm] = useState({
    amountStr: String(allocation.amountRupees),
    profitPercentStr: String(allocation.profitPercent),
    receivedDate: allocation.receivedDate,
    creditCardId: allocation.creditCardId || "",
    returnDate: allocation.returnDate || "",
    notes: allocation.notes.replace(/\s*·?\s*WA_CONFIRMED\s*/g, " ").trim(),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const selectedCard = partnerCards.find((c) => c.id === form.creditCardId);

  // When card changes, offer to auto-update return date
  function handleCardChange(newCardId: string) {
    if (allocation.combination) return;
    setForm((p) => ({ ...p, creditCardId: newCardId }));
    if (newCardId) {
      const card = partnerCards.find((c) => c.id === newCardId);
      if (card && form.receivedDate) {
        setForm((p) => ({ ...p, returnDate: computeNextDueDate(card, p.receivedDate) }));
      }
    }
  }

  function set(field: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.amountStr || !Number.isFinite(Number(form.amountStr)) || Number(form.amountStr) <= 0) next.amountStr = "Enter a valid amount";
    else if (Number(form.amountStr) < allocation.totalCapitalReturned) next.amountStr = `Amount cannot be below ${fmt(allocation.totalCapitalReturned)} already returned`;
    if (!form.profitPercentStr || !Number.isFinite(Number(form.profitPercentStr)) || Number(form.profitPercentStr) < 0 || Number(form.profitPercentStr) > 100) next.profitPercentStr = "Enter profit % (0–100)";
    if (!form.receivedDate) next.receivedDate = "Required";
    if (form.returnDate && form.returnDate < form.receivedDate) next.returnDate = "Return date cannot be before the date given";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await updateAllocation(allocation.id, {
        amountRupees: Math.round(Number(form.amountStr)),
        profitPercent: Number(form.profitPercentStr),
        receivedDate: form.receivedDate,
        returnDate: form.returnDate || null,
        creditCardId: form.creditCardId || null,
        notes: [form.notes.trim(), allocation.notes.includes("WA_CONFIRMED") ? "WA_CONFIRMED" : ""].filter(Boolean).join(" · "),
      });
      onClose();
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Unable to save contribution.' });
    } finally {
      setSaving(false);
    }
  }

  const partner = partners.find((p) => p.id === allocation.partnerId);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-contrib-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="edit-contrib-title">
            <Edit2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Edit Contribution
          </h2>
          <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="form-hint" style={{ marginBottom: 12 }}>
            Editing the individual contribution for <strong>{partner?.name ?? allocation.partnerId}</strong>. Its historic returns and profit payments remain linked to this contribution.
          </div>
          {errors.submit && <p className="form-error" role="alert">{errors.submit}</p>}
          {allocation.combination && <p className="form-hint">This combined entry’s amount, effective date and funding source are fixed. Its profit rate, return date and notes can be edited.</p>}

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="ec-amount" className="form-label">Original contribution amount (₹) *</label>
              <input id="ec-amount" disabled={!!allocation.combination} className={`form-input ${errors.amountStr ? "form-input--error" : ""}`} type="number" min="1" value={form.amountStr} onChange={(e) => set("amountStr", e.target.value)} />
              {errors.amountStr && <span className="form-error">{errors.amountStr}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="ec-rate" className="form-label">Profit % per month *</label>
              <input id="ec-rate" className={`form-input ${errors.profitPercentStr ? "form-input--error" : ""}`} type="number" min="0" max="100" step="0.01" value={form.profitPercentStr} onChange={(e) => set("profitPercentStr", e.target.value)} />
              {errors.profitPercentStr && <span className="form-error">{errors.profitPercentStr}</span>}
            </div>
          </div>

          <div className="form-hint" style={{ marginBottom: 12 }}>
            <dl style={{ display: "flex", flexWrap: "wrap", gap: 24, margin: "0 0 8px" }}>
              <div>
                <dt>Returned</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{fmt(allocation.totalCapitalReturned)}</dd>
              </div>
              <div>
                <dt>Outstanding</dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{fmt(allocation.capitalOutstanding)}</dd>
              </div>
            </dl>
            These are the currently saved balances. Returns are recorded separately and do not reduce the original contribution amount.
          </div>

          <div className="form-field">
            <label htmlFor="ec-received" className="form-label">Date given *</label>
            <input id="ec-received" disabled={!!allocation.combination} className={`form-input ${errors.receivedDate ? "form-input--error" : ""}`} type="date" value={form.receivedDate} onChange={(e) => set("receivedDate", e.target.value)} />
            {errors.receivedDate && <span className="form-error">{errors.receivedDate}</span>}
          </div>

          {/* Credit card linkage */}
          <div className="form-field">
            <label htmlFor="ec-card" className="form-label">
              <CreditCardIcon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Payment source
            </label>
            <SearchableSelect
              id="ec-card"
              options={[
                { value: "", label: "Cash / Bank transfer", sublabel: "Default" },
                ...partnerCards.map((c) => ({
                  value: c.id,
                  label: c.cardName,
                  sublabel: `Limit: ${fmt(c.cardLimit)}`,
                })),
              ]}
              value={form.creditCardId}
              onChange={handleCardChange}
              placeholder="Cash / Bank transfer"
              searchPlaceholder="Search cards…"
            />
            {partnerCards.length === 0 && (
              <span className="form-label__optional" style={{ fontSize: 11, marginTop: 3, display: "block" }}>
                No credit cards for this partner.{" "}
                <Link to="/credit-cards" style={{ color: "var(--accent)" }}>Add one →</Link>
              </span>
            )}
            {selectedCard && (
              <div className="form-hint" style={{ marginTop: 6 }}>
                <CalendarClock size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Bill gen: {formatDate(selectedCard.billGenerationDate)} · Due: {formatDate(selectedCard.dueDate)}
                <br />
                Auto-computed return date from date given ({formatDate(form.receivedDate)}): <strong>{computeNextDueDate(selectedCard, form.receivedDate)}</strong>
              </div>
            )}
          </div>

          {/* Return date */}
          <div className="form-field">
            <label htmlFor="ec-return-date" className="form-label">
              Return date
              {selectedCard && <span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 6 }}>(editable — auto-filled from card)</span>}
              <span className="form-label__optional"> (optional)</span>
            </label>
            <OptionalDateInput
              id="ec-return-date"
              className="form-input"
              value={form.returnDate}
              min={form.receivedDate}
              disabled={saving}
              onValueChange={(value) => set("returnDate", value)}
            />
            {errors.returnDate && <span className="form-error">{errors.returnDate}</span>}

          </div>

          <div className="form-field">
            <label htmlFor="ec-notes" className="form-label">Notes</label>
            <textarea id="ec-notes" className="form-input form-textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Reference, tranche, or other note…" />
          </div>

          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : <><Edit2 size={14} /> Save changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
