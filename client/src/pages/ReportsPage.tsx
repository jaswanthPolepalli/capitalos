/**
 * ReportsPage — F6: Financial Summary Reports
 *
 * Three report types:
 *   1. Profit & Loss Summary (CFO net margin)
 *   2. Capital Flow Summary
 *   3. Outstanding Obligations
 *
 * Period selection: Monthly / Quarterly / Annual / Custom
 * Export: CSV download (in-browser, no server needed)
 */

import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart2,
  CalendarClock,
  Download,
  IndianRupee,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "../components/PageHeader";
import { PortfolioTrendCharts } from "../components/PortfolioTrendCharts";
import { useStore } from "../useStore";

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// ─── Period types ─────────────────────────────────────────────────────────────

type PeriodType = "monthly" | "quarterly" | "annual" | "custom";

interface Period {
  type: PeriodType;
  year: number;
  month?: number;   // 1–12
  quarter?: number; // 1–4
  from?: string;    // ISO date for custom
  to?: string;      // ISO date for custom
}

function getPeriodLabel(p: Period): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (p.type === "monthly" && p.month) return `${months[p.month - 1]} ${p.year}`;
  if (p.type === "quarterly" && p.quarter) return `Q${p.quarter} ${p.year}`;
  if (p.type === "annual") return `FY ${p.year}`;
  if (p.type === "custom" && p.from && p.to) return `${p.from} → ${p.to}`;
  return "All time";
}

function getPeriodRange(p: Period): { from: string; to: string } | null {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (p.type === "monthly" && p.month) {
    const lastDay = new Date(p.year, p.month, 0).getDate();
    return { from: `${p.year}-${pad(p.month)}-01`, to: `${p.year}-${pad(p.month)}-${lastDay}` };
  }
  if (p.type === "quarterly" && p.quarter) {
    const startMonth = (p.quarter - 1) * 3 + 1;
    const endMonth = p.quarter * 3;
    const lastDay = new Date(p.year, endMonth, 0).getDate();
    return { from: `${p.year}-${pad(startMonth)}-01`, to: `${p.year}-${pad(endMonth)}-${lastDay}` };
  }
  if (p.type === "annual") {
    return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  }
  if (p.type === "custom" && p.from && p.to) {
    return { from: p.from, to: p.to };
  }
  return null;
}

// ─── Period selector ──────────────────────────────────────────────────────────

