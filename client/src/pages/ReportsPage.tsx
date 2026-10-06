import { financialYearRange } from "../lib/businessDates";
import { Download } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../components/PageHeader";
import { downloadCSV } from "../lib/csv";
import { useStore } from "../useStore";
import { SendSummaryEmail } from '../components/SendSummaryEmail';

function fmt(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

// ─── Period types ─────────────────────────────────────────────────────────────

type PeriodType = "monthly" | "quarterly" | "annual" | "financial-year" | "custom" | "all";

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
  if (p.type === "financial-year") return `FY ${p.year}–${p.year + 1} (Apr–Mar)`;
  if (p.type === "annual") return `${p.year} (Jan–Dec)`;
  if (p.type === "custom" && p.from && p.to) return `${p.from} → ${p.to}`;
  return p.type === "all" ? "All time" : "Select dates";
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
  if (p.type === "financial-year") return financialYearRange(p.year);
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
        {(["monthly", "quarterly", "annual", "financial-year", "custom", "all"] as PeriodType[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`report-tab${period.type === t ? " report-tab--active" : ""}`}
            onClick={() => onChange({ ...period, type: t, quarter: period.quarter ?? Math.ceil((new Date().getMonth() + 1) / 3) })}
          >
            {t === "financial-year" ? "Financial year" : t === "all" ? "All time" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="report-period-controls">
        {period.type !== "custom" && period.type !== "all" && (
          <select
            className="form-input"
            style={{ width: "auto", minWidth: 90 }}
            aria-label="Year"
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
            aria-label="Month"
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
            aria-label="Quarter"
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
              aria-label="From date"
              value={period.from ?? ""}
              onChange={(e) => onChange({ ...period, from: e.target.value })}
            />
            <span style={{ color: "var(--muted)", fontSize: 13 }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ width: "auto" }}
              aria-label="To date"
              value={period.to ?? ""}
              onChange={(e) => onChange({ ...period, to: e.target.value })}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { ledger, partners, allocationSummaries, partnerSummaries } = useStore();
  const today = new Date();
  const [period, setPeriod] = useState<Period>({ type: "monthly", year: today.getFullYear(), month: today.getMonth() + 1, quarter: Math.ceil((today.getMonth() + 1) / 3) });
  const range = getPeriodRange(period);
  const invalidPeriod = period.type === "custom" && (!range || range.from > range.to);
  const periodLabel = getPeriodLabel(period);
  const entries = invalidPeriod ? [] : ledger.filter(e => !range || (e.date >= range.from && e.date <= range.to));
  const sum = (type: string) => entries.filter(e => e.eventType === type).reduce((s, e) => s + e.amountRupees, 0);
  const received = sum("CAPITAL_RECEIVED");
  const returned = sum("CAPITAL_RETURNED");
  const paid = sum("PROFIT_PAID");
  const cashback = sum("CASHBACK_PAID");
  const outstanding = allocationSummaries.reduce((s, a) => s + a.capitalOutstanding, 0);
  const pending = partnerSummaries.reduce((s, p) => s + p.totalProfitPending, 0);
  const partnerName = (id: string) => partners.find(p => p.id === id)?.name ?? id;
  const breakdown = Array.from(new Set(entries.map(e => e.partnerId))).map(id => {
    const events = entries.filter(e => e.partnerId === id);
    const total = (type: string) => events.filter(e => e.eventType === type).reduce((s, e) => s + e.amountRupees, 0);
    return { id, name: partnerName(id), received: total("CAPITAL_RECEIVED"), returned: total("CAPITAL_RETURNED"), paid: total("PROFIT_PAID"), cashback: total("CASHBACK_PAID") };
  }).sort((a, b) => b.received - a.received || a.name.localeCompare(b.name));

  // Use daily buckets for one month and monthly buckets for longer periods.
  const daily = !!range && range.from.slice(0, 7) === range.to.slice(0, 7);
  const buckets = new Map<string, { date: string; received: number; returned: number; paid: number; cashback: number }>();
  const dates = entries.map(e => e.date).sort();
  const first = range?.from ?? dates[0];
  const last = range?.to ?? dates[dates.length - 1];
  if (!invalidPeriod && first && last) {
    const cursor = new Date(`${daily ? first : first.slice(0, 7) + "-01"}T12:00:00`);
    const end = new Date(`${last}T12:00:00`);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}${daily ? "-" + String(cursor.getDate()).padStart(2, "0") : ""}`;
      buckets.set(key, { date: key, received: 0, returned: 0, paid: 0, cashback: 0 });
      if (daily) cursor.setDate(cursor.getDate() + 1);
      else cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  for (const e of entries) {
    const bucket = buckets.get(e.date.slice(0, daily ? 10 : 7));
    if (!bucket) continue;
    if (e.eventType === "CAPITAL_RECEIVED") bucket.received += e.amountRupees;
    if (e.eventType === "CAPITAL_RETURNED") bucket.returned += e.amountRupees;
    if (e.eventType === "PROFIT_PAID") bucket.paid += e.amountRupees;
    if (e.eventType === "CASHBACK_PAID") bucket.cashback += e.amountRupees;
  }
  const ledgerUrl = `/ledger${range ? `?${new URLSearchParams({ from: range.from, to: range.to })}` : ""}`;

  const unknownCashbackCount = entries.filter(e => e.amountUnknown).length;
  function exportReport() {
    downloadCSV(`CapitalOS-Report-${periodLabel.replace(/[^a-zA-Z0-9-]/g, "-")}.csv`, ["Section", "Period", "Partner / Metric", "Capital received (INR)", "Capital returned (INR)", "Profit paid (INR)", "Cashback shared (INR)", "Value (INR)"], [
      ["Activity summary", periodLabel, "Total", received, returned, paid, cashback, ""],
      ["Activity summary", periodLabel, "Total profits received", "", "", "", "", paid + cashback],
      ["Activity summary", periodLabel, "Cashback amounts not recorded", "", "", "", "", unknownCashbackCount],
      ["Activity summary", periodLabel, "Net capital received", "", "", "", "", received - returned],
      ...breakdown.map(p => ["Partner activity", periodLabel, p.name, p.received, p.returned, p.paid, p.cashback, ""]),
      ["Outstanding today", today.toLocaleDateString("en-IN"), "Capital outstanding", "", "", "", "", outstanding],
      ["Outstanding today", today.toLocaleDateString("en-IN"), "Profit pending", "", "", "", "", pending],
      ["Outstanding today", today.toLocaleDateString("en-IN"), "Total owed", "", "", "", "", outstanding + pending],
    ]);
  }

  return (
    <div className="list-page">
      <PageHeader eyebrow="Financial reports" title="Reports" description="Capital activity and partner payments for your selected period."
        actions={<button className="button button--secondary" type="button" onClick={exportReport} disabled={invalidPeriod}><Download size={15} /> Export report CSV</button>} />
      <SendSummaryEmail />
      {unknownCashbackCount > 0 && <p className="tools-hint">{unknownCashbackCount} cashback amount(s) not recorded. Totals include known amounts only.</p>}
      <PeriodSelector period={period} onChange={setPeriod} />
      {invalidPeriod ? <p className="form-error" role="alert">Choose a start and end date, with the end on or after the start.</p> : <>
        <div className="reports-grid">
          {[{ label: "Capital received", value: received, color: "var(--incoming)" }, { label: "Capital returned", value: returned, color: "var(--pending)" }, { label: "Profit paid", value: paid, color: "var(--outgoing)" }, { label: "Cashback shared", value: cashback, color: "var(--outgoing)" }, { label: "Total profits received", value: paid + cashback, color: "var(--incoming)" }].map(item => (
            <section className="report-card" key={item.label}>
              <div className="report-card__header"><div><h2>{item.label}</h2><p className="report-card__sub">{periodLabel}</p></div></div>
              <div className="report-card__body" style={{ fontSize: 26, fontWeight: 700, color: item.color }}>{fmt(item.value)}</div>
            </section>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", margin: "16px 0 24px" }}>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Net capital received: <strong>{fmt(received - returned)}</strong> · Received minus returned</span>
          <Link className="entity-link" to={ledgerUrl}>View transactions ({entries.length}) →</Link>
        </div>
        <section className="report-card" style={{ marginBottom: 24 }}>
          <div className="report-card__header"><div><h2>Capital and payment activity</h2><p className="report-card__sub">{periodLabel} · {daily ? "Daily" : "Monthly"} totals</p></div></div>
          <div className="report-card__body">
            {entries.length === 0 ? <p style={{ color: "var(--muted)" }}>No transactions in this period.</p> : <ResponsiveContainer width="100%" height={260}>
              <BarChart data={Array.from(buckets.values())} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={value => new Date(`${value.length === 7 ? value + "-01" : value}T12:00:00`).toLocaleDateString("en-IN", daily ? { day: "numeric", month: "short" } : { month: "short", year: "2-digit" })} tick={{ fontSize: 11 }} />
                <YAxis width={70} tickFormatter={value => Math.abs(value) >= 100000 ? `₹${(value / 100000).toFixed(1)}L` : `₹${value}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={value => fmt(Number(value))} />
                <Legend />
                <Bar dataKey="received" name="Capital received" fill="var(--incoming)" />
                <Bar dataKey="returned" name="Capital returned" fill="var(--pending)" />
                <Bar dataKey="paid" name="Profit paid" fill="var(--outgoing)" />
                <Bar dataKey="cashback" name="Cashback shared" fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>}
          </div>
        </section>
        <section className="report-card" style={{ marginBottom: 24 }}>
          <div className="report-card__header"><div><h2>Partner activity</h2><p className="report-card__sub">{periodLabel} · Partners with transactions in this period</p></div></div>
          <div className="table-wrapper" style={{ border: 0 }}>
            <table className="data-table" aria-label="Partner activity">
              <thead><tr><th className="table-th">Partner</th>{["Capital received", "Capital returned", "Profit paid", "Cashback shared", "Total profits received"].map(label => <th key={label} className="table-th table-th--money">{label}</th>)}</tr></thead>
              <tbody>{breakdown.length === 0 ? <tr><td colSpan={6} className="table-cell">No partner activity in this period.</td></tr> : breakdown.map(p => <tr key={p.id} className="table-row">
                <td className="table-cell"><Link className="entity-link" to={`/partners/${p.id}`}>{p.name}</Link></td>
                <td className="table-cell table-cell--money" data-label="Capital received">{fmt(p.received)}</td>
                <td className="table-cell table-cell--money" data-label="Capital returned">{fmt(p.returned)}</td>
                <td className="table-cell table-cell--money" data-label="Profit paid">{fmt(p.paid)}</td>
                <td className="table-cell table-cell--money" data-label="Cashback shared">{fmt(p.cashback)}</td><td className="table-cell table-cell--money" data-label="Total profits received">{fmt(p.paid + p.cashback)}</td>
              </tr>)}</tbody>
              {breakdown.length > 0 && <tfoot><tr><td className="table-cell"><strong>Total</strong></td>{[received, returned, paid, cashback, paid + cashback].map((value, i) => <td key={i} className="table-cell table-cell--money" data-label={["Capital received", "Capital returned", "Profit paid", "Cashback shared", "Total profits received"][i]}><strong>{fmt(value)}</strong></td>)}</tr></tfoot>}
            </table>
          </div>
        </section>
      </>}
      <section className="report-card">
        <div className="report-card__header"><div><h2>Outstanding today</h2><p className="report-card__sub">{today.toLocaleDateString("en-IN")} · Current balances; unaffected by the period filter</p></div></div>
        <div className="report-card__body reports-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div><Link className="entity-link" to="/return-obligations">Capital outstanding →</Link><p style={{ fontSize: 22, fontWeight: 700, marginBottom: 0 }}>{fmt(outstanding)}</p></div>
          <div><Link className="entity-link" to="/pending-profits">Profit pending →</Link><p style={{ fontSize: 22, fontWeight: 700, marginBottom: 0 }}>{fmt(pending)}</p></div>
          <div><span>Total owed</span><p style={{ fontSize: 22, fontWeight: 700, marginBottom: 0 }}>{fmt(outstanding + pending)}</p></div>
        </div>
      </section>
    </div>
  );
}
