import { CloseProfitPanel } from '../components/CloseProfitPanel';
import { paidRateLabel, monthlyPayout } from "../lib/profitDisplay";
import { EarningsSummary } from '../components/EarningsSummary';
import { PaymentSelectionActions } from '../components/PaymentSelectionActions';
import { RecordRow } from "../components/RecordRow";
import { OptionalDateInput } from "../components/OptionalDateInput";
import { EditEntryModal } from "../components/EditEntryModal";
import type { LedgerEvent } from "../store";
import {
  ArrowLeft,
  ArrowDownLeft,
  CalendarClock,
  CheckCircle2,
  CreditCard as CreditCardIcon,
  Edit2,
  FileText,
  IndianRupee,
  MessageCircle,
  PlusCircle,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { formatDate } from "../lib/format";
import { buildProfitPaymentWhatsAppLink } from "../lib/whatsapp";
import {
  getAllocations, addAllocation, addCapitalReturn, addProfitRecord, computeNextDueDate, updateAllocationReturnDate, updatePartner,
  type AddAllocationInput, type AddCapitalReturnInput, type AddProfitRecordInput, type CreditCard,
} from "../store";
import { useStore } from "../useStore";
import { useRole } from "../context/RoleContext";
import { amountToWords } from "../lib/amountWords";
import { SearchableSelect } from "../components/SearchableSelect";

// ─── Delete Partner Confirmation Modal ────────────────────────────────────────

function DeletePartnerModal({
  partnerName,
  allocationCount,
  onConfirm,
  onClose,
  isDeleting,
}: {
  partnerName: string;
  allocationCount: number;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="del-partner-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="del-partner-title" style={{ color: "var(--outgoing)" }}>
            <Trash2 size={17} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Delete Partner
          </h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close" disabled={isDeleting}>
            ✕
          </button>
        </div>
        <div className="modal__body">
          <p style={{ marginBottom: 12 }}>
            Are you sure you want to delete <strong>{partnerName}</strong>?
          </p>
          {allocationCount > 0 && (
            <div className="form-hint" style={{ borderLeft: "3px solid var(--outgoing)", paddingLeft: 10, marginBottom: 12 }}>
              This partner has <strong>{allocationCount} capital allocation{allocationCount !== 1 ? "s" : ""}</strong> and all associated returns and profit records.
              All related data will also be soft-deleted and removed from the dashboard.
            </div>
          )}
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            This is a <strong>soft delete</strong> — no data is permanently removed from the database.
            The partner and all related records will be marked as deleted and hidden from all views.
          </p>
        </div>
        <div className="modal__footer">
          <button className="button button--secondary" type="button" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button
            className="button button--danger"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{ minWidth: 120 }}
          >
            {isDeleting ? (
              "Deleting…"
            ) : (
              <><Trash2 size={15} /> Delete Partner</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// ─── Add Contribution Modal ───────────────────────────────────────────────────

function AddContributionModal({ partnerId, partnerCards, onClose }: { partnerId: string; partnerCards: CreditCard[]; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ amountStr: "", profitPercentStr: "3", receivedDate: today, returnDate: "", creditCardId: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-populate return date + profit % when card or received date or amount changes
  function handleCreditCardChange(cardId: string) {
    setForm((p) => {
      if (cardId) {
        const card = partnerCards.find((c) => c.id === cardId);
        const nextDue = card ? computeNextDueDate(card, p.receivedDate || today) : p.returnDate;
        // Suggest profit % for card: ≤2,00,000 → 4%, >2,00,000 → 3.5%
        const amt = Number(p.amountStr);
        const suggestedProfit = amt > 0 ? (amt <= 200000 ? "4" : "3.5") : p.profitPercentStr;
        return { ...p, creditCardId: cardId, returnDate: nextDue || p.returnDate, profitPercentStr: suggestedProfit };
      }
      return { ...p, creditCardId: "" };
    });
  }

  function handleAmountChange(v: string) {
    set("amountStr", v);
    // If a card is selected, update the suggested profit % as amount changes
    setForm((p) => {
      if (p.creditCardId) {
        const amt = Number(v);
        if (amt > 0) {
          return { ...p, amountStr: v, profitPercentStr: amt <= 200000 ? "4" : "3.5" };
        }
      }
      return { ...p, amountStr: v };
    });
  }

  function handleReceivedDateChange(date: string) {
    setForm((p) => {
      if (p.creditCardId) {
        const card = partnerCards.find((c) => c.id === p.creditCardId);
        const nextDue = card ? computeNextDueDate(card, date) : p.returnDate;
        return { ...p, receivedDate: date, returnDate: nextDue || p.returnDate };
      }
      return { ...p, receivedDate: date };
    });
    setErrors((e) => ({ ...e, receivedDate: undefined as unknown as string }));
  }

  function validate() {
    const e: Record<string, string> = {};
    const amt = Number(form.amountStr);
    if (!form.amountStr || isNaN(amt) || amt <= 0) e.amountStr = "Enter a valid amount in ₹";
    const pct = Number(form.profitPercentStr);
    if (!form.profitPercentStr || isNaN(pct) || pct < 0 || pct > 100) e.profitPercentStr = "Enter profit % (0–100)";
    if (!form.receivedDate) e.receivedDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    const input: AddAllocationInput = {
      partnerId,
      amountRupees: Math.round(Number(form.amountStr)),
      profitPercent: Number(form.profitPercentStr),
      receivedDate: form.receivedDate,
      returnDate: form.returnDate || null,
      creditCardId: form.creditCardId || null,
      notes: form.notes,
    };
    addAllocation(input);
    onClose();
  }

  const set = (f: string, v: string) => { setForm((p) => ({ ...p, [f]: v })); setErrors((e) => ({ ...e, [f]: undefined as unknown as string })); };

  const selectedCard = partnerCards.find((c) => c.id === form.creditCardId);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ac-title">
      <div className="modal">
        <div className="modal__header"><h2 id="ac-title">Add Capital Contribution</h2><button className="icon-button" onClick={onClose} type="button"><IndianRupee size={16} /></button></div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="ac-amt">Amount (₹) *</label>
              <input id="ac-amt" className={`form-input ${errors.amountStr ? "form-input--error" : ""}`} type="number" min="1" value={form.amountStr} onChange={(e) => handleAmountChange(e.target.value)} placeholder="e.g. 500000" autoFocus />
              {errors.amountStr && <span className="form-error">{errors.amountStr}</span>}
              {form.amountStr && !isNaN(Number(form.amountStr)) && Number(form.amountStr) > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, display: "block" }}>{amountToWords(Number(form.amountStr))}</span>
              )}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="ac-pct">Profit % per month *</label>
              <input id="ac-pct" className={`form-input ${errors.profitPercentStr ? "form-input--error" : ""}`} type="number" min="0" max="100" step="0.1" value={form.profitPercentStr} onChange={(e) => set("profitPercentStr", e.target.value)} placeholder="e.g. 3" />
              {errors.profitPercentStr && <span className="form-error">{errors.profitPercentStr}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="ac-recv">Date received *</label>
              <input id="ac-recv" className={`form-input ${errors.receivedDate ? "form-input--error" : ""}`} type="date" value={form.receivedDate} onChange={(e) => handleReceivedDateChange(e.target.value)} />
              {errors.receivedDate && <span className="form-error">{errors.receivedDate}</span>}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="ac-ret">
                Return date
                {selectedCard && <span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 6 }}>(auto from card)</span>}
                {!selectedCard && <span className="form-label__optional"> (optional)</span>}
              </label>
              <input id="ac-ret" className="form-input" type="date" value={form.returnDate} min={form.receivedDate} onChange={(e) => set("returnDate", e.target.value)} />
            </div>
          </div>

          {/* Payment source / credit card selector */}
          <div className="form-field">
            <label className="form-label" htmlFor="ac-card">
              <CreditCardIcon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Payment source
            </label>
            <SearchableSelect
              id="ac-card"
              options={[
                { value: "", label: "Cash / Bank transfer", sublabel: "Default" },
                ...partnerCards.map((c) => ({
                  value: c.id,
                  label: c.cardName,
                  sublabel: `Limit: ₹${c.cardLimit.toLocaleString("en-IN")}`,
                })),
              ]}
              value={form.creditCardId}
              onChange={handleCreditCardChange}
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
                Bill gen: {formatDate(selectedCard.billGenerationDate)} · Due: {formatDate(selectedCard.dueDate)} · Return date auto-set to: <strong>{form.returnDate || "—"}</strong>
              </div>
            )}
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="ac-notes">Notes</label>
            <textarea id="ac-notes" className="form-input form-textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Tranche, reference…" />
          </div>
          {form.amountStr && form.profitPercentStr && (
            <div className="form-hint">Monthly profit: <strong>{fmt(Math.round(Number(form.amountStr) * Number(form.profitPercentStr) / 100))}</strong> · Annual: <strong>{fmt(Math.round(Number(form.amountStr) * Number(form.profitPercentStr) * 12 / 100))}</strong></div>
          )}
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit"><PlusCircle size={15} /> Add Contribution</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Record Capital Return Modal ──────────────────────────────────────────────

