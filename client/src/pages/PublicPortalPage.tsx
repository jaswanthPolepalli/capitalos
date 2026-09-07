/**
 * Public portal — read-only views shared with partners and CEOs.
 *
 * Partner view: total capital, profits received/pending per allocation,
 *   profit %, return dates, payment history.
 *
 * CEO view: total capital outstanding, pending profits per capital source,
 *   each capital return date.
 *
 * This page is intentionally simple and shows ONLY the data relevant
 * to the party viewing it. No CFO notes, no other partners' data.
 */

import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  CreditCard as CreditCardIcon,
  IndianRupee,
  Landmark,
  Loader2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { formatDate } from "../lib/format";
import * as Store from "../store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

function KPI({
  label,
  value,
  sub,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  Icon: React.ElementType;
  tone?: "positive" | "pending" | "neutral";
}) {
  const color =
    tone === "positive" ? "var(--incoming)" : tone === "pending" ? "var(--pending)" : "var(--text)";
  return (
    <div className="public-kpi-card">
      <div className="public-kpi-card__header">
        <span>{label}</span>
        <Icon size={17} aria-hidden="true" />
      </div>
      <strong className="public-kpi-card__value" style={{ color }}>
        {value}
      </strong>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>{sub}</p>}
    </div>
  );
}

// ─── Token resolution ─────────────────────────────────────────────────────────
// Tokens are in the format:  partner-<id>  or  ceo-<id>
// The CFO generates these from the Portal Links page and shares them.

interface ResolvedAccess {
  type: "partner" | "ceo";
  id: string;
}

function resolveToken(token: string): ResolvedAccess | null {
  if (token.startsWith("partner-")) {
    const id = token.replace("partner-", "");
    const partner = Store.getPartner(id);
    if (partner) return { type: "partner", id };
  }
  if (token.startsWith("ceo-")) {
    // CEO view shows aggregate portfolio data — for now stub
    return { type: "ceo", id: token.replace("ceo-", "") };
  }
  return null;
}

// ─── Partner portal content ───────────────────────────────────────────────────

type AllocFilter = "all" | "active" | "returned" | "unpaid";

