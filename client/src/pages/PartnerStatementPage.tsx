/**
 * PartnerStatementPage — Printable / PDF-ready capital account statement for a partner.
 *
 * Accessed at: /partners/:id/statement
 * 
 * Use the browser's Print (Cmd+P / Ctrl+P) → "Save as PDF" to generate a PDF.
 * Print CSS hides the header bar, sidebar, and action buttons for a clean statement.
 */

import { ArrowLeft, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { formatDate } from "../lib/format";
import { useStore } from "../useStore";

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

function fmtFull(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function PartnerStatementPage() {
  const { id } = useParams<{ id: string }>();
  const {
    getPartner,
    getAllocationsForPartner,
    getCapitalReturnsForPartner,
    getProfitRecordsForPartner,
    allocationSummaries,
    partnerSummaries,
  } = useStore();

  const partner = id ? getPartner(id) : undefined;
  const allocations = id ? getAllocationsForPartner(id) : [];
  const capitalReturns = id ? getCapitalReturnsForPartner(id) : [];
  const profitRecords = id ? getProfitRecordsForPartner(id) : [];
  const partnerSummary = partnerSummaries.find((ps) => ps.partner.id === id);
  const partnerAllocSummaries = allocationSummaries.filter((a) => a.partnerId === id);

  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });

  if (!partner) {
    return (
      <div className="list-page">
        <div className="table-empty">
          <h3>Partner not found</h3>
          <p>The partner you are looking for does not exist.</p>
          <Link className="button button--primary" to="/partners">Back to Partners</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="statement-page">
      {/* ── Screen-only action bar ── */}
      <div className="statement-actions no-print">
        <Link className="button button--secondary" to={`/partners/${id}`}>
          <ArrowLeft size={15} /> Back to Partner
        </Link>
        <button
          className="button button--primary"
          type="button"
          onClick={() => window.print()}
        >
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      {/* ── Statement document ── */}
      <div className="statement-document">

        {/* Header */}
        <div className="statement-header">
          <div className="statement-header__brand">
            <h1 className="statement-header__title">CapitalOS</h1>
            <p className="statement-header__subtitle">Capital Account Statement</p>
          </div>
          <div className="statement-header__meta">
            <p><strong>Generated:</strong> {generatedDate}</p>
            <p><strong>Statement for:</strong> {partner.name}</p>
          </div>
        </div>

        <div className="statement-divider" />

        {/* Partner info */}
        <div className="statement-section">
          <h2 className="statement-section__title">Partner Details</h2>
          <div className="statement-info-grid">
            <div className="statement-info-row">
              <span className="statement-info-row__label">Name</span>
              <span className="statement-info-row__value">{partner.name}</span>
            </div>
            {partner.phone && (
              <div className="statement-info-row">
                <span className="statement-info-row__label">Phone</span>
                <span className="statement-info-row__value">{partner.phone}</span>
              </div>
            )}
            {partner.email && (
              <div className="statement-info-row">
                <span className="statement-info-row__label">Email</span>
                <span className="statement-info-row__value">{partner.email}</span>
              </div>
            )}
            <div className="statement-info-row">
              <span className="statement-info-row__label">Partner since</span>
              <span className="statement-info-row__value">{formatDate(partner.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        {partnerSummary && (
          <>
            <div className="statement-divider" />
            <div className="statement-section">
              <h2 className="statement-section__title">Account Summary</h2>
              <div className="statement-summary-grid">
                <div className="statement-summary-card">
                  <span className="statement-summary-card__label">Total capital invested</span>
                  <strong className="statement-summary-card__value">{fmt(partnerSummary.totalCapital)}</strong>
                </div>
                <div className="statement-summary-card">
                  <span className="statement-summary-card__label">Capital returned</span>
                  <strong className="statement-summary-card__value statement-summary-card__value--positive">{fmt(partnerSummary.totalCapitalReturned)}</strong>
                </div>
                <div className="statement-summary-card">
                  <span className="statement-summary-card__label">Capital outstanding</span>
                  <strong className="statement-summary-card__value statement-summary-card__value--pending">{fmt(partnerSummary.capitalOutstanding)}</strong>
                </div>
                <div className="statement-summary-card">
                  <span className="statement-summary-card__label">Total profit paid</span>
                  <strong className="statement-summary-card__value statement-summary-card__value--positive">{fmt(partnerSummary.totalProfitPaid)}</strong>
                </div>
                <div className="statement-summary-card">
                  <span className="statement-summary-card__label">Profit pending</span>
                  <strong className="statement-summary-card__value statement-summary-card__value--outgoing">
                    {partnerSummary.totalProfitPending > 0 ? fmt(partnerSummary.totalProfitPending) : "Nil"}
                  </strong>
                </div>
                <div className="statement-summary-card">
                  <span className="statement-summary-card__label">Expected monthly profit</span>
                  <strong className="statement-summary-card__value">{fmt(partnerSummary.expectedMonthlyProfit)}</strong>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Capital Contributions */}
        <div className="statement-divider" />
        <div className="statement-section">
          <h2 className="statement-section__title">Capital Contributions ({allocations.length})</h2>
          {allocations.length === 0 ? (
            <p className="statement-empty">No capital contributions recorded.</p>
          ) : (
            <table className="statement-table">
              <thead>
                <tr>
                  <th>Date Received</th>
                  <th className="text-right">Amount</th>
                  <th>Rate</th>
                  <th>Source</th>
                  <th>Return Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc) => {
                  const summary = partnerAllocSummaries.find((s) => s.id === alloc.id);
                  return (
                    <tr key={alloc.id}>
                      <td>{formatDate(alloc.receivedDate)}</td>
                      <td className="text-right"><strong>{fmt(alloc.amountRupees)}</strong></td>
                      <td>{alloc.profitPercent}% p.m.</td>
                      <td>{alloc.creditCardId ? "Credit Card" : "Cash / Bank"}</td>
                      <td>{alloc.returnDate ? formatDate(alloc.returnDate) : "—"}</td>
                      <td>
                        <span className={summary?.isFullyReturned ? "stmt-badge stmt-badge--returned" : "stmt-badge stmt-badge--active"}>
                          {summary?.isFullyReturned ? "Returned" : "Active"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Total</strong></td>
                  <td className="text-right"><strong>{fmt(allocations.reduce((s, a) => s + a.amountRupees, 0))}</strong></td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Capital Returns */}
        {capitalReturns.length > 0 && (
          <>
            <div className="statement-divider" />
            <div className="statement-section">
              <h2 className="statement-section__title">Capital Returns ({capitalReturns.length})</h2>
              <table className="statement-table">
                <thead>
                  <tr>
                    <th>Date Returned</th>
                    <th className="text-right">Amount Returned</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {capitalReturns.map((cr) => (
                    <tr key={cr.id}>
                      <td>{formatDate(cr.returnedDate)}</td>
                      <td className="text-right" style={{ color: "var(--incoming, #16a34a)" }}>{fmt(cr.amountRupees)}</td>
                      <td>{(cr.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total returned</strong></td>
                    <td className="text-right"><strong style={{ color: "var(--incoming, #16a34a)" }}>
                      {fmt(capitalReturns.reduce((s, r) => s + r.amountRupees, 0))}
                    </strong></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* Profit Payments */}
        {profitRecords.length > 0 && (
          <>
            <div className="statement-divider" />
            <div className="statement-section">
              <h2 className="statement-section__title">Profit Payments ({profitRecords.length})</h2>
              <table className="statement-table">
                <thead>
                  <tr>
                    <th>Date Paid</th>
                    <th className="text-right">Amount Paid</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {profitRecords.map((pr) => (
                    <tr key={pr.id}>
                      <td>{formatDate(pr.paidDate)}</td>
                      <td className="text-right">{fmtFull(pr.amountRupees)}</td>
                      <td>{(pr.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total profit paid</strong></td>
                    <td className="text-right">
                      <strong>{fmt(profitRecords.reduce((s, r) => s + r.amountRupees, 0))}</strong>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="statement-divider" />
        <div className="statement-footer">
          <p>This statement was generated by CapitalOS on {generatedDate}.</p>
          <p>All amounts are in Indian Rupees (INR). This is an internal document.</p>
        </div>

      </div>
    </div>
  );
}
