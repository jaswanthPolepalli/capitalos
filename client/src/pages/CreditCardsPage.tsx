import {
  CalendarClock,
  CreditCard as CreditCardIcon,
  Edit2,
  IndianRupee,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import { PageHeader } from "../components/PageHeader";
import { formatDate } from "../lib/format";
import type { AddCreditCardInput, CreditCard, UpdateCreditCardInput } from "../store";
import { computeNextDueDate } from "../store";
import { useStore } from "../useStore";
import { useRole } from "../context/RoleContext";
import { amountToWords } from "../lib/amountWords";
import { SearchableSelect } from "../components/SearchableSelect";

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// ─── Add / Edit Credit Card Modal ─────────────────────────────────────────────

function CreditCardModal({
  partners,
  editCard,
  onClose,
  onSave,
}: {
  partners: { id: string; name: string }[];
  editCard?: CreditCard;
  onClose: () => void;
  onSave: (input: AddCreditCardInput | (UpdateCreditCardInput & { partnerId?: string }), id?: string) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    partnerId: editCard?.partnerId || partners[0]?.id || "",
    cardName: editCard?.cardName || "",
    cardLimitStr: editCard ? String(editCard.cardLimit) : "",
    pendingLimitStr: editCard ? String(editCard.pendingLimit) : "",
    billGenerationDate: editCard?.billGenerationDate || today,
    dueDate: editCard?.dueDate || today,
    notes: editCard?.notes || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.partnerId) e.partnerId = "Select a partner";
    if (!form.cardName.trim()) e.cardName = "Card name is required";
    const limit = Number(form.cardLimitStr);
    if (!form.cardLimitStr || isNaN(limit) || limit < 0) e.cardLimitStr = "Enter a valid limit";
    const pending = Number(form.pendingLimitStr);
    if (form.pendingLimitStr !== "" && (isNaN(pending) || pending < 0)) e.pendingLimitStr = "Enter a valid pending limit";
    if (!form.billGenerationDate) e.billGenerationDate = "Required";
    if (!form.dueDate) e.dueDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const input = {
        partnerId: form.partnerId,
        cardName: form.cardName.trim(),
        cardLimit: Math.round(Number(form.cardLimitStr)),
        pendingLimit: form.pendingLimitStr !== "" ? Math.round(Number(form.pendingLimitStr)) : 0,
        billGenerationDate: form.billGenerationDate,
        dueDate: form.dueDate,
        notes: form.notes.trim(),
      };
      await onSave(input, editCard?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const set = (f: string, v: string) => {
    setForm((p) => ({ ...p, [f]: v }));
    setErrors((e) => ({ ...e, [f]: undefined as unknown as string }));
  };

  // Compute preview of next due date
  const previewDueDate = form.billGenerationDate && form.dueDate
    ? computeNextDueDate(
        { billGenerationDate: form.billGenerationDate, dueDate: form.dueDate } as CreditCard,
        today,
      )
    : null;

  const isEditing = !!editCard;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cc-modal-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="cc-modal-title">
            <CreditCardIcon size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {isEditing ? "Edit Credit Card" : "Add Credit Card"}
          </h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close"><X size={18} /></button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          {/* Partner (locked when editing) */}
          <div className="form-field">
            <label htmlFor="cc-partner" className="form-label">Partner *</label>
            {isEditing ? (
              <input
                id="cc-partner"
                className="form-input"
                type="text"
                value={partners.find((p) => p.id === editCard?.partnerId)?.name ?? editCard?.partnerId ?? ""}
                disabled
              />
            ) : (
              <SearchableSelect
                id="cc-partner"
                options={partners.map((p) => ({ value: p.id, label: p.name }))}
                value={form.partnerId}
                onChange={(v) => set("partnerId", v)}
                placeholder="Select partner…"
                searchPlaceholder="Search partners…"
                hasError={!!errors.partnerId}
              />
            )}
            {errors.partnerId && <span className="form-error">{errors.partnerId}</span>}
          </div>

          {/* Card name */}
          <div className="form-field">
            <label htmlFor="cc-name" className="form-label">Card name *</label>
            <input
              id="cc-name"
              className={`form-input ${errors.cardName ? "form-input--error" : ""}`}
              type="text"
              value={form.cardName}
              onChange={(e) => set("cardName", e.target.value)}
              placeholder="e.g. HDFC Regalia, SBI SimplyCLICK"
              autoFocus={!isEditing}
            />
            {errors.cardName && <span className="form-error">{errors.cardName}</span>}
          </div>

          {/* Limits */}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="cc-limit" className="form-label">Card limit (₹) *</label>
              <input
                id="cc-limit"
                className={`form-input ${errors.cardLimitStr ? "form-input--error" : ""}`}
                type="number"
                min="0"
                value={form.cardLimitStr}
                onChange={(e) => set("cardLimitStr", e.target.value)}
                placeholder="e.g. 200000"
              />
              {errors.cardLimitStr && <span className="form-error">{errors.cardLimitStr}</span>}
              {form.cardLimitStr && !isNaN(Number(form.cardLimitStr)) && Number(form.cardLimitStr) > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, display: "block" }}>{amountToWords(Number(form.cardLimitStr))}</span>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="cc-pending" className="form-label">
                Pending / used limit (₹) <span className="form-label__optional">(optional)</span>
              </label>
              <input
                id="cc-pending"
                className={`form-input ${errors.pendingLimitStr ? "form-input--error" : ""}`}
                type="number"
                min="0"
                value={form.pendingLimitStr}
                onChange={(e) => set("pendingLimitStr", e.target.value)}
                placeholder="e.g. 50000"
              />
              {errors.pendingLimitStr && <span className="form-error">{errors.pendingLimitStr}</span>}
              {form.pendingLimitStr && !isNaN(Number(form.pendingLimitStr)) && Number(form.pendingLimitStr) > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, display: "block" }}>{amountToWords(Number(form.pendingLimitStr))}</span>
              )}
            </div>
          </div>

          {/* Billing cycle dates */}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="cc-bill-gen" className="form-label">Bill generation date *</label>
              <input
                id="cc-bill-gen"
                className={`form-input ${errors.billGenerationDate ? "form-input--error" : ""}`}
                type="date"
                value={form.billGenerationDate}
                onChange={(e) => set("billGenerationDate", e.target.value)}
              />
              {errors.billGenerationDate && <span className="form-error">{errors.billGenerationDate}</span>}
              <span className="form-label__optional" style={{ fontSize: 11, marginTop: 3, display: "block" }}>
                This month's bill generation date (e.g. Sep 4 or Sep 23)
              </span>
            </div>
            <div className="form-field">
              <label htmlFor="cc-due" className="form-label">Due date *</label>
              <input
                id="cc-due"
                className={`form-input ${errors.dueDate ? "form-input--error" : ""}`}
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
              {errors.dueDate && <span className="form-error">{errors.dueDate}</span>}
              <span className="form-label__optional" style={{ fontSize: 11, marginTop: 3, display: "block" }}>
                Corresponding due date (can be same or next month)
              </span>
            </div>
          </div>

          {previewDueDate && (
            <div className="form-hint">
              <CalendarClock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Next due date from today ({today}): <strong>{formatDate(previewDueDate)}</strong>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="cc-notes" className="form-label">Notes</label>
            <textarea
              id="cc-notes"
              className="form-input form-textarea"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Bank name, card type, etc."
            />
          </div>

          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : isEditing ? <><Edit2 size={15} /> Save changes</> : <><PlusCircle size={15} /> Add Card</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteCardModal({
  card,
  partnerName,
  onConfirm,
  onClose,
}: {
  card: CreditCard;
  partnerName: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    try { await onConfirm(); } finally { setDeleting(false); }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="del-cc-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="del-cc-title" style={{ color: "var(--outgoing)" }}>
            <Trash2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Delete Credit Card
          </h2>
          <button className="icon-button" onClick={onClose} type="button" disabled={deleting}>✕</button>
        </div>
        <div className="modal__body">
          <p>Are you sure you want to delete <strong>{card.cardName}</strong> ({partnerName})?</p>
          <div className="form-hint" style={{ borderLeft: "3px solid var(--outgoing)", paddingLeft: 10, marginTop: 10 }}>
            Existing contributions linked to this card will retain their credit card association in the data,
            but you won't be able to select this card for new contributions.
          </div>
        </div>
        <div className="modal__footer">
          <button className="button button--secondary" type="button" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="button button--danger" type="button" onClick={handleConfirm} disabled={deleting}>
            {deleting ? "Deleting…" : <><Trash2 size={14} /> Delete Card</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Credit Cards Page ────────────────────────────────────────────────────────

// ─── Per-card utilisation from linked allocations ─────────────────────────────

function getCardUtilisation(cardId: string, allocationSummaries: ReturnType<typeof useStore>["allocationSummaries"]): number {
  // Sum of outstanding capital on allocations that are funded by this card (active allocations only)
  return allocationSummaries
    .filter((a) => a.creditCardId === cardId && !a.isFullyReturned)
    .reduce((s, a) => s + a.capitalOutstanding, 0);
}

export function CreditCardsPage() {
  const { partners, creditCards, allocationSummaries, addCreditCard, updateCreditCard, deleteCreditCard } = useStore();
  const { isCFO } = useRole();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCard, setEditCard] = useState<CreditCard | null>(null);
  const [deleteCard, setDeleteCard] = useState<CreditCard | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Group cards by partner
  const cardsByPartner = partners.map((p) => ({
    partner: p,
    cards: creditCards.filter((c) => c.partnerId === p.id),
  })).filter((g) => g.cards.length > 0);

  const unassignedCards = creditCards.filter(
    (c) => !partners.find((p) => p.id === c.partnerId)
  );

  async function handleSave(input: AddCreditCardInput | (UpdateCreditCardInput & { partnerId?: string }), id?: string) {
    if (id) {
      await updateCreditCard(id, input as UpdateCreditCardInput);
    } else {
      await addCreditCard(input as AddCreditCardInput);
    }
  }

  async function handleDelete() {
    if (!deleteCard) return;
    await deleteCreditCard(deleteCard.id);
    setDeleteCard(null);
  }

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Payment methods"
        title="Credit Cards"
        description="Manage credit cards linked to partners. Capital contributions can be sourced from a credit card, and return dates will auto-populate based on the card's billing cycle."
        actions={
          isCFO ? (
            <button className="button button--primary" type="button" onClick={() => setShowAddModal(true)}>
              <PlusCircle size={15} /> Add Credit Card
            </button>
          ) : undefined
        }
      />

      {showAddModal && (
        <CreditCardModal
          partners={partners}
          onClose={() => { setShowAddModal(false); }}
          onSave={handleSave}
        />
      )}
      {editCard && (
        <CreditCardModal
          partners={partners}
          editCard={editCard}
          onClose={() => { setEditCard(null); }}
          onSave={handleSave}
        />
      )}

      {deleteCard && (
        <DeleteCardModal
          card={deleteCard}
          partnerName={partners.find((p) => p.id === deleteCard.partnerId)?.name ?? deleteCard.partnerId}
          onConfirm={handleDelete}
          onClose={() => setDeleteCard(null)}
        />
      )}

      {creditCards.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon"><CreditCardIcon size={28} /></span>
          <h3>No credit cards yet</h3>
          <p>Add credit cards to track card-funded capital contributions and auto-compute return dates based on billing cycles.</p>
          <button className="button button--primary" type="button" onClick={() => setShowAddModal(true)}>
            <PlusCircle size={15} /> Add Credit Card
          </button>
        </div>
      )}

      {/* Aggregate summary strip */}
      {creditCards.length > 0 && (
        <div className="card-summary-strip">
          {(() => {
            const totalLimit = creditCards.reduce((s, c) => s + c.cardLimit, 0);
            const totalUtilised = creditCards.reduce((c_acc, card) => {
              const fromAllocs = getCardUtilisation(card.id, allocationSummaries);
              return c_acc + (fromAllocs > 0 ? fromAllocs : card.pendingLimit);
            }, 0);
            const totalAvailable = Math.max(0, totalLimit - totalUtilised);
            const utilPct = totalLimit > 0 ? Math.round((totalUtilised / totalLimit) * 100) : 0;
            return (
              <>
                <div className="card-summary-strip__item">
                  <span>Total card capacity</span>
                  <strong>{fmt(totalLimit)}</strong>
                </div>
                <div className="card-summary-strip__divider" />
                <div className="card-summary-strip__item">
                  <span>Total utilised</span>
                  <strong style={{ color: utilPct > 85 ? "var(--outgoing)" : utilPct > 60 ? "var(--pending)" : "var(--incoming)" }}>
                    {fmt(totalUtilised)} ({utilPct}%)
                  </strong>
                </div>
                <div className="card-summary-strip__divider" />
                <div className="card-summary-strip__item">
                  <span>Total available</span>
                  <strong style={{ color: "var(--incoming)" }}>{fmt(totalAvailable)}</strong>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Cards grouped by partner */}
      {cardsByPartner.map(({ partner, cards }) => (
        <section key={partner.id} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
            <a href={`#/partners/${partner.id}`} style={{ color: "inherit", textDecoration: "none" }} className="partner-group-link">
              {partner.name}
            </a>
          </h2>
          <div className="table-wrapper">
            <table className="data-table" aria-label={`Credit cards for ${partner.name}`}>
              <thead>
                <tr>
                  <th className="table-th">Card name</th>
                  <th className="table-th table-th--money">Total limit</th>
                  <th className="table-th table-th--money">Utilised</th>
                  <th className="table-th table-th--money">Available</th>
                  <th className="table-th">Bill generation date</th>
                  <th className="table-th">Due date</th>
                  <th className="table-th">Next due (from today)</th>
                  <th className="table-th">Notes</th>
                  <th className="table-th table-th--action"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => {
                  const nextDue = computeNextDueDate(card, today);
                  // Utilised = outstanding capital from active allocations linked to this card
                  const utilisedFromAllocations = getCardUtilisation(card.id, allocationSummaries);
                  // pendingLimit stored on card is a manually-entered override (e.g. other purchases on card)
                  // Total utilised = max of stored pendingLimit or allocations outstanding (use whichever is set)
                  const utilisedAmt = utilisedFromAllocations > 0 ? utilisedFromAllocations : card.pendingLimit;
                  const availableAmt = Math.max(0, card.cardLimit - utilisedAmt);
                  const utilisedPct = card.cardLimit > 0 ? Math.round((utilisedAmt / card.cardLimit) * 100) : 0;
                  return (
                    <tr className="table-row" key={card.id}>
                      <td className="table-cell">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                          <CreditCardIcon size={14} style={{ color: "var(--accent)" }} />
                          {card.cardName}
                        </span>
                      </td>
                      <td className="table-cell table-cell--money" data-label="Limit">
                        <strong>{fmt(card.cardLimit)}</strong>
                      </td>
                      <td className="table-cell table-cell--money" data-label="Utilised">
                        <div>
                          <strong style={{ color: utilisedAmt > 0 ? "var(--pending)" : "var(--muted)" }}>
                            {utilisedAmt > 0 ? fmt(utilisedAmt) : "—"}
                          </strong>
                          {utilisedAmt > 0 && card.cardLimit > 0 && (
                            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                              {utilisedPct}% used
                              {utilisedFromAllocations > 0 && (
                                <span style={{ marginLeft: 4 }}>· from contributions</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="table-cell table-cell--money" data-label="Available">
                        <strong style={{ color: availableAmt > 0 ? "var(--incoming)" : "var(--outgoing)" }}>
                          {fmt(availableAmt)}
                        </strong>
                      </td>
                      <td className="table-cell table-cell--secondary" data-label="Bill gen">
                        {formatDate(card.billGenerationDate)}
                      </td>
                      <td className="table-cell table-cell--secondary" data-label="Due date">
                        {formatDate(card.dueDate)}
                      </td>
                      <td className="table-cell" data-label="Next due" style={{ color: "var(--pending)", fontWeight: 600 }}>
                        <CalendarClock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                        {formatDate(nextDue)}
                      </td>
                      <td className="table-cell table-cell--secondary" data-label="Notes">{card.notes || "—"}</td>
                      <td className="table-cell table-cell--action">
                        {isCFO && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="icon-button" type="button" title="Edit card" onClick={() => setEditCard(card)}>
                              <Edit2 size={14} />
                            </button>
                            <button className="icon-button" type="button" title="Delete card" onClick={() => setDeleteCard(card)}
                              style={{ color: "var(--outgoing)" }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      {/* Mobile-only action row */}
                      {isCFO && (
                        <td className="table-cell-actions">
                          <div className="table-cell-actions__inner">
                            <button className="button button--secondary" type="button" onClick={() => setEditCard(card)}>
                              <Edit2 size={14} /> Edit
                            </button>
                            <button className="button button--danger" type="button" onClick={() => setDeleteCard(card)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {unassignedCards.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
            Unknown Partner
          </h2>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="table-th">Card name</th>
                  <th className="table-th table-th--money">Card limit</th>
                  <th className="table-th">Bill generation date</th>
                  <th className="table-th">Due date</th>
                  <th className="table-th table-th--action"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {unassignedCards.map((card) => (
                  <tr className="table-row" key={card.id}>
                    <td className="table-cell">{card.cardName}</td>
                    <td className="table-cell table-cell--money">{fmt(card.cardLimit)}</td>
                    <td className="table-cell">{formatDate(card.billGenerationDate)}</td>
                    <td className="table-cell">{formatDate(card.dueDate)}</td>
                    <td className="table-cell table-cell--action">
                      <button className="icon-button" type="button" onClick={() => setDeleteCard(card)} style={{ color: "var(--outgoing)" }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Summary strip */}
      {creditCards.length > 0 && (() => {
        const totalLimit = creditCards.reduce((s, c) => s + c.cardLimit, 0);
        const totalUtilised = creditCards.reduce((s, c) => {
          const fromAlloc = getCardUtilisation(c.id, allocationSummaries);
          return s + (fromAlloc > 0 ? fromAlloc : c.pendingLimit);
        }, 0);
        const totalAvailable = Math.max(0, totalLimit - totalUtilised);
        return (
          <div className="ledger-summary" style={{ marginTop: 16 }}>
            <div className="ledger-summary__item">
              <span>Total cards</span>
              <strong style={{ fontSize: 17 }}>{creditCards.length}</strong>
            </div>
            <div className="ledger-summary__divider" />
            <div className="ledger-summary__item">
              <span>Total limit</span>
              <strong style={{ fontSize: 17 }}>{fmt(totalLimit)}</strong>
            </div>
            <div className="ledger-summary__divider" />
            <div className="ledger-summary__item">
              <span>Total utilised</span>
              <strong style={{ fontSize: 17, color: "var(--pending)" }}>{fmt(totalUtilised)}</strong>
            </div>
            <div className="ledger-summary__divider" />
            <div className="ledger-summary__item">
              <span>Total available</span>
              <strong style={{ fontSize: 17, color: "var(--incoming)" }}>{fmt(totalAvailable)}</strong>
            </div>
            <div className="ledger-summary__divider" />
            <div className="ledger-summary__item">
              <span>Partners with cards</span>
              <strong style={{ fontSize: 17 }}>{cardsByPartner.length}</strong>
            </div>
          </div>
        );
      })()}

      {/* Info box */}
      <div className="foundation-banner" style={{ marginTop: 24 }}>
        <span className="foundation-banner__icon" aria-hidden="true">
          <IndianRupee size={20} />
        </span>
        <div>
          <strong>How billing cycles work</strong>
          <p>
            Enter this month's bill generation date and due date. The system uses the day-of-month and
            the offset between them to automatically compute future due dates when recording capital contributions.
            For example: bill gen Sep 23, due Oct 11 → next due after Oct 5 contribution = Nov 11.
          </p>
        </div>
      </div>
    </div>
  );
}