function RecordCapitalReturnModal({ allocationId, partnerId, capitalOutstanding, onClose }: { allocationId: string; partnerId: string; capitalOutstanding: number; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ amountStr: String(capitalOutstanding), returnedDate: today, notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    const amt = Number(form.amountStr);
    if (!form.amountStr || isNaN(amt) || amt <= 0) e.amountStr = "Enter a valid amount";
    if (amt > capitalOutstanding) e.amountStr = `Max outstanding: ${fmt(capitalOutstanding)}`;
    if (!form.returnedDate) e.returnedDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    const input: AddCapitalReturnInput = { allocationId, partnerId, amountRupees: Math.round(Number(form.amountStr)), returnedDate: form.returnedDate, notes: form.notes };
    addCapitalReturn(input);
    onClose();
  }

  const set = (f: string, v: string) => { setForm((p) => ({ ...p, [f]: v })); setErrors((e) => ({ ...e, [f]: undefined as unknown as string })); };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cr-title">
      <div className="modal">
        <div className="modal__header"><h2 id="cr-title">Record Capital Return</h2><button className="icon-button" onClick={onClose} type="button"><ArrowDownLeft size={16} /></button></div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          <div className="form-hint">Outstanding: <strong style={{ color: "var(--pending)" }}>{fmt(capitalOutstanding)}</strong></div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="cr-amt">Amount returned (₹) *</label>
              <input id="cr-amt" className={`form-input ${errors.amountStr ? "form-input--error" : ""}`} type="number" min="1" value={form.amountStr} onChange={(e) => set("amountStr", e.target.value)} autoFocus />
              {errors.amountStr && <span className="form-error">{errors.amountStr}</span>}
              {form.amountStr && !isNaN(Number(form.amountStr)) && Number(form.amountStr) > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, display: "block" }}>{amountToWords(Number(form.amountStr))}</span>
              )}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="cr-date">Date returned *</label>
              <input id="cr-date" className={`form-input ${errors.returnedDate ? "form-input--error" : ""}`} type="date" value={form.returnedDate} onChange={(e) => set("returnedDate", e.target.value)} />
              {errors.returnedDate && <span className="form-error">{errors.returnedDate}</span>}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="cr-notes">Notes</label>
            <textarea id="cr-notes" className="form-input form-textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Bank transfer ref, partial/full return…" />
          </div>
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit"><CheckCircle2 size={15} /> Record Return</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Record Profit Modal ──────────────────────────────────────────────────────

