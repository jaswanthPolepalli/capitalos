/**
 * PortfolioTrendCharts — Month-wise capital deployed vs profit paid.
 *
 * Two bar charts:
 *   1. Monthly Capital Outstanding — how much capital was deployed each month
 *   2. Monthly Profit Paid — how much profit was paid out per month
 *
 * Data is derived from the existing ledger entries in the store.
 * No external data required — fully in-memory.
 */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useStore } from "../useStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRupees(rupees: number): string {
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)}Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(0)}K`;
  return `₹${rupees}`;
}

function getMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // "YYYY-MM"
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year!, month! - 1, 1);
  return d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

function getLast12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(key);
  }
  return months;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  valueLabel,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  valueLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]!.value;
  return (
    <div style={{
      background: "var(--surface-raised)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      padding: "8px 12px",
      fontSize: 12,
      boxShadow: "var(--shadow-sm)",
    }}>
      <p style={{ margin: 0, fontWeight: 700, color: "var(--text)" }}>{label}</p>
      <p style={{ margin: "3px 0 0", color: "var(--muted)" }}>
        {valueLabel}: <strong style={{ color: "var(--text)" }}>
          {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)}
        </strong>
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PortfolioTrendCharts() {
  const { ledger } = useStore();
  const last12 = getLast12Months();

  // ── Chart 2: Monthly Profit Paid per month ──
  const profitData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    for (const entry of ledger) {
      const m = getMonthKey(entry.date);
      if (!last12.includes(m)) continue;
      if (entry.eventType === "PROFIT_PAID") {
        if (!byMonth[m]) byMonth[m] = 0;
        byMonth[m] += entry.amountRupees;
      }
    }
    return last12.map((m) => ({
      month: getMonthLabel(m),
      value: byMonth[m] ?? 0,
    }));
  }, [ledger, last12]);

  // ── Chart 3: Cumulative capital outstanding per month ──
  // We compute this from allocation summaries + ledger events
  const capitalOutstandingData = useMemo(() => {
    // Start with the current total outstanding and work backwards is complex.
    // Instead, compute a running total month by month from ledger.
    let running = 0;
    const snapshots: Record<string, number> = {};

    // Sort all ledger entries ascending
    const sorted = [...ledger].sort((a, b) => a.date.localeCompare(b.date));

    for (const entry of sorted) {
      const m = getMonthKey(entry.date);
      if (entry.eventType === "CAPITAL_RECEIVED") running += entry.amountRupees;
      else if (entry.eventType === "CAPITAL_RETURNED") running -= entry.amountRupees;
      snapshots[m] = running;
    }

    // Build the 12-month series: for each month, use the snapshot (or carry forward last known)
    const result: { month: string; value: number }[] = [];
    let lastKnown = 0;
    for (const m of last12) {
      if (snapshots[m] !== undefined) lastKnown = snapshots[m]!;
      result.push({ month: getMonthLabel(m), value: lastKnown });
    }
    return result;
  }, [ledger, last12]);

  const hasCapitalData = capitalOutstandingData.some((d) => d.value > 0);
  const hasProfitData = profitData.some((d) => d.value > 0);

  if (!hasCapitalData && !hasProfitData) {
    return (
      <div style={{
        padding: "32px 24px",
        textAlign: "center",
        color: "var(--muted)",
        fontSize: 13,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
      }}>
        <p style={{ margin: 0 }}>No transaction data yet. Charts will appear once capital is recorded.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Chart 1: Capital Outstanding (running) */}
      <div className="report-card">
        <div className="report-card__header">
          <div className="report-card__icon-wrap" style={{ background: "var(--pending-soft)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pending)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h2>Capital Outstanding by Month</h2>
            <p className="report-card__sub">Total deployed capital at end of each month (last 12 months)</p>
          </div>
        </div>
        <div className="report-card__body" style={{ paddingTop: 8 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={capitalOutstandingData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtRupees}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip valueLabel="Outstanding" />} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={36}>
                {capitalOutstandingData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.value > 0 ? "var(--pending)" : "var(--border)"}
                    opacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Profit Paid per Month */}
      <div className="report-card">
        <div className="report-card__header">
          <div className="report-card__icon-wrap" style={{ background: "var(--outgoing-soft)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--outgoing)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <h2>Profit Paid by Month</h2>
            <p className="report-card__sub">Total profit paid to partners each month (last 12 months)</p>
          </div>
        </div>
        <div className="report-card__body" style={{ paddingTop: 8 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={profitData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtRupees}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip valueLabel="Profit paid" />} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={36}>
                {profitData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.value > 0 ? "var(--outgoing)" : "var(--border)"}
                    opacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