function PeriodSelector({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div className="report-period-bar">
      <div className="report-period-tabs">
        {(["monthly", "quarterly", "annual", "custom"] as PeriodType[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`report-tab${period.type === t ? " report-tab--active" : ""}`}
            onClick={() => onChange({ ...period, type: t })}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="report-period-controls">
        {period.type !== "custom" && (
          <select
            className="form-input"
            style={{ width: "auto", minWidth: 90 }}
            value={period.year}
            onChange={(e) => onChange({ ...period, year: Number(e.target.value) })}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {period.type === "monthly" && (
          <select
            className="form-input"
            style={{ width: "auto", minWidth: 130 }}
            value={period.month ?? new Date().getMonth() + 1}
            onChange={(e) => onChange({ ...period, month: Number(e.target.value) })}
          >
            {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        )}
        {period.type === "quarterly" && (
          <select
            className="form-input"
            style={{ width: "auto", minWidth: 80 }}
            value={period.quarter ?? Math.ceil((new Date().getMonth() + 1) / 3)}
            onChange={(e) => onChange({ ...period, quarter: Number(e.target.value) })}
          >
            {[1,2,3,4].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
        )}
        {period.type === "custom" && (
          <>
            <input
              type="date"
              className="form-input"
              style={{ width: "auto" }}
              value={period.from ?? ""}
              onChange={(e) => onChange({ ...period, from: e.target.value })}
            />
            <span style={{ color: "var(--muted)", fontSize: 13 }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ width: "auto" }}
              value={period.to ?? ""}
              onChange={(e) => onChange({ ...period, to: e.target.value })}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: [string, string][]) {
  const csv = rows.map(([k, v]) => `"${k}","${v}"`).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Report card ──────────────────────────────────────────────────────────────

function ReportRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className={`report-row${bold ? " report-row--total" : ""}`}>
      <span className="report-row__label">{label}</span>
      <span className="report-row__value" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { ledger, allocationSummaries, partnerSummaries } = useStore();
  const today = new Date();
  const [period, setPeriod] = useState<Period>({
    type: "monthly",
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });

  const range = getPeriodRange(period);

  // Filter ledger to period
  const filteredLedger = useMemo(() => {
    if (!range) return ledger;
    return ledger.filter((e) => e.date >= range.from && e.date <= range.to);
  }, [ledger, range]);

  // ── Profit & Loss ──
  const profitPaidInPeriod = filteredLedger
    .filter((e) => e.eventType === "PROFIT_PAID")
    .reduce((s, e) => s + e.amountRupees, 0);

  // For this app, CEOs pay back profit to CFO — we don't have CEO_PROFIT_RECEIVED in this ledger model
  // so we treat partner profit paid as the outflow, and capital received vs returned as the flow
  const capitalReceivedInPeriod = filteredLedger
    .filter((e) => e.eventType === "CAPITAL_RECEIVED")
    .reduce((s, e) => s + e.amountRupees, 0);

  const capitalReturnedInPeriod = filteredLedger
    .filter((e) => e.eventType === "CAPITAL_RETURNED")
    .reduce((s, e) => s + e.amountRupees, 0);

  // ── Outstanding (always all-time, not period-filtered) ──
  const totalCapitalOutstanding = allocationSummaries.reduce((s, a) => s + a.capitalOutstanding, 0);
  const totalProfitPending = partnerSummaries.reduce((s, ps) => s + ps.totalProfitPending, 0);
  const totalLiability = totalCapitalOutstanding + totalProfitPending;
  const totalCapitalDeployed = allocationSummaries.reduce((s, a) => s + a.amountRupees, 0);
  const totalProfitPaid = allocationSummaries.reduce((s, a) => s + a.totalProfitPaid, 0);

  const periodLabel = getPeriodLabel(period);
  const filename = `CapitalOS-Report-${periodLabel.replace(/\s+/g, "-").replace(/→/g, "to")}.csv`;

  function handleExportCSV() {
    const rows: [string, string][] = [
      ["Report", `CapitalOS Financial Summary — ${periodLabel}`],
      ["Generated", new Date().toLocaleString("en-IN")],
      ["", ""],
      ["=== CAPITAL FLOW ===", ""],
      ["Capital received (period)", fmt(capitalReceivedInPeriod)],
      ["Capital returned (period)", fmt(capitalReturnedInPeriod)],
      ["Net capital deployed (period)", fmt(capitalReceivedInPeriod - capitalReturnedInPeriod)],
      ["", ""],
      ["=== PROFIT OUTFLOW ===", ""],
      ["Profit paid to partners (period)", fmt(profitPaidInPeriod)],
      ["", ""],
      ["=== OUTSTANDING OBLIGATIONS (all-time) ===", ""],
      ["Total capital outstanding", fmt(totalCapitalOutstanding)],
      ["Total profit pending", fmt(totalProfitPending)],
      ["Total liability", fmt(totalLiability)],
      ["", ""],
      ["=== PORTFOLIO TOTALS (all-time) ===", ""],
      ["Total capital deployed", fmt(totalCapitalDeployed)],
      ["Total profit paid", fmt(totalProfitPaid)],
    ];
    downloadCSV(filename, rows);
  }

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Financial reports"
        title="Reports"
        description="Period-wise summaries of capital flows, profit obligations, and portfolio health."
        actions={
          <button className="button button--secondary" type="button" onClick={handleExportCSV}>
            <Download size={15} /> Export CSV
          </button>
        }
      />

      <PeriodSelector period={period} onChange={setPeriod} />

      <div className="reports-grid">

        {/* ── Capital Flow ── */}
        <section className="report-card">
          <div className="report-card__header">
            <div className="report-card__icon-wrap" style={{ background: "var(--incoming-soft)" }}>
              <IndianRupee size={16} style={{ color: "var(--incoming)" }} />
            </div>
            <div>
              <h2>Capital Flow</h2>
              <p className="report-card__sub">{periodLabel}</p>
            </div>
          </div>
          <div className="report-card__body">
            <ReportRow
              label="Capital received from partners"
              value={fmt(capitalReceivedInPeriod)}
              color="var(--incoming)"
            />
            <ReportRow
              label="Capital returned to partners"
              value={fmt(capitalReturnedInPeriod)}
              color="var(--outgoing)"
            />
            <div className="report-divider" />
            <ReportRow
              label="Net capital deployed (period)"
              value={fmt(capitalReceivedInPeriod - capitalReturnedInPeriod)}
              color={capitalReceivedInPeriod >= capitalReturnedInPeriod ? "var(--incoming)" : "var(--outgoing)"}
              bold
            />
          </div>
        </section>

        {/* ── Profit Summary ── */}
        <section className="report-card">
          <div className="report-card__header">
            <div className="report-card__icon-wrap" style={{ background: "var(--pending-soft, #fff3e0)" }}>
              <TrendingUp size={16} style={{ color: "var(--pending)" }} />
            </div>
            <div>
              <h2>Profit Outflow</h2>
              <p className="report-card__sub">{periodLabel}</p>
            </div>
          </div>
          <div className="report-card__body">
            <ReportRow
              label="Profit paid to partners"
              value={fmt(profitPaidInPeriod)}
              color="var(--outgoing)"
            />
            <div className="report-divider" />
            <ReportRow
              label="Total profit paid (all time)"
              value={fmt(totalProfitPaid)}
              color="var(--muted)"
              bold
            />
          </div>
        </section>

        {/* ── Outstanding Obligations ── */}
        <section className="report-card">
          <div className="report-card__header">
            <div className="report-card__icon-wrap" style={{ background: "var(--accent-soft)" }}>
              <CalendarClock size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h2>Outstanding Obligations</h2>
              <p className="report-card__sub">All-time (as of today)</p>
            </div>
          </div>
          <div className="report-card__body">
            <ReportRow
              label="Capital outstanding (owed to partners)"
              value={fmt(totalCapitalOutstanding)}
              color="var(--pending)"
            />
            <ReportRow
              label="Profit pending (owed to partners)"
              value={fmt(totalProfitPending)}
              color="var(--outgoing)"
            />
            <div className="report-divider" />
            <ReportRow
              label="Total liability"
              value={fmt(totalLiability)}
              color="var(--outgoing)"
              bold
            />
          </div>
        </section>

        {/* ── Portfolio Totals ── */}
        <section className="report-card">
          <div className="report-card__header">
            <div className="report-card__icon-wrap" style={{ background: "var(--accent-soft)" }}>
              <TrendingDown size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h2>Portfolio Totals</h2>
              <p className="report-card__sub">All-time since inception</p>
            </div>
          </div>
          <div className="report-card__body">
            <ReportRow
              label="Total capital ever deployed"
              value={fmt(totalCapitalDeployed)}
            />
            <ReportRow
              label="Total capital outstanding"
              value={fmt(totalCapitalOutstanding)}
              color="var(--pending)"
            />
            <ReportRow
              label="Total profit paid to partners"
              value={fmt(totalProfitPaid)}
              color="var(--outgoing)"
            />
            <div className="report-divider" />
            <ReportRow
              label="Active allocations"
              value={String(allocationSummaries.filter((a) => !a.isFullyReturned).length)}
              bold
            />
          </div>
        </section>

        {/* ── Per-Partner Breakdown ── */}
        <section className="report-card report-card--wide">
          <div className="report-card__header">
            <div className="report-card__icon-wrap" style={{ background: "var(--incoming-soft)" }}>
              <ArrowDownLeft size={16} style={{ color: "var(--incoming)" }} />
            </div>
            <div>
              <h2>Per-Partner Breakdown</h2>
              <p className="report-card__sub">Outstanding obligations by partner</p>
            </div>
          </div>
          <div className="report-card__body">
            {partnerSummaries.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, padding: "12px 0" }}>No partner data available.</p>
            ) : (
              <div className="table-wrapper" style={{ border: 0, boxShadow: "none" }}>
                <table className="data-table" aria-label="Per-partner breakdown">
                  <thead>
                    <tr>
                      <th className="table-th">Partner</th>
                      <th className="table-th table-th--money">Total capital</th>
                      <th className="table-th table-th--money">Capital returned</th>
                      <th className="table-th table-th--money">Outstanding</th>
                      <th className="table-th table-th--money">Profit paid</th>
                      <th className="table-th table-th--money">Profit pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerSummaries.map((ps) => (
                      <tr className="table-row" key={ps.partner.id}>
                        <td className="table-cell">{ps.partner.name}</td>
                        <td className="table-cell table-cell--money">{fmt(ps.totalCapital)}</td>
                        <td className="table-cell table-cell--money" style={{ color: "var(--incoming)" }}>{fmt(ps.totalCapitalReturned)}</td>
                        <td className="table-cell table-cell--money" style={{ color: "var(--pending)", fontWeight: 700 }}>{fmt(ps.capitalOutstanding)}</td>
                        <td className="table-cell table-cell--money" style={{ color: "var(--muted)" }}>{fmt(ps.totalProfitPaid)}</td>
                        <td className="table-cell table-cell--money" style={{ color: ps.totalProfitPending > 0 ? "var(--outgoing)" : "var(--muted)", fontWeight: 700 }}>{fmt(ps.totalProfitPending)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--border)" }}>
                      <td className="table-cell" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>TOTAL</td>
                      <td className="table-cell table-cell--money" style={{ fontWeight: 700 }}>{fmt(totalCapitalDeployed)}</td>
                      <td className="table-cell table-cell--money" style={{ color: "var(--incoming)", fontWeight: 700 }}>{fmt(partnerSummaries.reduce((s, ps) => s + ps.totalCapitalReturned, 0))}</td>
                      <td className="table-cell table-cell--money" style={{ color: "var(--pending)", fontWeight: 700 }}>{fmt(totalCapitalOutstanding)}</td>
                      <td className="table-cell table-cell--money" style={{ color: "var(--muted)", fontWeight: 700 }}>{fmt(totalProfitPaid)}</td>
                      <td className="table-cell table-cell--money" style={{ color: "var(--outgoing)", fontWeight: 700 }}>{fmt(totalProfitPending)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── Transaction Activity ── */}
        <section className="report-card report-card--wide">
          <div className="report-card__header">
            <div className="report-card__icon-wrap" style={{ background: "var(--accent-soft)" }}>
              <ArrowUpRight size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h2>Transaction Activity</h2>
              <p className="report-card__sub">{periodLabel} — {filteredLedger.length} events</p>
            </div>
          </div>
          <div className="report-card__body">
            {filteredLedger.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, padding: "12px 0" }}>No transactions in this period.</p>
            ) : (
              <div className="table-wrapper" style={{ border: 0, boxShadow: "none" }}>
                <table className="data-table" aria-label="Transaction activity">
                  <thead>
                    <tr>
                      <th className="table-th">Date</th>
                      <th className="table-th">Type</th>
                      <th className="table-th">Partner</th>
                      <th className="table-th table-th--money">Amount</th>
                      <th className="table-th">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.slice(0, 50).map((e) => (
                      <tr className="table-row" key={e.id}>
                        <td className="table-cell table-cell--secondary">{e.date}</td>
                        <td className="table-cell">
                          <span className={`status-badge ${
                            e.eventType === "CAPITAL_RECEIVED" ? "status-badge--active"
                            : e.eventType === "CAPITAL_RETURNED" ? "status-badge--inactive"
                            : "status-badge--pending"
                          }`}>
                            {e.eventType.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="table-cell" style={{ fontSize: 13 }}>
                          {e.partnerId}
                        </td>
                        <td className="table-cell table-cell--money" style={{
                          color: e.eventType === "CAPITAL_RECEIVED" ? "var(--incoming)"
                            : e.eventType === "CAPITAL_RETURNED" ? "var(--muted)"
                            : "var(--outgoing)",
                          fontWeight: 600,
                        }}>
                          {e.eventType === "CAPITAL_RETURNED" || e.eventType === "PROFIT_PAID" ? "-" : "+"}{fmt(e.amountRupees)}
                        </td>
                        <td className="table-cell table-cell--secondary" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {(e.notes || "").replace(/\s*WA_CONFIRMED\s*/g, "").trim() || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLedger.length > 50 && (
                  <p style={{ fontSize: 12, color: "var(--muted)", padding: "8px 12px" }}>
                    Showing first 50 of {filteredLedger.length} transactions. Export CSV for full data.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

      </div>

      {/* ── Portfolio Trend Charts — last 12 months, always shown ── */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <BarChart2 size={18} style={{ color: "var(--accent)" }} />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Portfolio Trend Charts</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Last 12 months</span>
        </div>
        <PortfolioTrendCharts />
      </div>
    </div>
  );
}