function RecordProfitModal({
  allocationId, partnerId, pendingAmount, partnerName, partnerPhone, capitalOutstanding, profitPercent, fundingSource, cardName, amountGivenDate, onClose,
}: {
  allocationId: string;
  partnerId: string;
  pendingAmount: number;
  partnerName?: string;
  partnerPhone?: string | null;
  capitalOutstanding?: number;
  profitPercent?: number;
  fundingSource?: "cash" | "card";
  cardName?: string | null;
  amountGivenDate?: string | null;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ amountStr: String(Math.round(pendingAmount)), paidDate: today, notes: "" });
  const [closing, setClosing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reinvest, setReinvest] = useState(false);
  const [newReturnDate, setNewReturnDate] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedAmount, setSubmittedAmount] = useState(0);
  const [submittedDate, setSubmittedDate] = useState(today);

  function validate() {
    const e: Record<string, string> = {};
    const amt = Number(form.amountStr);
    if (!form.amountStr || isNaN(amt) || amt <= 0) e.amountStr = "Enter a valid amount";
    if (!form.paidDate) e.paidDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    const notesWithTag = reinvest
      ? [form.notes.trim(), "Capital reinvested"].filter(Boolean).join(" · ")
      : form.notes;
    const input: AddProfitRecordInput = {
      allocationId,
      partnerId,
      amountRupees: Math.round(Number(form.amountStr)),
      paidDate: form.paidDate,
      notes: notesWithTag,
    };
    addProfitRecord(input);
    if (reinvest) {
      await updateAllocationReturnDate(allocationId, newReturnDate || null);
    }
    setSubmittedAmount(Math.round(Number(form.amountStr)));
    setSubmittedDate(form.paidDate);
    setSubmitted(true);
  }

  const set = (f: string, v: string) => { setForm((p) => ({ ...p, [f]: v })); setErrors((e) => ({ ...e, [f]: undefined as unknown as string })); };

  const fmt2 = (r: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(r);

  if (closing) return <CloseProfitPanel allocationId={allocationId} partnerId={partnerId} pendingAmount={pendingAmount} partnerName={partnerName} canRecur={(capitalOutstanding ?? 0) > 0} onCancel={() => setClosing(false)} onClose={onClose} />;

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
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rp-done-title">
        <div className="modal">
          <div className="modal__header">
            <h2 id="rp-done-title" style={{ color: "var(--incoming)", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={18} /> Payment Recorded
            </h2>
            <button className="icon-button" onClick={onClose} type="button">✕</button>
          </div>
          <div className="modal__body">
            <div style={{ background: "var(--incoming-soft)", border: "1px solid color-mix(in srgb, var(--incoming) 25%, var(--border))", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--incoming)" }}>
                ✓ {fmt2(submittedAmount)} profit payment recorded successfully
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                For {partnerName ?? "partner"} on {submittedDate}
              </p>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 12 }}>
              Share a payment confirmation with the partner on WhatsApp?
            </p>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="button button--primary"
              style={{ width: "100%", justifyContent: "center", background: "#25d366", borderColor: "#25d366", color: "#fff", textDecoration: "none" }}>
              <MessageCircle size={16} /> Share on WhatsApp
            </a>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>
              Opens WhatsApp with a pre-filled message. You send it.
            </p>
          </div>
          <div className="modal__footer">
            <button className="button button--primary" type="button" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rp-title">
      <div className="modal">
        <div className="modal__header"><h2 id="rp-title">Record Profit Payment</h2><button className="icon-button" onClick={onClose} type="button"><CheckCircle2 size={16} /></button></div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          {pendingAmount > 0 && <button type="button" className="button button--secondary" onClick={() => setClosing(true)}>Close profit without payment</button>}
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="rp-amt">Amount (₹) *</label>
              <input id="rp-amt" className={`form-input ${errors.amountStr ? "form-input--error" : ""}`} type="number" min="1" value={form.amountStr} onChange={(e) => set("amountStr", e.target.value)} autoFocus />
              {errors.amountStr && <span className="form-error">{errors.amountStr}</span>}
              {form.amountStr && !isNaN(Number(form.amountStr)) && Number(form.amountStr) > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, display: "block" }}>{amountToWords(Number(form.amountStr))}</span>
              )}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="rp-date">Date paid *</label>
              <input id="rp-date" className={`form-input ${errors.paidDate ? "form-input--error" : ""}`} type="date" value={form.paidDate} onChange={(e) => set("paidDate", e.target.value)} />
              {errors.paidDate && <span className="form-error">{errors.paidDate}</span>}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="rp-notes">Notes</label>
            <textarea id="rp-notes" className="form-input form-textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Q3 profit payment" />
          </div>

          {/* Reinvest / Recur capital option */}
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
                  Capital will be reinvested (rolled over)
                </span>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>
                  Capital stays deployed and continues earning profit — not being returned.
                </p>
              </div>
            </label>
            {reinvest && (
              <div style={{ marginTop: 12 }}>
                <label className="form-label" htmlFor="rp-new-return" style={{ display: "block", marginBottom: 4 }}>
                  New return obligation date <span className="form-label__optional">(optional)</span>
                </label>
                <input
                  id="rp-new-return"
                  className="form-input"
                  type="date"
                  value={newReturnDate}
                  min={form.paidDate}
                  onChange={(e) => setNewReturnDate(e.target.value)}
                  style={{ maxWidth: 200 }}
                />
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                  This will update the return date on the capital allocation.
                </p>
              </div>
            )}
          </div>

          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit"><CheckCircle2 size={15} /> Record Payment</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Partner Modal ───────────────────────────────────────────────────────

