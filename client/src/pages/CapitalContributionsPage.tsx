import {
  BadgeIndianRupee,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  CreditCard as CreditCardIcon,
  Download,
  Edit2,
  MessageSquare,
  PlusCircle,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { formatDate } from "../lib/format";
import type { AddAllocationInput, AddCapitalReturnInput, CreditCard } from "../store";
import { computeNextDueDate, updateAllocationCreditCard, updateAllocationReturnDate, updateAllocationWAConfirmed } from "../store";
import { useStore } from "../useStore";
import { amountToWords } from "../lib/amountWords";
import { downloadCSV, csvFilename } from "../lib/csv";
import { SearchableSelect } from "../components/SearchableSelect";
import { useRole } from "../context/RoleContext";

const PAGE_SIZE = 25;

// ─── Shared fmt helper ────────────────────────────────────────────────────────

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// ─── WhatsApp Summary helpers ─────────────────────────────────────────────────

/** Format a rupee integer with Indian commas, no ₹ symbol (e.g. 155000 → "1,55,000") */
function fmtWA(rupees: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rupees);
}

/** Format an ISO date as short "24 Sep" style */
function fmtShortDate(isoDate: string): string {
  const parts = isoDate.split("-").map(Number);
  const d = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── WhatsApp Summary Modal ───────────────────────────────────────────────────

interface WASummaryRow {
  id: string;
  label: string;       // card name or "" for cash
  amountRupees: number;
  partnerName: string;
  isCard: boolean;
  confirmed: boolean;  // whether due-date checkbox is checked
  dueDate: string;     // editable ISO date
}

function WhatsAppSummaryModal({
  onClose,
  allocationSummaries,
}: {
  onClose: () => void;
  allocationSummaries: ReturnType<typeof useStore>["allocationSummaries"];
}) {
  const [rows, setRows] = useState<WASummaryRow[]>(() => {
    const active = allocationSummaries.filter((a) => !a.isFullyReturned);

    // Sort by returnDate ascending (null/empty → bottom)
    const sorted = [...active].sort((a, b) => {
      if (a.returnDate && b.returnDate) return a.returnDate.localeCompare(b.returnDate);
      if (a.returnDate) return -1;
      if (b.returnDate) return 1;
      return 0;
    });

    return sorted.map((a) => ({
      id: a.id,
      // Use only the first word of the card name (e.g. "SBI Simply Click Visa" → "SBI")
      label: a.creditCard ? a.creditCard.cardName.split(" ")[0]! : "",
      amountRupees: a.amountRupees,
      partnerName: a.partner?.name ?? "Unknown",
      isCard: !!a.creditCardId,
      // Auto-check only if the user explicitly confirmed the due date via this modal
      // (indicated by a "WA_CONFIRMED" tag in notes)
      confirmed: (a.notes || "").includes("WA_CONFIRMED"),
      dueDate: a.returnDate ?? "",
    }));
  });

  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function toggleConfirmed(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const newConfirmed = !row.confirmed;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, confirmed: newConfirmed } : r)));
    // Persist confirmation flag + due date to DB
    try {
      await updateAllocationWAConfirmed(id, newConfirmed, newConfirmed ? (row.dueDate || null) : null);
    } catch {
      // ignore network errors — UI state already updated
    }
  }

  async function setDueDate(id: string, date: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, dueDate: date } : r)));
    // Persist the updated due date to DB (only when confirmed)
    const row = rows.find((r) => r.id === id);
    if (row?.confirmed) {
      try {
        await updateAllocationReturnDate(id, date || null);
      } catch {
        // ignore network errors
      }
    }
  }

  const cardRows = rows.filter((r) => r.isCard);
  const cashRows = rows.filter((r) => !r.isCard);

  function buildText(): string {
    const lines: string[] = [];

    if (cardRows.length > 0) {
      lines.push("Card");
      for (const r of cardRows) {
        // label is already first-word-only from initialization
        let line = `${r.label} ${fmtWA(r.amountRupees)} (${r.partnerName})`;
        if (r.confirmed && r.dueDate) line += ` - ${fmtShortDate(r.dueDate)}`;
        lines.push(line);
      }
    }

    if (cashRows.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push("Cash");
      for (const r of cashRows) {
        let line = fmtWA(r.amountRupees);
        if (r.confirmed && r.dueDate) line += ` - ${fmtShortDate(r.dueDate)}`;
        lines.push(line);
      }
    }

    return lines.join("\n");
  }

  const previewText = buildText();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="wa-summary-title">
      <div className="modal" style={{ maxWidth: 680, width: "100%" }}>
        <div className="modal__header">
          <h2 id="wa-summary-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageSquare size={18} />
            WhatsApp Summary
          </h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", minHeight: 280 }}>
          {/* ── Left: row controls ── */}
          <div style={{ flex: "1 1 300px", padding: "16px 20px", borderRight: "1px solid var(--border)", maxHeight: 500, overflowY: "auto" }}>

            {/* Card section */}
            {cardRows.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 10 }}>
                  💳 Card allocations
                </div>
                {cardRows.map((r) => (
                  <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
                        {r.label}{" "}
                        <span style={{ color: "var(--pending)", fontVariantNumeric: "tabular-nums" }}>{fmtWA(r.amountRupees)}</span>
                        <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}> ({r.partnerName})</span>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
                        <input type="checkbox" checked={r.confirmed} onChange={() => toggleConfirmed(r.id)} style={{ cursor: "pointer" }} />
                        Due date
                      </label>
                    </div>
                    {r.confirmed && (
                      <div style={{ marginTop: 6 }}>
                        <input
                          type="date"
                          className="form-input"
                          value={r.dueDate}
                          onChange={(e) => setDueDate(r.id, e.target.value)}
                          style={{ fontSize: 12, padding: "4px 8px", height: "auto", maxWidth: 200 }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Cash section */}
            {cashRows.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 10 }}>
                  💵 Cash allocations
                </div>
                {cashRows.map((r) => (
                  <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
                        <span style={{ color: "var(--pending)", fontVariantNumeric: "tabular-nums" }}>{fmtWA(r.amountRupees)}</span>
                        <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}> ({r.partnerName})</span>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
                        <input type="checkbox" checked={r.confirmed} onChange={() => toggleConfirmed(r.id)} style={{ cursor: "pointer" }} />
                        Due date
                      </label>
                    </div>
                    {r.confirmed && (
                      <div style={{ marginTop: 6 }}>
                        <input
                          type="date"
                          className="form-input"
                          value={r.dueDate}
                          onChange={(e) => setDueDate(r.id, e.target.value)}
                          style={{ fontSize: 12, padding: "4px 8px", height: "auto", maxWidth: 200 }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {cardRows.length === 0 && cashRows.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
                No active allocations to summarize.
              </div>
            )}
          </div>

          {/* ── Right: live preview ── */}
          <div style={{ flex: "1 1 200px", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
              Live Preview
            </div>
            <pre
              style={{
                flex: 1,
                fontFamily: "'Courier New', monospace",
                fontSize: 13,
                lineHeight: 1.75,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 14px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                minHeight: 180,
                color: "var(--text)",
              }}
            >
              {previewText || "—"}
            </pre>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
              Check "Due date" on any row to include it in the summary.
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="modal__footer">
          <button className="button button--secondary" type="button" onClick={onClose}>
            Close
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={handleCopy}
            disabled={!previewText}
            style={{ minWidth: 160 }}
          >
            {copied ? (
              <>✓ Copied!</>
            ) : (
              <>
                <ClipboardCopy size={15} /> Copy to clipboard
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Contribution Modal ───────────────────────────────────────────────────

function AddContributionModal({
  onClose, onSave, partners, creditCards, defaultPartnerId = "",
}: {
  onClose: () => void;
  onSave: (input: AddAllocationInput) => void;
  partners: { id: string; name: string }[];
  creditCards: CreditCard[];
  defaultPartnerId?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    partnerId: defaultPartnerId || partners[0]?.id || "",
    amountStr: "",
    profitPercentStr: "3",
    receivedDate: today,
    returnDate: "",
    creditCardId: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter credit cards for selected partner
  const partnerCards = creditCards.filter((c) => c.partnerId === form.partnerId);

  // When partnerId changes, clear card selection if it no longer belongs to partner
  useEffect(() => {
    if (form.creditCardId && !partnerCards.find((c) => c.id === form.creditCardId)) {
      setForm((p) => ({ ...p, creditCardId: "" }));
    }
  }, [form.partnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When credit card changes: auto-populate return date + suggest profit %
  useEffect(() => {
    if (form.creditCardId && form.receivedDate) {
      const card = partnerCards.find((c) => c.id === form.creditCardId);
      if (card) {
        const nextDue = computeNextDueDate(card, form.receivedDate);
        setForm((p) => {
          // Auto-suggest profit %: ≤2,00,000 → 4%, >2,00,000 → 3.5%
          const amt = Number(p.amountStr);
          const suggestedProfit = amt > 0 ? (amt <= 200000 ? "4" : "3.5") : p.profitPercentStr;
          return { ...p, returnDate: nextDue, profitPercentStr: suggestedProfit };
        });
      }
    }
  }, [form.creditCardId, form.receivedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also re-compute profit % if amount changes while a card is selected
  useEffect(() => {
    if (form.creditCardId) {
      const amt = Number(form.amountStr);
      if (amt > 0) {
        const suggested = amt <= 200000 ? "4" : "3.5";
        setForm((p) => ({ ...p, profitPercentStr: suggested }));
      }
    }
  }, [form.amountStr]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate() {
    const e: Record<string, string> = {};
    if (!form.partnerId) e.partnerId = "Select a partner";
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
    onSave({
      partnerId: form.partnerId,
      amountRupees: Math.round(Number(form.amountStr)),
      profitPercent: Number(form.profitPercentStr),
      receivedDate: form.receivedDate,
      returnDate: form.returnDate || null,
      creditCardId: form.creditCardId || null,
      notes: form.notes,
    });
    onClose();
  }

  const set = (f: string, v: string) => {
    setForm((p) => ({ ...p, [f]: v }));
    setErrors((e) => ({ ...e, [f]: undefined as unknown as string }));
  };

  const selectedCard = partnerCards.find((c) => c.id === form.creditCardId);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-contrib-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="add-contrib-title">Record Capital Contribution</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close"><X size={18} /></button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="c-partner" className="form-label">Partner *</label>
            <SearchableSelect
              id="c-partner"
              options={partners.map((p) => ({ value: p.id, label: p.name }))}
              value={form.partnerId}
              onChange={(v) => set("partnerId", v)}
              placeholder="Select partner…"
              searchPlaceholder="Search partners…"
              hasError={!!errors.partnerId}
            />
            {errors.partnerId && <span className="form-error">{errors.partnerId}</span>}
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="c-amount" className="form-label">Amount (₹) *</label>
              <input id="c-amount" className={`form-input ${errors.amountStr ? "form-input--error" : ""}`} type="number" min="1" value={form.amountStr} onChange={(e) => set("amountStr", e.target.value)} placeholder="e.g. 500000" autoFocus />
              {errors.amountStr && <span className="form-error">{errors.amountStr}</span>}
              {form.amountStr && !isNaN(Number(form.amountStr)) && Number(form.amountStr) > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, display: "block" }}>
                  {amountToWords(Number(form.amountStr))}
                </span>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="c-profit" className="form-label">Profit % per month *</label>
              <input id="c-profit" className={`form-input ${errors.profitPercentStr ? "form-input--error" : ""}`} type="number" min="0" max="100" step="0.1" value={form.profitPercentStr} onChange={(e) => set("profitPercentStr", e.target.value)} placeholder="e.g. 3" />
              {errors.profitPercentStr && <span className="form-error">{errors.profitPercentStr}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="c-received" className="form-label">Date received *</label>
              <input id="c-received" className={`form-input ${errors.receivedDate ? "form-input--error" : ""}`} type="date" value={form.receivedDate} onChange={(e) => set("receivedDate", e.target.value)} />
              {errors.receivedDate && <span className="form-error">{errors.receivedDate}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="c-return" className="form-label">
                Return date
                {selectedCard && <span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 6 }}>(auto from card)</span>}
                {!selectedCard && <span className="form-label__optional"> (optional)</span>}
              </label>
              <input id="c-return" className="form-input" type="date" value={form.returnDate} min={form.receivedDate} onChange={(e) => set("returnDate", e.target.value)} />
            </div>
          </div>

          {/* Credit card selector */}
          {form.partnerId && (
            <div className="form-field">
              <label htmlFor="c-card" className="form-label">
                <CreditCardIcon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Payment source
              </label>
              <SearchableSelect
                id="c-card"
                options={[
                  { value: "", label: "Cash / Bank transfer", sublabel: "Default" },
                  ...partnerCards.map((c) => ({
                    value: c.id,
                    label: c.cardName,
                    sublabel: `Limit: ${fmt(c.cardLimit)}`,
                  })),
                ]}
                value={form.creditCardId}
                onChange={(v) => set("creditCardId", v)}
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
                  Bill gen: {formatDate(selectedCard.billGenerationDate)} · Due: {formatDate(selectedCard.dueDate)} · Next due from received date: <strong>{form.returnDate || "—"}</strong>
                </div>
              )}
            </div>
          )}

          <div className="form-field">
            <label htmlFor="c-notes" className="form-label">Notes</label>
            <textarea id="c-notes" className="form-input form-textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Tranche details, reference number…" />
          </div>
          {form.amountStr && form.profitPercentStr && (
            <div className="form-hint">
              Monthly profit: <strong>{fmt(Math.round(Number(form.amountStr) * Number(form.profitPercentStr) / 100))}</strong>
              &nbsp;· Annual: <strong>{fmt(Math.round(Number(form.amountStr) * Number(form.profitPercentStr) * 12 / 100))}</strong>
            </div>
          )}
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit"><PlusCircle size={16} /> Record Contribution</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Record Capital Return Modal ──────────────────────────────────────────────

function RecordCapitalReturnModal({
  onClose, onSave, allocations, partners,
}: {
  onClose: () => void;
  onSave: (input: AddCapitalReturnInput) => void;
  allocations: ReturnType<typeof useStore>["allocationSummaries"];
  partners: ReturnType<typeof useStore>["partners"];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const activeAllocs = allocations.filter((a) => !a.isFullyReturned);
  const [form, setForm] = useState({ allocationId: activeAllocs[0]?.id || "", amountStr: "", returnedDate: today, notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedAlloc = allocations.find((a) => a.id === form.allocationId);
  const partner = selectedAlloc ? partners.find((p) => p.id === selectedAlloc.partnerId) : undefined;

  function validate() {
    const e: Record<string, string> = {};
    if (!form.allocationId) e.allocationId = "Select an allocation";
    const amt = Number(form.amountStr);
    if (!form.amountStr || isNaN(amt) || amt <= 0) e.amountStr = "Enter a valid amount";
    if (selectedAlloc && amt > selectedAlloc.capitalOutstanding) e.amountStr = `Max outstanding: ${fmt(selectedAlloc.capitalOutstanding)}`;
    if (!form.returnedDate) e.returnedDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate() || !selectedAlloc) return;
    onSave({ allocationId: form.allocationId, partnerId: selectedAlloc.partnerId, amountRupees: Math.round(Number(form.amountStr)), returnedDate: form.returnedDate, notes: form.notes });
    onClose();
  }

  const set = (f: string, v: string) => { setForm((p) => ({ ...p, [f]: v })); setErrors((e) => ({ ...e, [f]: undefined as unknown as string })); };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cap-return-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="cap-return-title">Record Capital Return</h2>
          <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="cr-alloc" className="form-label">Allocation *</label>
            <SearchableSelect
              id="cr-alloc"
              options={activeAllocs.map((a) => {
                const p = partners.find((pt) => pt.id === a.partnerId);
                return {
                  value: a.id,
                  label: p?.name ?? a.partnerId,
                  sublabel: `${fmt(a.amountRupees)} · Outstanding: ${fmt(a.capitalOutstanding)}`,
                };
              })}
              value={form.allocationId}
              onChange={(v) => { set("allocationId", v); setForm((p) => ({ ...p, amountStr: "" })); }}
              placeholder="Select allocation…"
              searchPlaceholder="Search by partner name…"
              hasError={!!errors.allocationId}
            />
            {errors.allocationId && <span className="form-error">{errors.allocationId}</span>}
          </div>
          {selectedAlloc && (
            <div className="form-hint">
              Partner: <strong>{partner?.name}</strong> · Outstanding: <strong style={{ color: "var(--pending)" }}>{fmt(selectedAlloc.capitalOutstanding)}</strong>
              {selectedAlloc.creditCard && (
                <span style={{ marginLeft: 10 }}>
                  <CreditCardIcon size={12} style={{ verticalAlign: "middle", marginRight: 3 }} />
                  {selectedAlloc.creditCard.cardName}
                </span>
              )}
            </div>
          )}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="cr-amount" className="form-label">Amount returned (₹) *</label>
              <input id="cr-amount" className={`form-input ${errors.amountStr ? "form-input--error" : ""}`} type="number" min="1" value={form.amountStr} onChange={(e) => set("amountStr", e.target.value)} placeholder={selectedAlloc ? String(selectedAlloc.capitalOutstanding) : ""} autoFocus />
              {errors.amountStr && <span className="form-error">{errors.amountStr}</span>}
              {form.amountStr && !isNaN(Number(form.amountStr)) && Number(form.amountStr) > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, display: "block" }}>
                  {amountToWords(Number(form.amountStr))}
                </span>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="cr-date" className="form-label">Date returned *</label>
              <input id="cr-date" className={`form-input ${errors.returnedDate ? "form-input--error" : ""}`} type="date" value={form.returnedDate} onChange={(e) => set("returnedDate", e.target.value)} />
              {errors.returnedDate && <span className="form-error">{errors.returnedDate}</span>}
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="cr-notes" className="form-label">Notes</label>
            <textarea id="cr-notes" className="form-input form-textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Bank transfer ref, partial/full return…" />
          </div>
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit"><CheckCircle2 size={16} /> Record Return</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Contribution Modal ──────────────────────────────────────────────────
// Allows editing return date and linking / unlinking a credit card

function EditContributionModal({
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
  const [creditCardId, setCreditCardId] = useState(allocation.creditCardId || "");
  const [returnDate, setReturnDate] = useState(allocation.returnDate || "");
  const [saving, setSaving] = useState(false);

  const selectedCard = partnerCards.find((c) => c.id === creditCardId);

  // When card changes, offer to auto-update return date
  function handleCardChange(newCardId: string) {
    setCreditCardId(newCardId);
    if (newCardId) {
      const card = partnerCards.find((c) => c.id === newCardId);
      if (card && allocation.receivedDate) {
        const nextDue = computeNextDueDate(card, allocation.receivedDate);
        setReturnDate(nextDue);
      }
    }
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      await updateAllocationCreditCard(allocation.id, creditCardId || null, returnDate || null);
      onClose();
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
            <strong>{partner?.name ?? allocation.partnerId}</strong> · {fmt(allocation.amountRupees)} @ {allocation.profitPercent}% p.m. · Received {formatDate(allocation.receivedDate)}
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
              value={creditCardId}
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
                Auto-computed return date from received date ({formatDate(allocation.receivedDate)}): <strong>{computeNextDueDate(selectedCard, allocation.receivedDate)}</strong>
              </div>
            )}
          </div>

          {/* Return date */}
          <div className="form-field">
            <label htmlFor="ec-return-date" className="form-label">
              Return date
              {selectedCard && <span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 6 }}>(editable — auto-filled from card)</span>}
              {!selectedCard && <span className="form-label__optional"> (optional)</span>}
            </label>
            <input
              id="ec-return-date"
              className="form-input"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
            {returnDate && (
              <button
                type="button"
                style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", marginTop: 4, padding: 0 }}
                onClick={() => setReturnDate("")}
              >
                Clear date
              </button>
            )}
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

// ─── Edit Return Date Modal ───────────────────────────────────────────────────

function EditReturnDateModal({ allocationId, currentReturnDate, onClose }: { allocationId: string; currentReturnDate: string | null; onClose: () => void }) {
  const [value, setValue] = useState(currentReturnDate ?? "");

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    updateAllocationReturnDate(allocationId, value || null);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-return-title">
      <div className="modal">
        <div className="modal__header">
          <h2 id="edit-return-title">Edit Return Date</h2>
          <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="edit-return-date" className="form-label">Return date <span className="form-label__optional">(leave blank to remove)</span></label>
            <input id="edit-return-date" className="form-input" type="date" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </div>
          <div className="modal__footer">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit"><CalendarClock size={16} /> Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Pagination component ─────────────────────────────────────────────────────

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

// ─── Capital Contributions page ───────────────────────────────────────────────

export function CapitalContributionsPage() {
  const { allocationSummaries, partners, creditCards, addAllocation, addCapitalReturn } = useStore();
  const { isCFO } = useRole();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showWASummary, setShowWASummary] = useState(false);
  const [editContribId, setEditContribId] = useState<string | null>(null);
  const [editReturnId, setEditReturnId] = useState<string | null>(null);
  const [filterPartnerId, setFilterPartnerId] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL"); // ALL | ACTIVE | RETURNED
  const [filterSource, setFilterSource] = useState("ALL"); // ALL | CASH | CARD
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = allocationSummaries;
    if (filterPartnerId !== "ALL") result = result.filter((a) => a.partnerId === filterPartnerId);
    if (filterStatus === "ACTIVE") result = result.filter((a) => !a.isFullyReturned);
    if (filterStatus === "RETURNED") result = result.filter((a) => a.isFullyReturned);
    if (filterSource === "CASH") result = result.filter((a) => !a.creditCardId);
    if (filterSource === "CARD") result = result.filter((a) => !!a.creditCardId);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((a) => {
        const partnerName = (a.partner?.name || "").toLowerCase();
        const notes = (a.notes || "").toLowerCase();
        const amount = String(a.amountRupees);
        const rate = `${a.profitPercent}`;
        const status = a.isFullyReturned ? "returned" : "active";
        const cardName = (a.creditCard?.cardName || "").toLowerCase();
        return partnerName.includes(q) || notes.includes(q) || amount.includes(q) || rate.includes(q) || status.includes(q) || cardName.includes(q);
      });
    }
    return result;
  }, [allocationSummaries, filterPartnerId, filterStatus, filterSource, searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterPartnerId, filterStatus, filterSource, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalCapital = filtered.reduce((s, a) => s + a.amountRupees, 0);
  const totalOutstanding = filtered.reduce((s, a) => s + a.capitalOutstanding, 0);
  const totalReturned = filtered.reduce((s, a) => s + a.totalCapitalReturned, 0);
  const cashOutstanding = filtered.filter((a) => !a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0);
  const cardOutstanding = filtered.filter((a) => !!a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0);

  const editingContrib = editContribId ? allocationSummaries.find((a) => a.id === editContribId) : null;
  const editingAlloc = editReturnId ? allocationSummaries.find((a) => a.id === editReturnId) : null;

  const hasCards = creditCards.length > 0;

  function handleExportCSV() {
    downloadCSV(
      csvFilename("capital-contributions"),
      ["Partner", "Amount (₹)", "Profit % / mo", "Source", "Received", "Returned (₹)", "Outstanding (₹)", "Return Date", "Status", "Notes"],
      filtered.map((a) => [
        a.partner?.name ?? a.partnerId,
        a.amountRupees,
        a.profitPercent,
        a.creditCard ? a.creditCard.cardName : "Cash",
        a.receivedDate,
        a.totalCapitalReturned,
        a.capitalOutstanding,
        a.returnDate ?? "",
        a.isFullyReturned ? "Returned" : "Active",
        (a.notes ?? "").replace(/\s*WA_CONFIRMED\s*/g, "").trim(),
      ]),
    );
  }

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Capital inflow"
        title="Capital Contributions"
        description="Record capital received from partners, track returns, and manage return dates."
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {filtered.length > 0 && (
              <button className="button button--secondary" type="button" onClick={handleExportCSV}>
                <Download size={15} /> Export CSV
              </button>
            )}
            {isCFO && (
              <>
                <button className="button button--secondary" type="button" onClick={() => setShowWASummary(true)}>
                  <MessageSquare size={15} /> WhatsApp Summary
                </button>
                <button className="button button--secondary" type="button" onClick={() => setShowReturnModal(true)}>
                  <CheckCircle2 size={15} /> Record Return
                </button>
                <button className="button button--primary" type="button" onClick={() => setShowAddModal(true)}>
                  <PlusCircle size={16} /> Record Contribution
                </button>
              </>
            )}
          </div>
        }
      />

      {showWASummary && (
        <WhatsAppSummaryModal
          onClose={() => setShowWASummary(false)}
          allocationSummaries={allocationSummaries}
        />
      )}
      {showAddModal && (
        <AddContributionModal
          onClose={() => setShowAddModal(false)}
          onSave={(input) => addAllocation(input)}
          partners={partners}
          creditCards={creditCards}
        />
      )}
      {showReturnModal && (
        <RecordCapitalReturnModal
          onClose={() => setShowReturnModal(false)}
          onSave={(input) => addCapitalReturn(input)}
          allocations={allocationSummaries}
          partners={partners}
        />
      )}
      {editingContrib && (
        <EditContributionModal
          allocation={editingContrib}
          creditCards={creditCards}
          partners={partners}
          onClose={() => setEditContribId(null)}
        />
      )}
      {editingAlloc && (
        <EditReturnDateModal
          allocationId={editingAlloc.id}
          currentReturnDate={editingAlloc.returnDate}
          onClose={() => setEditReturnId(null)}
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
            <select className="select-filter__control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Outstanding</option>
              <option value="RETURNED">Fully returned</option>
            </select>
            {hasCards && (
              <select className="select-filter__control" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                <option value="ALL">All sources</option>
                <option value="CASH">Cash only</option>
                <option value="CARD">Card only</option>
              </select>
            )}
          </div>
          <div className="filter-bar__trailing">
            <span className="record-count">{filtered.length} allocation{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="ledger-summary" style={{ marginBottom: 12 }}>
          <div className="ledger-summary__item"><span>Total capital</span><strong style={{ fontSize: 17 }}>{fmt(totalCapital)}</strong></div>
          <div className="ledger-summary__divider" />
          <div className="ledger-summary__item"><span>Returned</span><strong style={{ fontSize: 17, color: "var(--incoming)" }}>{fmt(totalReturned)}</strong></div>
          <div className="ledger-summary__divider" />
          <div className="ledger-summary__item"><span>Outstanding</span><strong style={{ fontSize: 17, color: "var(--pending)" }}>{fmt(totalOutstanding)}</strong></div>
          {hasCards && cashOutstanding > 0 && (
            <>
              <div className="ledger-summary__divider" />
              <div className="ledger-summary__item"><span>Cash</span><strong style={{ fontSize: 17, color: "var(--pending)" }}>{fmt(cashOutstanding)}</strong></div>
            </>
          )}
          {hasCards && cardOutstanding > 0 && (
            <>
              <div className="ledger-summary__divider" />
              <div className="ledger-summary__item">
                <span><CreditCardIcon size={12} style={{ verticalAlign: "middle", marginRight: 3 }} />Card</span>
                <strong style={{ fontSize: 17, color: "var(--pending)" }}>{fmt(cardOutstanding)}</strong>
              </div>
            </>
          )}
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table" aria-label="Capital contributions">
          <thead>
            <tr>
              <th className="table-th">Partner</th>
              <th className="table-th table-th--money">Amount</th>
              <th className="table-th">Profit %</th>
              <th className="table-th">Source</th>
              <th className="table-th">Received</th>
              <th className="table-th table-th--money">Returned</th>
              <th className="table-th table-th--money">Outstanding</th>
              <th className="table-th">Return date</th>
              <th className="table-th">Status</th>
              <th className="table-th">Notes</th>
              <th className="table-th table-th--action"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <div className="table-empty">
                    <span className="empty-state__icon"><BadgeIndianRupee size={22} /></span>
                    <h3>No contributions yet</h3>
                    <p>Record a capital contribution to start tracking.</p>
                    <button className="button button--primary" onClick={() => setShowAddModal(true)} type="button"><PlusCircle size={15} /> Record Contribution</button>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((a) => (
                <tr className="table-row" key={a.id}>
                  <td className="table-cell">
                    <Link className="entity-link" to={`/partners/${a.partnerId}`}>{a.partner?.name ?? a.partnerId}</Link>
                  </td>
                  <td className="table-cell table-cell--money" data-label="Amount"><strong>{fmt(a.amountRupees)}</strong></td>
                  <td className="table-cell" data-label="Profit %">
                    <span className="party-type-chip party-type-chip--partner">{a.profitPercent}% p.m.</span>
                  </td>
                  <td className="table-cell" data-label="Source">
                    {a.creditCard ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                        <CreditCardIcon size={13} />
                        {a.creditCard.cardName}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>Cash</span>
                    )}
                  </td>
                  <td className="table-cell table-cell--secondary" data-label="Received">{formatDate(a.receivedDate)}</td>
                  <td className="table-cell table-cell--money" data-label="Returned" style={{ color: "var(--incoming)" }}>{fmt(a.totalCapitalReturned)}</td>
                  <td className="table-cell table-cell--money" data-label="Outstanding" style={{ color: a.capitalOutstanding > 0 ? "var(--pending)" : "var(--muted)", fontWeight: a.capitalOutstanding > 0 ? 700 : 400 }}>
                    {fmt(a.capitalOutstanding)}
                  </td>
                  <td className="table-cell table-cell--secondary" data-label="Return date">
                    {a.returnDate ? (
                      <span style={{ color: "var(--pending)" }}>
                        <CalendarClock size={13} style={{ verticalAlign: "middle", marginRight: 3 }} />
                        {formatDate(a.returnDate)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="table-cell" data-label="Status">
                    <span className={`status-badge ${a.isFullyReturned ? "status-badge--inactive" : "status-badge--active"}`}>
                      {a.isFullyReturned ? "Returned" : "Active"}
                    </span>
                  </td>
                   <td className="table-cell table-cell--secondary" data-label="Notes">{(a.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}</td>
                  <td className="table-cell table-cell--action">
                    {isCFO && (
                      <button
                        className="icon-button"
                        type="button"
                        title="Edit contribution (card, return date)"
                        onClick={() => setEditContribId(a.id)}
                      >
                        <Edit2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