function PartnerPortalContent({ partnerId }: { partnerId: string }) {
  const partner = Store.getPartner(partnerId);
  if (!partner) return <PortalError message="Partner record not found." />;

  // ─── Filters ───────────────────────────────────────────────────────────────
  const [allocFilter, setAllocFilter] = useState<AllocFilter>("all");
  const [payFrom, setPayFrom] = useState("");
  const [payTo, setPayTo] = useState("");
  const [payPage, setPayPage] = useState(1);
  const PAY_PAGE_SIZE = 10;

  // Use AllocationSummary which includes capitalOutstanding, isFullyReturned, etc.
  const allocations = Store.getAllocationSummaries().filter((a) => a.partnerId === partnerId);
  const allPayments = Store.getProfitRecordsForPartner(partnerId).sort((a, b) =>
    b.paidDate.localeCompare(a.paidDate),
  );
  // Capital return records — used to show the actual return date when capital is fully returned
  const capitalReturns = Store.getCapitalReturnsForPartner(partnerId);

  // Filtered allocations
  const filteredAllocations = useMemo(() => {
    if (allocFilter === "active") return allocations.filter((a) => !a.isFullyReturned);
    if (allocFilter === "returned") return allocations.filter((a) => a.isFullyReturned);
    if (allocFilter === "unpaid") return allocations.filter((a) => a.profitPending > 0);
    return allocations;
  }, [allocations, allocFilter]);

  // Filtered payments (newest first — sort already applied above)
  const filteredPayments = useMemo(() => {
    return allPayments.filter((r) => {
      if (payFrom && r.paidDate < payFrom) return false;
      if (payTo && r.paidDate > payTo) return false;
      return true;
    });
  }, [allPayments, payFrom, payTo]);

  // Reset to page 1 when filter changes (must be in useEffect, not useMemo)
  useEffect(() => {
    setPayPage(1);
  }, [payFrom, payTo]);

  // Paginated slice
  const totalPayPages = Math.max(1, Math.ceil(filteredPayments.length / PAY_PAGE_SIZE));
  const pagedPayments = filteredPayments.slice(
    (payPage - 1) * PAY_PAGE_SIZE,
    payPage * PAY_PAGE_SIZE,
  );

  // KPIs always use all allocations (unfiltered)
  const totalCapitalOutstanding = allocations.reduce((s, a) => s + a.capitalOutstanding, 0);
  const totalCapitalReturned = allocations.reduce((s, a) => s + a.totalCapitalReturned, 0);
  const totalProfitPaid = allocations.reduce((s, a) => s + a.totalProfitPaid, 0);
  const totalProfitPending = allocations.reduce((s, a) => s + a.profitPending, 0);

  // Cash vs card split — only show if partner has any card-funded allocations
  const cashOutstanding = allocations.filter((a) => !a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0);
  const cardOutstanding = allocations.filter((a) => !!a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0);
  const hasCardAllocations = allocations.some((a) => !!a.creditCardId);
  // Only show upcoming return dates for allocations that haven't been fully returned
  const nextReturnDate = allocations
    .filter((a) => !a.isFullyReturned)
    .map((a) => a.returnDate)
    .filter((d): d is string => d !== null)
    .sort()[0] ?? null;

  // Totals for filtered rows
  const filteredProfitPaid = filteredAllocations.reduce((s, a) => s + a.totalProfitPaid, 0);
  const filteredProfitPending = filteredAllocations.reduce((s, a) => s + a.profitPending, 0);

  return (
    <div className="public-portal__content">
      {/* Header */}
      <section className="public-portal__header-card" aria-label="Your position">
        <div className="public-portal__party">
          <span className="public-portal__avatar" aria-hidden="true">
            {partner.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1>{partner.name}</h1>
            <p className="public-portal__code">Capital Partner</p>
            {partner.phone && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>{partner.phone}</p>}
            {partner.email && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>{partner.email}</p>}
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="public-portal__kpis" aria-label="Financial summary">
        {/* If partner has credit card allocations, show total + cash + card split; otherwise just total */}
        {!hasCardAllocations ? (
          <KPI
            label="Capital outstanding"
            value={fmt(totalCapitalOutstanding)}
            Icon={IndianRupee}
            {...(totalCapitalReturned > 0 ? { sub: `₹${totalCapitalReturned.toLocaleString("en-IN")} returned` } : {})}
          />
        ) : (
          <>
            <KPI
              label="Total outstanding"
              value={fmt(totalCapitalOutstanding)}
              Icon={IndianRupee}
              {...(totalCapitalReturned > 0 ? { sub: `₹${totalCapitalReturned.toLocaleString("en-IN")} returned` } : {})}
            />
            <KPI
              label="Cash outstanding"
              value={fmt(cashOutstanding)}
              Icon={IndianRupee}
              sub="Cash / bank capital"
              tone={cashOutstanding > 0 ? "pending" : "neutral"}
            />
            <KPI
              label="Card outstanding"
              value={fmt(cardOutstanding)}
              Icon={CreditCardIcon}
              sub="Credit card capital"
              tone={cardOutstanding > 0 ? "pending" : "neutral"}
            />
          </>
        )}
        <KPI label="Profit paid" value={fmt(totalProfitPaid)} Icon={TrendingDown} tone="positive" />
        <KPI
          label="Profit pending"
          value={fmt(totalProfitPending)}
          Icon={TrendingUp}
          tone={totalProfitPending > 0 ? "pending" : "neutral"}
        />
        {nextReturnDate && (
          <KPI
            label="Nearest return date"
            value={formatDate(nextReturnDate)}
            sub="Capital return obligation"
            Icon={CalendarClock}
            tone="pending"
          />
        )}
      </section>

      {/* Per-allocation detail */}
      {allocations.length > 0 && (
        <section className="public-portal__section" aria-labelledby="alloc-title">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
            <h2 id="alloc-title" style={{ margin: 0 }}>Your capital allocations</h2>
            {/* Status filter */}
            <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Filter allocations by status">
              {(["all", "active", "unpaid", "returned"] as AllocFilter[]).map((f) => {
                const isActive = allocFilter === f;
                const isUnpaid = f === "unpaid";
                return (
                  <button
                    key={f}
                    onClick={() => setAllocFilter(f)}
                    type="button"
                    style={{
                      padding: "4px 12px",
                      borderRadius: 999,
                      border: "1px solid",
                      fontSize: 12,
                      fontWeight: 650,
                      cursor: "pointer",
                      background: isActive
                        ? (isUnpaid ? "var(--pending)" : "var(--accent)")
                        : "var(--surface)",
                      color: isActive
                        ? "#fff"
                        : (isUnpaid ? "var(--pending)" : "var(--muted)"),
                      borderColor: isActive
                        ? (isUnpaid ? "var(--pending)" : "var(--accent)")
                        : (isUnpaid ? "var(--pending)" : "var(--border)"),
                    }}
                  >
                    {f === "unpaid" ? "Profit Pending" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="public-portal__table-wrapper">
            <table className="public-portal__table" aria-label="Capital allocations">
              <thead>
                <tr>
                  <th className="public-portal__th--money">Capital</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Est. rate</th>
                  <th>Deployed since</th>
                  <th>Return date</th>
                  <th className="public-portal__th--money">Profit received</th>
                  <th>Effective %</th>
                  <th className="public-portal__th--money">Profit pending</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllocations.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: "20px 10px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                      No allocations match this filter.
                    </td>
                  </tr>
                )}
                {filteredAllocations.map((a) => {
                  // Effective profit % = total profit paid ÷ capital × 100
                  // Shows the real rate actually achieved vs the rough estimate
                  const effectivePct = a.amountRupees > 0 && a.totalProfitPaid > 0
                    ? ((a.totalProfitPaid / a.amountRupees) * 100).toFixed(2)
                    : null;
                  const isAboveEstimate = effectivePct !== null && parseFloat(effectivePct) > a.profitPercent;
                  const isBelowEstimate = effectivePct !== null && parseFloat(effectivePct) < a.profitPercent;

                  // For fully returned allocations, find the actual date capital was returned
                  const actualReturnDate = a.isFullyReturned
                    ? capitalReturns
                        .filter((cr) => cr.allocationId === a.id)
                        .reduce<string | null>((latest, cr) =>
                          !latest || cr.returnedDate > latest ? cr.returnedDate : latest,
                          null,
                        )
                    : null;

                  return (
                  <tr key={a.id} style={a.isFullyReturned ? { opacity: 0.6 } : undefined}>
                    <td className="public-portal__td--money">
                      <strong>{fmt(a.amountRupees)}</strong>
                      {a.totalCapitalReturned > 0 && a.totalCapitalReturned < a.amountRupees && (
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                          {fmt(a.totalCapitalReturned)} returned
                        </div>
                      )}
                    </td>
                    <td>
                      {a.isFullyReturned ? (
                        <span className="public-portal__status public-portal__status--paid">
                          Returned
                        </span>
                      ) : (
                        <span className="public-portal__status" style={{ background: "var(--incoming-soft)", color: "var(--incoming)" }}>
                          Active
                        </span>
                      )}
                    </td>
                    <td>
                      {a.creditCard ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--accent)" }}>
                          <CreditCardIcon size={12} />
                          {a.creditCard.cardName}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>Cash</span>
                      )}
                    </td>
                    <td>
                      <span className="public-portal__status public-portal__status--pending" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                        {a.profitPercent}% p.m.
                      </span>
                    </td>
                    <td>{formatDate(a.receivedDate)}</td>
                    <td>
                      {actualReturnDate ? (
                        // Show the real date capital was returned
                        <span style={{ color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CalendarClock size={12} />
                          {formatDate(actualReturnDate)}
                          <span style={{ fontSize: 9, marginLeft: 2 }}>(actual)</span>
                        </span>
                      ) : a.returnDate ? (
                        // Show the scheduled return date
                        <span style={{ color: "var(--pending)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CalendarClock size={12} />
                          {formatDate(a.returnDate)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="public-portal__td--money" style={{ color: "var(--incoming)" }}>
                      {fmt(a.totalProfitPaid)}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {effectivePct !== null ? (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontWeight: 700,
                          fontSize: 12,
                          color: isAboveEstimate ? "var(--incoming)" : isBelowEstimate ? "var(--pending)" : "var(--text)",
                        }}>
                          {effectivePct}%
                          {isAboveEstimate && <TrendingUp size={11} />}
                          {isBelowEstimate && <TrendingDown size={11} />}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td className="public-portal__td--money" style={{ color: a.profitPending > 0 ? "var(--pending)" : "var(--muted)" }}>
                      <strong>{fmt(a.profitPending)}</strong>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)" }}>
                  <td colSpan={7} style={{ padding: "10px 10px", fontWeight: 700, color: "var(--muted)", fontSize: 11 }}>
                    {allocFilter !== "all" ? `TOTAL (${allocFilter})` : "TOTAL"}
                  </td>
                  <td className="public-portal__td--money" style={{ padding: "10px 10px", color: "var(--incoming)", fontWeight: 700 }}>
                    {fmt(filteredProfitPaid)}
                  </td>
                  <td className="public-portal__td--money" style={{ padding: "10px 10px", color: "var(--pending)", fontWeight: 700 }}>
                    {fmt(filteredProfitPending)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Payment history */}
      {allPayments.length > 0 && (
        <section className="public-portal__section" aria-labelledby="history-title">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
            <h2 id="history-title" style={{ margin: 0 }}>Profit payment history</h2>
            {/* Date range filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>From</span>
              <input
                type="date"
                value={payFrom}
                onChange={(e) => setPayFrom(e.target.value)}
                style={{
                  padding: "4px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 12,
                  background: "var(--surface)",
                  color: "var(--text)",
                  outline: "none",
                }}
                aria-label="Filter from date"
              />
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>To</span>
              <input
                type="date"
                value={payTo}
                onChange={(e) => setPayTo(e.target.value)}
                style={{
                  padding: "4px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 12,
                  background: "var(--surface)",
                  color: "var(--text)",
                  outline: "none",
                }}
                aria-label="Filter to date"
              />
              {(payFrom || payTo) && (
                <button
                  type="button"
                  onClick={() => { setPayFrom(""); setPayTo(""); }}
                  style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", textDecoration: "underline" }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="public-portal__table-wrapper">
            <table className="public-portal__table" aria-label="Payment history">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Capital allocation</th>
                  <th className="public-portal__th--money">Amount received</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: "20px 10px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                      No payments in this date range.
                    </td>
                  </tr>
                )}
                {pagedPayments.map((r) => {
                  const alloc = allocations.find((a) => a.id === r.allocationId);
                  return (
                    <tr key={r.id}>
                      <td>{formatDate(r.paidDate)}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>
                        {alloc ? `${fmt(alloc.amountRupees)} @ ${alloc.profitPercent}% p.m.` : "—"}
                      </td>
                      <td className="public-portal__td--money" style={{ color: "var(--incoming)" }}>
                        <strong>{fmt(r.amountRupees)}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredPayments.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)" }}>
                    <td colSpan={2} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                      {(payFrom || payTo) ? "TOTAL (filtered)" : "TOTAL"}
                      <span style={{ fontWeight: 400, marginLeft: 8 }}>
                        {filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="public-portal__td--money" style={{ padding: "8px 10px", color: "var(--incoming)", fontWeight: 700 }}>
                      {fmt(filteredPayments.reduce((s, r) => s + r.amountRupees, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination controls */}
          {totalPayPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Page {payPage} of {totalPayPages} · showing {(payPage - 1) * PAY_PAGE_SIZE + 1}–{Math.min(payPage * PAY_PAGE_SIZE, filteredPayments.length)} of {filteredPayments.length}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setPayPage((p) => Math.max(1, p - 1))}
                  disabled={payPage <= 1}
                  style={{
                    padding: "4px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    background: "var(--surface)",
                    color: payPage <= 1 ? "var(--muted)" : "var(--text)",
                    fontSize: 12,
                    cursor: payPage <= 1 ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPayPage((p) => Math.min(totalPayPages, p + 1))}
                  disabled={payPage >= totalPayPages}
                  style={{
                    padding: "4px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    background: "var(--surface)",
                    color: payPage >= totalPayPages ? "var(--muted)" : "var(--text)",
                    fontSize: 12,
                    cursor: payPage >= totalPayPages ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── CEO portal content ───────────────────────────────────────────────────────
// Shows the CFO's portfolio from the CEO's perspective:
// total capital outstanding, pending profits, capital return obligations.

function CEOPortalContent() {
  const allocationSummaries = Store.getAllocationSummaries();

  // Table 1: All active capital (not fully returned), sorted by return obligation date
  // Items with no return date go to the end
  const capitalSchedule = allocationSummaries
    .filter((a) => !a.isFullyReturned)
    .sort((a, b) => {
      if (a.returnDate && b.returnDate) return a.returnDate > b.returnDate ? 1 : -1;
      if (a.returnDate) return -1;
      if (b.returnDate) return 1;
      return a.receivedDate.localeCompare(b.receivedDate);
    });

  // Table 2: Allocations with pending profit (amount + taken date), sorted by taken date
  const pendingProfitAllocations = allocationSummaries
    .filter((a) => a.profitPending > 0)
    .sort((a, b) => a.receivedDate.localeCompare(b.receivedDate));

  // Total outstanding = sum of capital not yet returned
  const totalOutstanding = allocationSummaries.reduce((s, a) => s + a.capitalOutstanding, 0);
  const cashOutstanding = allocationSummaries.filter((a) => !a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0);
  const cardOutstanding = allocationSummaries.filter((a) => !!a.creditCardId).reduce((s, a) => s + a.capitalOutstanding, 0);

  return (
    <div className="public-portal__content">
      {/* Header */}
      <section className="public-portal__header-card" aria-label="Portfolio overview">
        <div className="public-portal__party">
          <span className="public-portal__avatar public-portal__avatar--business" aria-hidden="true">
            <Landmark size={24} />
          </span>
          <div>
            <h1>Capital Portfolio</h1>
            <p className="public-portal__code">CFO Overview · Read-only</p>
          </div>
        </div>
      </section>

      {/* KPIs — total, cash and card outstanding */}
      <section className="public-portal__kpis" aria-label="Portfolio summary">
        <KPI label="Total outstanding" value={fmt(totalOutstanding)} Icon={IndianRupee} sub="All capital not yet returned" />
        <KPI label="Cash outstanding" value={fmt(cashOutstanding)} Icon={IndianRupee} sub="Cash / bank capital" tone={cashOutstanding > 0 ? "pending" : "neutral"} />
        <KPI label="Card outstanding" value={fmt(cardOutstanding)} Icon={CreditCardIcon} sub="Credit card capital" tone={cardOutstanding > 0 ? "pending" : "neutral"} />
      </section>

      {/* Table 1: Capital pending with obligation date — sorted by return obligation date */}
      {capitalSchedule.length > 0 && (
        <section className="public-portal__section" aria-labelledby="returns-title">
          <h2 id="returns-title">Capital return schedule</h2>
          <div className="public-portal__table-wrapper">
            <table className="public-portal__table" aria-label="Capital return schedule">
              <thead>
                <tr>
                  <th className="public-portal__th--money">Amount</th>
                  <th>Source</th>
                  <th>Amount taken date</th>
                  <th>Return obligation date</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {capitalSchedule.map((a) => (
                  <tr key={a.id}>
                    <td className="public-portal__td--money">
                      <strong>{fmt(a.capitalOutstanding)}</strong>
                    </td>
                    <td>
                      {a.creditCard ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--accent)" }}>
                          <CreditCardIcon size={12} />
                          {a.creditCard.cardName}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>Cash</span>
                      )}
                    </td>
                    <td>{formatDate(a.receivedDate)}</td>
                    <td style={{ color: a.returnDate ? "var(--pending)" : "var(--muted)" }}>
                      {a.returnDate ? (
                        <>
                          <CalendarClock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                          {formatDate(a.returnDate)}
                        </>
                      ) : "—"}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>
                      {(a.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Table 2: Profit pending — amount taken + date, total profit pending */}
      {pendingProfitAllocations.length > 0 && (
        <section className="public-portal__section" aria-labelledby="pending-title">
          <h2 id="pending-title">Pending profit obligations</h2>
          <div className="public-portal__table-wrapper">
            <table className="public-portal__table" aria-label="Pending profit obligations">
              <thead>
                <tr>
                  <th className="public-portal__th--money">Amount taken</th>
                  <th>Amount taken date</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {pendingProfitAllocations.map((a) => (
                  <tr key={a.id}>
                    <td className="public-portal__td--money">
                      <strong>{fmt(a.amountRupees)}</strong>
                    </td>
                    <td>{formatDate(a.receivedDate)}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>
                      {(a.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function PortalError({ message }: { message: string }) {
  return (
    <div className="public-portal__error">
      <AlertTriangle size={28} aria-hidden="true" />
      <h2>Unable to load portal</h2>
      <p>{message}</p>
    </div>
  );
}

function InvalidToken() {
  return (
    <main className="public-portal-shell">
      <div className="public-portal__brand">
        <Landmark size={20} aria-hidden="true" />
        <span>CapitalOS</span>
      </div>
      <div className="public-portal__error public-portal__error--center">
        <AlertTriangle size={32} aria-hidden="true" />
        <h1>Link unavailable</h1>
        <p>
          This portal link is invalid or has been revoked.
          Contact the CFO to request a new link.
        </p>
      </div>
    </main>
  );
}

function PortalLoading() {
  return (
    <main className="public-portal-shell">
      <div className="public-portal__brand">
        <Landmark size={20} aria-hidden="true" />
        <span>CapitalOS</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "80px 20px", color: "var(--muted)" }}>
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} aria-hidden="true" />
        <p style={{ margin: 0, fontSize: 14 }}>Loading your portal…</p>
      </div>
    </main>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PublicPortalPage() {
  const { token } = useParams<{ token: string }>();
  const reduceMotion = useReducedMotion();

  // Subscribe to store loading state — the store loads data asynchronously
  // from the Catalyst API. We must wait until it's ready before resolving
  // the token, otherwise getPartner() returns undefined and the portal
  // incorrectly shows "Link unavailable".
  const [loaded, setLoaded] = useState(() => Store.isLoaded());

  useEffect(() => {
    if (Store.isLoaded()) {
      setLoaded(true);
      return;
    }
    // Subscribe so we re-render once data arrives
    const unsub = Store.subscribe(() => {
      if (Store.isLoaded()) setLoaded(true);
    });
    // Trigger a load in case it hasn't started yet (e.g. direct link open)
    Store.loadAll();
    return () => { unsub(); };
  }, []);

  // Show spinner while data is in-flight
  if (!loaded) {
    return <PortalLoading />;
  }

  const access = token ? resolveToken(token) : null;

  if (!access) {
    return <InvalidToken />;
  }

  return (
    <main className="public-portal-shell">
      <header className="public-portal__nav" aria-label="CapitalOS portal">
        <div className="public-portal__brand">
          <Landmark size={20} aria-hidden="true" />
          <span>CapitalOS</span>
        </div>
        <span className="public-portal__secure-badge">
          <ShieldCheck size={14} aria-hidden="true" />
          Secure · Read-only
        </span>
      </header>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {access.type === "partner" ? (
          <PartnerPortalContent partnerId={access.id} />
        ) : (
          <CEOPortalContent />
        )}
      </motion.div>

      <footer className="public-portal__footer">
        <p>This page is read-only and shows only your authorised financial information.</p>
        <p>Powered by CapitalOS · Zoho Catalyst</p>
      </footer>
    </main>
  );
}