function EditPartnerModal({ partner, onClose }: { partner: { id: string; name: string; phone: string; email: string; notes: string }; onClose: () => void }) {
  const [form, setForm] = useState({ name: partner.name, phone: partner.phone, email: partner.email, notes: partner.notes });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      await updatePartner(partner.id, { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), notes: form.notes.trim() });
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const set = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ep-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="ep-title"><Edit2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Edit Partner</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">✕</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="ep-name">Name *</label>
              <input id="ep-name" className="form-input" type="text" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="ep-phone">Phone</label>
              <input id="ep-phone" className="form-input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="ep-email">Email</label>
            <input id="ep-email" className="form-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="ep-notes">Notes</label>
            <textarea id="ep-notes" className="form-input form-textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          {error && <p style={{ color: "var(--outgoing)", fontSize: 13, margin: "4px 0 0" }}>{error}</p>}
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={saving}>
              <Edit2 size={15} /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Return Date Modal ───────────────────────────────────────────────────

function EditReturnDateModal({ allocationId, currentReturnDate, onClose }: { allocationId: string; currentReturnDate: string | null; onClose: () => void }) {
  const [value, setValue] = useState(currentReturnDate ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      await updateAllocationReturnDate(allocationId, value || null);
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save return date."); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-ret-title">
      <div className="modal">
        <div className="modal__header"><h2 id="edit-ret-title">Edit Return Date</h2><button className="icon-button" onClick={onClose} type="button"><Edit2 size={16} /></button></div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="edit-ret-date" className="form-label">Return date <span className="form-label__optional">(leave blank to remove)</span></label>
            <OptionalDateInput id="edit-ret-date" className="form-input" value={value} onValueChange={setValue} disabled={saving} autoFocus />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={saving}><CalendarClock size={16} /> Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Partner Detail page ──────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "addContrib" }
  | { type: "editPartner" }
  | { type: "capitalReturn"; allocationId: string; capitalOutstanding: number }
  | { type: "profitPay"; allocationId: string; profitPending: number }
  | { type: "editReturn"; allocationId: string; currentReturnDate: string | null };

export function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ledger, allocationSummaries, profitRecords, capitalReturns, getPartner, deletePartner, getCreditCardsForPartner } = useStore();
  const { isCFO } = useRole();
  const navigate = useNavigate();

  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [editEvent, setEditEvent] = useState<LedgerEvent | null>(null);
  function editRecord(refId: string, eventType: LedgerEvent["eventType"]) {
    setEditEvent(ledger.find(e => e.refId === refId && e.eventType === eventType) ?? null);
  }
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteConfirm() {
    if (!partner) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deletePartner(partner.id);
      // After successful delete, navigate back to partners list
      navigate("/partners", { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete partner. Please try again.");
      setIsDeleting(false);
    }
  }

  const partner = id ? getPartner(id) : undefined;
  const partnerCards = id ? getCreditCardsForPartner(id) : [];
  const partnerAllocations = allocationSummaries.filter((a) => a.partnerId === id);
  const partnerPayments = profitRecords.filter((r) => r.partnerId === id).sort((a, b) => b.paidDate.localeCompare(a.paidDate));
  const partnerReturns = capitalReturns.filter((r) => r.partnerId === id).sort((a, b) => b.returnedDate.localeCompare(a.returnedDate));

  const totalCapital = partnerAllocations.reduce((s, a) => s + a.contributedAmount, 0);
  const totalCapitalReturned = partnerAllocations.reduce((s, a) => s + a.totalCapitalReturned, 0);
  const capitalOutstanding = partnerAllocations.reduce((s, a) => s + a.capitalOutstanding, 0);
  const cashOutstanding = partnerAllocations.filter((a) => !a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0);
  const cardOutstanding = partnerAllocations.filter((a) => !!a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0);
  const totalProfitPaid = partnerAllocations.reduce((s, a) => s + a.totalProfitPaid, 0);
  const totalProfitPending = partnerAllocations.reduce((s, a) => s + a.profitPending, 0);
  const expectedMonthlyProfit = partnerAllocations.reduce((s, a) => s + monthlyPayout(a, profitRecords), 0);
  const hasCreditCards = partnerCards.length > 0;

  if (!partner) {
    return (
      <div className="empty-state">
        <h2>Partner not found</h2>
        <Link className="button button--secondary" to="/partners"><ArrowLeft size={15} /> Back to Partners</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Link className="entity-link entity-link--muted" to="/partners" style={{ fontSize: 13 }}>
          <ArrowLeft size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />All partners
        </Link>
      </div>

      <PageHeader
        eyebrow="Capital partner"
        title={partner.name}
        description={[partner.email, partner.phone].filter(Boolean).join(" · ") || "No contact details"}
        actions={
          isCFO ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="button button--secondary" type="button" onClick={() => setModal({ type: "editPartner" })}>
                <Edit2 size={15} /> Edit
              </button>
              <button className="button button--secondary" type="button" onClick={() => setModal({ type: "capitalReturn", allocationId: partnerAllocations.find((a) => !a.isFullyReturned && !a.combinationReserved)?.id ?? "", capitalOutstanding: partnerAllocations.find((a) => !a.isFullyReturned && !a.combinationReserved)?.capitalOutstanding ?? 0 })} disabled={capitalOutstanding === 0}>
                <ArrowDownLeft size={15} /> Record Return
              </button>
              <button className="button button--primary" type="button" onClick={() => setModal({ type: "addContrib" })}>
                <PlusCircle size={15} /> Add Contribution
              </button>
              <button
                className="button button--danger"
                type="button"
                title="Delete this partner"
                onClick={() => { setDeleteError(null); setShowDeleteModal(true); }}
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeletePartnerModal
          partnerName={partner.name}
          allocationCount={partnerAllocations.length}
          onConfirm={handleDeleteConfirm}
          onClose={() => { if (!isDeleting) { setShowDeleteModal(false); setDeleteError(null); } }}
          isDeleting={isDeleting}
        />
      )}
      {deleteError && (
        <div style={{ color: "var(--outgoing)", background: "var(--bg-card)", border: "1px solid var(--outgoing)", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
          ⚠ {deleteError}
        </div>
      )}

      {/* Modals */}
      {isCFO && editEvent && <EditEntryModal event={editEvent} allocationSummaries={allocationSummaries} onClose={() => setEditEvent(null)} />}
      {modal.type === "editPartner" && <EditPartnerModal partner={partner} onClose={() => setModal({ type: "none" })} />}
      {modal.type === "addContrib" && <AddContributionModal partnerId={partner.id} partnerCards={partnerCards} onClose={() => setModal({ type: "none" })} />}
      {modal.type === "capitalReturn" && (
        <RecordCapitalReturnModal allocationId={modal.allocationId} partnerId={partner.id} capitalOutstanding={modal.capitalOutstanding} onClose={() => setModal({ type: "none" })} />
      )}
      {modal.type === "profitPay" && (() => {
        const payingAlloc = partnerAllocations.find((a) => a.id === modal.allocationId);
        return (
          <RecordProfitModal
            allocationId={modal.allocationId}
            partnerId={partner.id}
            pendingAmount={modal.profitPending}
            partnerName={partner.name}
            partnerPhone={partner.phone ?? null}
            capitalOutstanding={payingAlloc?.capitalOutstanding ?? capitalOutstanding}
            {...(payingAlloc?.profitPercent !== undefined ? { profitPercent: payingAlloc.profitPercent } : {})}
            fundingSource={payingAlloc?.creditCardId ? "card" : "cash"}
            cardName={payingAlloc?.creditCard?.cardName ?? null}
            amountGivenDate={payingAlloc?.receivedDate ?? null}
            onClose={() => setModal({ type: "none" })}
          />
        );
      })()}
      {modal.type === "editReturn" && (
        <EditReturnDateModal allocationId={modal.allocationId} currentReturnDate={modal.currentReturnDate} onClose={() => setModal({ type: "none" })} />
      )}

      {/* KPI strip */}
      <div className="fin-cards-grid" style={{ marginBottom: 20 }}>
        <div className="fin-card">
          <p className="fin-card__label">Total capital</p>
          <strong className="fin-card__value">{fmt(totalCapital)}</strong>
          <p className="fin-card__sub">{partnerAllocations.length} allocation{partnerAllocations.length !== 1 ? "s" : ""}</p>
        </div>
        {/* Show capital outstanding — if partner has credit cards, split into cash + card */}
        {!hasCreditCards ? (
          <div className="fin-card">
            <p className="fin-card__label">Capital outstanding</p>
            <strong className="fin-card__value" style={{ color: capitalOutstanding > 0 ? "var(--pending)" : "var(--muted)" }}>{fmt(capitalOutstanding)}</strong>
            <p className="fin-card__sub">Yet to return · {fmt(totalCapitalReturned)} returned</p>
          </div>
        ) : (
          <>
            <div className="fin-card">
              <p className="fin-card__label">Cash outstanding</p>
              <strong className="fin-card__value" style={{ color: cashOutstanding > 0 ? "var(--pending)" : "var(--muted)" }}>{fmt(cashOutstanding)}</strong>
              <p className="fin-card__sub">Cash / bank capital</p>
            </div>
            <div className="fin-card">
              <p className="fin-card__label">
                <CreditCardIcon size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Card outstanding
              </p>
              <strong className="fin-card__value" style={{ color: cardOutstanding > 0 ? "var(--pending)" : "var(--muted)" }}>{fmt(cardOutstanding)}</strong>
              <p className="fin-card__sub">Credit card capital</p>
            </div>
          </>
        )}
        <div className="fin-card">
          <p className="fin-card__label">Exp. monthly profit</p>
          <strong className="fin-card__value" style={{ color: "var(--text-soft)" }}>{fmt(expectedMonthlyProfit)}</strong>
          <p className="fin-card__sub">This month · actual paid + remaining estimates</p>
        </div>
        <div className="fin-card">
          <p className="fin-card__label">Profit paid</p>
          <strong className="fin-card__value" style={{ color: "var(--incoming)" }}>{fmt(totalProfitPaid)}</strong>
          <p className="fin-card__sub">{partnerPayments.length} payment{partnerPayments.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="fin-card">
          <p className="fin-card__label">Profit pending</p>
          <strong className="fin-card__value" style={{ color: totalProfitPending > 0 ? "var(--outgoing)" : "var(--muted)" }}>{fmt(totalProfitPending)}</strong>
          <p className="fin-card__sub">Accrued, not yet paid</p>
        </div>
      </div>

      <EarningsSummary allocations={partnerAllocations} regularProfit={totalProfitPaid} />
      {/* Allocations table */}
      <section aria-labelledby="alloc-title" style={{ marginBottom: 24 }}>
        <h2 id="alloc-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Capital allocations</h2>
        {isCFO && <>
          <label className="checkbox-row"><input type="checkbox" aria-label="Select all payable partner entries" checked={partnerAllocations.some(a => a.profitPending > 0 || (!a.combinationReserved && a.capitalOutstanding > 0)) && partnerAllocations.filter(a => a.profitPending > 0 || (!a.combinationReserved && a.capitalOutstanding > 0)).every(a => selectedPaymentIds.includes(a.id))} onChange={e => setSelectedPaymentIds(e.target.checked ? partnerAllocations.filter(a => a.profitPending > 0 || (!a.combinationReserved && a.capitalOutstanding > 0)).map(a => a.id) : [])} />Select all payable entries</label>
          <PaymentSelectionActions entries={partnerAllocations.filter(a => selectedPaymentIds.includes(a.id))} onClear={() => setSelectedPaymentIds([])} />
        </>}
        {partnerAllocations.length === 0 ? (
          <div className="empty-state empty-state--compact">
            <span className="empty-state__icon"><IndianRupee size={22} /></span>
            <h3>No capital recorded yet</h3>
            <p>Add a capital contribution to start tracking profit for this partner.</p>
            <button className="button button--primary" type="button" onClick={() => setModal({ type: "addContrib" })}><PlusCircle size={15} /> Add Contribution</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table" aria-label="Capital allocations">
              <thead>
                <tr>
                  <th className="table-th table-th--money">Amount</th>
                  <th className="table-th">Rate</th>
                  <th className="table-th">Source</th>
                  <th className="table-th">Received</th>
                  <th className="table-th table-th--money">Returned</th>
                  <th className="table-th table-th--money">Outstanding</th>
                  <th className="table-th">Return date</th>
                  <th className="table-th table-th--money">Profit accrued</th>
                  <th className="table-th table-th--money">Regular profit paid</th><th className="table-th table-th--money">Cashback paid</th><th className="table-th table-th--money">Total profits received</th>
                  <th className="table-th table-th--money">Pending</th>
                  <th className="table-th">Status</th>
                  <th className="table-th table-th--action"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {partnerAllocations.map((a) => (
                  <RecordRow className="table-row" key={a.id}>
                    <td className="table-cell table-cell--money" data-label="Amount">{isCFO && (a.profitPending > 0 || (!a.combinationReserved && a.capitalOutstanding > 0)) && <input className="payment-row-selection" type="checkbox" aria-label={`Select payment entry ${a.id}`} checked={selectedPaymentIds.includes(a.id)} onChange={e => setSelectedPaymentIds(ids => e.target.checked ? [...ids, a.id] : ids.filter(id => id !== a.id))} />}<strong>{fmt(a.amountRupees)}</strong></td>
                    <td className="table-cell" data-label="Rate"><span className="party-type-chip party-type-chip--partner">{a.profitPercent}% p.m.</span></td>
                    <td className="table-cell" data-label="Source">
                      {a.creditCard ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                          <CreditCardIcon size={12} />{a.creditCard.cardName}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>Cash</span>
                      )}
                    </td>
                    <td className="table-cell table-cell--secondary" data-label="Received">{formatDate(a.receivedDate)}</td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--incoming)" }} data-label="Returned">{fmt(a.totalCapitalReturned)}</td>
                    <td className="table-cell table-cell--money" style={{ color: a.capitalOutstanding > 0 ? "var(--pending)" : "var(--muted)", fontWeight: a.capitalOutstanding > 0 ? 700 : 400 }} data-label="Outstanding">{fmt(a.capitalOutstanding)}</td>
                    <td className="table-cell table-cell--secondary" data-label="Return date">
                      {a.returnDate ? (
                        <span style={{ color: "var(--pending)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <CalendarClock size={13} />{formatDate(a.returnDate)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--text-soft)" }} data-label="Profit accrued">{fmt(a.profitAccrued)}</td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--incoming)" }} data-label="Profit paid">{fmt(a.totalProfitPaid)}</td><td className="table-cell table-cell--money" data-label="Cashback paid">{a.creditCardId ? a.unknownCashbackCount ? 'Amount not recorded' : fmt(a.totalCashbackPaid) : '—'}</td><td className="table-cell table-cell--money" data-label="Total profits received">{fmt(a.totalProfitsReceived)}{a.unknownCashbackCount > 0 && <small> + unrecorded cashback</small>}</td>
                    <td className="table-cell table-cell--money" data-label="Pending"><strong style={{ color: a.profitPending > 0 ? "var(--outgoing)" : "var(--muted)" }}>{fmt(a.profitPending)}</strong></td>
                    <td className="table-cell" data-label="Status">
                      <span className={`status-badge ${a.isFullyReturned ? "status-badge--inactive" : "status-badge--active"}`}>
                        {a.combinedInto ? 'Combined (history)' : a.isFullyReturned ? "Returned" : "Active"}
                      </span>
                    </td>
                    <td className="table-cell table-cell--action">
                      {isCFO && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="icon-button" type="button" title="Edit contribution" aria-label="Edit contribution" onClick={() => editRecord(a.id, "CAPITAL_RECEIVED")}>
                            <Edit2 size={14} />
                          <span className="mobile-action-label">Edit contribution</span></button>
                          {!a.isFullyReturned && (
                            <button className="icon-button" type="button" title="Record capital return" aria-label="Record return" onClick={() => setModal({ type: "capitalReturn", allocationId: a.id, capitalOutstanding: a.capitalOutstanding })}>
                              <ArrowDownLeft size={14} />
                            <span className="mobile-action-label">Record return</span></button>
                          )}
                          {a.profitPending > 0 && (
                            <button className="icon-button" type="button" title="Record profit payment" aria-label="Record profit" onClick={() => setModal({ type: "profitPay", allocationId: a.id, profitPending: a.profitPending })}>
                              <CheckCircle2 size={14} />
                            <span className="mobile-action-label">Record profit</span></button>
                          )}
                        </div>
                      )}
                    </td>
                  </RecordRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Capital returns history */}
      {partnerReturns.length > 0 && (
        <section aria-labelledby="returns-title" style={{ marginBottom: 24 }}>
          <h2 id="returns-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Capital returns</h2>
          <div className="table-wrapper">
            <table className="data-table" aria-label="Capital returns">
              <thead>
                <tr>
                  <th className="table-th">Date</th>
                  <th className="table-th">Allocation</th>
                  <th className="table-th table-th--money">Amount returned</th>
                  <th className="table-th">Notes</th>
                  {isCFO && <th className="table-th">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {partnerReturns.map((r) => {
                  const alloc = partnerAllocations.find((a) => a.id === r.allocationId);
                  return (
                    <RecordRow className="table-row" key={r.id}>
                      <td className="table-cell table-cell--secondary" data-label="Date">{formatDate(r.returnedDate)}</td>
                      <td className="table-cell table-cell--secondary" data-label="Allocation">{alloc ? `${fmt(alloc.amountRupees)} @ ${alloc.profitPercent}% p.m.` : r.allocationId}</td>
                      <td className="table-cell table-cell--money" style={{ color: "var(--incoming)" }} data-label="Amount returned">
                        <ArrowDownLeft size={13} style={{ verticalAlign: "middle", marginRight: 3 }} />
                        <strong>{fmt(r.amountRupees)}</strong>
                      </td>
                      <td className="table-cell table-cell--secondary" data-label="Notes">{(r.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}{r.paymentGroupId && <small style={{ display: "block" }}>Recorded in a grouped payment</small>}</td>
                      {isCFO && <td className="table-cell" data-label="Actions"><button className="button button--secondary" type="button" onClick={() => editRecord(r.id, "CAPITAL_RETURNED")} aria-label="Edit capital return"><Edit2 size={14} /> Edit</button></td>}
                    </RecordRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Profit payment history */}
      {partnerPayments.length > 0 && (
        <section aria-labelledby="payments-title" style={{ marginBottom: 24 }}>
          <h2 id="payments-title" style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Profit payment history</h2>
          <div className="table-wrapper">
            <table className="data-table" aria-label="Profit payment history">
              <thead>
                <tr>
                  <th className="table-th">Date</th>
                  <th className="table-th">Allocation</th>
                  <th className="table-th table-th--money">Amount</th>
                  <th className="table-th">Notes</th>
                  {isCFO && <th className="table-th">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {partnerPayments.map((r) => {
                  const alloc = partnerAllocations.find((a) => a.id === r.allocationId);
                  return (
                    <RecordRow className="table-row" key={r.id}>
                      <td className="table-cell table-cell--secondary" data-label="Date">{formatDate(r.paidDate)}</td>
                      <td className="table-cell table-cell--secondary" data-label="Allocation">{alloc ? `${fmt(alloc.amountRupees)} · ${paidRateLabel(r, alloc)}` : r.allocationId}</td>
                      <td className="table-cell table-cell--money" style={{ color: "var(--incoming)" }} data-label="Amount">
                        <TrendingDown size={13} style={{ verticalAlign: "middle", marginRight: 3 }} />
                        <strong>{fmt(r.amountRupees)}</strong>
                      </td>
                      <td className="table-cell table-cell--secondary" data-label="Notes">{(r.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}{r.paymentGroupId && <small style={{ display: "block" }}>Recorded in a grouped payment</small>}</td>
                      {isCFO && <td className="table-cell" data-label="Actions"><button className="button button--secondary" type="button" onClick={() => editRecord(r.id, "PROFIT_PAID")} aria-label="Edit profit payment"><Edit2 size={14} /> Edit</button></td>}
                    </RecordRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {partner.notes && (
        <div className="detail-notes" style={{ marginTop: 8 }}><strong>Notes</strong><p>{partner.notes}</p></div>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="button button--secondary" to="/capital-contributions"><IndianRupee size={15} /> All contributions</Link>
        <Link className="button button--secondary" to="/pending-profits"><TrendingUp size={15} /> Profits</Link>
        <Link className="button button--secondary" to="/ledger"><TrendingDown size={15} /> Ledger</Link>
        <Link className="button button--secondary" to={`/partners/${id}/statement`} style={{ marginLeft: "auto" }}>
          <FileText size={15} /> Account Statement (PDF)
        </Link>
      </div>
    </div>
  );
}
