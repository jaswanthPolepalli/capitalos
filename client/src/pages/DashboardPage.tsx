import {
  AlertTriangle,
  ArrowDownLeft,
  CalendarClock,
  CreditCard as CreditCardIcon,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { useStore } from "../useStore";

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

function fmtCompact(rupees: number): string {
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)}Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)}L`;
  return fmt(rupees);
}

// ─── Hero KPI (primary metric) ────────────────────────────────────────────────

function HeroKPI({
  label,
  value,
  sub,
  note,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  note?: string;
  tone?: "positive" | "pending" | "outgoing" | "neutral";
}) {
  const accentClass =
    tone === "positive" ? "hero-kpi--positive"
    : tone === "pending" ? "hero-kpi--pending"
    : tone === "outgoing" ? "hero-kpi--outgoing"
    : "";

  return (
    <div className={`hero-kpi ${accentClass}`}>
      <span className="hero-kpi__label">{label}</span>
      <strong className="hero-kpi__value">{value}</strong>
      {sub && <p className="hero-kpi__sub">{sub}</p>}
      {note && <span className="hero-kpi__note">{note}</span>}
    </div>
  );
}

// ─── Standard KPI card ─────────────────────────────────────────────────────────

interface KPIProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "pending" | "outgoing" | "neutral";
  Icon: React.ElementType;
}

function KPI({ label, value, sub, tone = "neutral", Icon }: KPIProps) {
  const toneClass =
    tone === "positive" ? "metric-card--incoming"
    : tone === "pending" ? "metric-card--pending"
    : tone === "outgoing" ? "metric-card--outgoing"
    : "";
  return (
    <article className={`metric-card ${toneClass}`}>
      <div className="metric-card__header">
        <span>{label}</span>
        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <strong className="financial-value">{value}</strong>
      {sub && <p>{sub}</p>}
    </article>
  );
}

// ─── Quick action button ──────────────────────────────────────────────────────

function QuickAction({
  label,
  to,
  icon: Icon,
  tone,
}: {
  label: string;
  to: string;
  icon: React.ElementType;
  tone?: "urgent" | "default";
}) {
  return (
    <Link
      to={to}
      className={`quick-action${tone === "urgent" ? " quick-action--urgent" : ""}`}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </Link>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { portfolioTotals, partnerSummaries } = useStore();
  const {
    totalCapital, capitalOutstanding, totalCapitalReturned,
    totalProfitPaid, totalProfitPending, expectedMonthlyProfit, activePartners,
    cashOutstanding, cardOutstanding,
  } = portfolioTotals;

  const hasCardData = cardOutstanding > 0 || cashOutstanding < capitalOutstanding;
  const today = new Date().toISOString().slice(0, 10);

  // Capital obligations: partners with outstanding capital, sorted by name
  const capitalObligations = partnerSummaries
    .filter((ps) => ps.capitalOutstanding > 0)
    .sort((a, b) => a.partner.name.localeCompare(b.partner.name));

  // Profit obligations: partners with active capital (expected monthly profit > 0)
  const profitObligations = partnerSummaries
    .filter((ps) => ps.expectedMonthlyProfit > 0 || ps.totalProfitPending > 0)
    .sort((a, b) => (b.totalProfitPending || b.expectedMonthlyProfit) - (a.totalProfitPending || a.expectedMonthlyProfit));

  // Urgency counts for quick actions
  const overdueCount = partnerSummaries.filter((ps) =>
    (ps.nextReturnDate && ps.nextReturnDate < today) ||
    (ps.totalProfitPending > ps.expectedMonthlyProfit * 1.5),
  ).length;

  const pendingProfitCount = partnerSummaries.filter((ps) => ps.totalProfitPending > 0).length;

  return (
    <div>
      <PageHeader
        eyebrow="Command center"
        title="Financial Overview"
        description="Total capital under management, obligations, and profit schedule."
      />

      {/* ── Hero KPI section ── */}
      <div className="hero-kpi-row" aria-label="Primary KPIs">
        <HeroKPI
          label="Capital outstanding"
          value={fmtCompact(capitalOutstanding)}
          sub={fmt(capitalOutstanding)}
          note={`across ${activePartners} partner${activePartners !== 1 ? "s" : ""}`}
          tone="pending"
        />
        <HeroKPI
          label="Profit pending"
          value={fmtCompact(totalProfitPending)}
          sub={fmt(totalProfitPending)}
          note={pendingProfitCount > 0 ? `${pendingProfitCount} partners owed` : "All up to date"}
          tone={totalProfitPending > 0 ? "outgoing" : "positive"}
        />
        <HeroKPI
          label="Expected monthly"
          value={fmtCompact(expectedMonthlyProfit)}
          sub={fmt(expectedMonthlyProfit)}
          note="On active capital"
          tone="neutral"
        />
      </div>

      {/* ── Quick actions strip ── */}
      {(overdueCount > 0 || pendingProfitCount > 0) && (
        <div className="quick-actions-bar">
          <span className="quick-actions-bar__label">
            <Zap size={13} aria-hidden="true" />
            Quick actions
          </span>
          {overdueCount > 0 && (
            <QuickAction
              label={`${overdueCount} overdue — check returns`}
              to="/return-obligations"
              icon={AlertTriangle}
              tone="urgent"
            />
          )}
          {pendingProfitCount > 0 && (
            <QuickAction
              label={`Pay ${pendingProfitCount} pending profits — ${fmtCompact(totalProfitPending)}`}
              to="/pending-profits"
              icon={TrendingUp}
              tone="urgent"
            />
          )}
          <QuickAction label="View ledger" to="/ledger" icon={IndianRupee} />
          <QuickAction label="Return schedule" to="/return-obligations" icon={CalendarClock} />
        </div>
      )}

      {/* ── Standard KPI Strip ── */}
      <section className="metrics-grid" aria-label="Portfolio KPIs">
        <KPI label="Total capital received" value={fmt(totalCapital)} sub={`from ${activePartners} partner${activePartners !== 1 ? "s" : ""}`} tone="neutral" Icon={IndianRupee} />
        <KPI label="Total outstanding" value={fmt(capitalOutstanding)} sub="Yet to be returned" tone="pending" Icon={ArrowDownLeft} />
        {hasCardData && <KPI label="Cash outstanding" value={fmt(cashOutstanding)} sub="Cash / bank contributions" tone="pending" Icon={IndianRupee} />}
        {hasCardData && <KPI label="Card outstanding" value={fmt(cardOutstanding)} sub="Credit card contributions" tone="pending" Icon={CreditCardIcon} />}
        <KPI label="Capital returned" value={fmt(totalCapitalReturned)} sub="Paid back to partners" tone="positive" Icon={TrendingDown} />
        <KPI label="Expected monthly profit" value={fmt(expectedMonthlyProfit)} sub="On outstanding capital" tone="pending" Icon={CalendarClock} />
        <KPI label="Profit paid (total)" value={fmt(totalProfitPaid)} sub="All time" tone="positive" Icon={TrendingDown} />
        <KPI label="Active partners" value={String(activePartners)} sub="Capital not fully returned" tone="neutral" Icon={Users} />
      </section>

      <div className="dashboard-grid" style={{ marginTop: 12 }}>
        {/* Capital obligations */}
        <section className="panel" aria-labelledby="cap-obl-title">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Capital</p>
              <h2 id="cap-obl-title">Capital obligations by partner</h2>
            </div>
            <Link className="entity-link" to="/return-obligations">View return schedule →</Link>
          </div>
          {capitalObligations.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <p>No outstanding capital obligations.</p>
              <Link className="button button--primary" to="/capital-contributions">Record contribution</Link>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 0, boxShadow: "none" }}>
              <table className="data-table" aria-label="Capital obligations">
                <thead>
                  <tr>
                    <th className="table-th">Partner</th>
                    <th className="table-th table-th--money">Total capital</th>
                    <th className="table-th table-th--money">Returned</th>
                    <th className="table-th table-th--money">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {capitalObligations.map((ps) => {
                    const isOverdue = ps.nextReturnDate ? ps.nextReturnDate < today : false;
                    return (
                      <tr className={`table-row${isOverdue ? " table-row--overdue" : ""}`} key={ps.partner.id}>
                        <td className="table-cell">
                          <Link className="entity-link" to={`/partners/${ps.partner.id}`}>
                            {ps.partner.name}
                          </Link>
                          {isOverdue && (
                            <span className="status-badge status-badge--overdue" style={{ marginLeft: 8, fontSize: 10 }}>Overdue</span>
                          )}
                        </td>
                        <td className="table-cell table-cell--money">{fmt(ps.totalCapital)}</td>
                        <td className="table-cell table-cell--money" style={{ color: "var(--incoming)" }}>
                          {fmt(ps.totalCapitalReturned)}
                        </td>
                        <td className="table-cell table-cell--money" style={{ color: "var(--pending)", fontWeight: 700 }}>
                          {fmt(ps.capitalOutstanding)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)" }}>
                    <td className="table-cell" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>TOTAL</td>
                    <td className="table-cell table-cell--money" style={{ fontWeight: 700 }}>{fmt(totalCapital)}</td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--incoming)", fontWeight: 700 }}>{fmt(totalCapitalReturned)}</td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--pending)", fontWeight: 700 }}>{fmt(capitalOutstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Profit obligations */}
        <section className="panel" aria-labelledby="profit-obl-title">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Profit</p>
              <h2 id="profit-obl-title">Profit obligations by partner</h2>
            </div>
            <Link className="entity-link" to="/pending-profits">View all →</Link>
          </div>
          {profitObligations.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <p>
                {partnerSummaries.length === 0
                  ? "Add partners and capital contributions to track profit obligations."
                  : "No pending profit obligations — all profits are up to date!"}
              </p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 0, boxShadow: "none" }}>
              <table className="data-table" aria-label="Profit obligations">
                <thead>
                  <tr>
                    <th className="table-th">Partner</th>
                    <th className="table-th table-th--money">Capital</th>
                    <th className="table-th table-th--money">Exp. monthly</th>
                    <th className="table-th table-th--money">Profit pending</th>
                  </tr>
                </thead>
                <tbody>
                  {profitObligations.map((ps) => {
                    const isHighPending = ps.totalProfitPending > ps.expectedMonthlyProfit * 1.5;
                    return (
                      <tr className={`table-row${isHighPending ? " table-row--overdue" : ps.totalProfitPending > 0 ? " table-row--attention" : ""}`} key={ps.partner.id}>
                        <td className="table-cell">
                          <Link className="entity-link" to={`/partners/${ps.partner.id}`}>
                            {ps.partner.name}
                          </Link>
                        </td>
                        <td className="table-cell table-cell--money">{fmt(ps.capitalOutstanding)}</td>
                        <td className="table-cell table-cell--money" style={{ color: "var(--text-soft)" }}>
                          {fmt(ps.expectedMonthlyProfit)}
                        </td>
                        <td className="table-cell table-cell--money" style={{ color: ps.totalProfitPending > 0 ? "var(--outgoing)" : "var(--muted)", fontWeight: 700 }}>
                          {fmt(ps.totalProfitPending)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)" }}>
                    <td className="table-cell" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>TOTAL</td>
                    <td className="table-cell table-cell--money" style={{ fontWeight: 700 }}>{fmt(capitalOutstanding)}</td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--text-soft)", fontWeight: 700 }}>{fmt(expectedMonthlyProfit)}</td>
                    <td className="table-cell table-cell--money" style={{ color: "var(--outgoing)", fontWeight: 700 }}>{fmt(totalProfitPending)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, paddingTop: 14, marginTop: 4, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            <Link className="button button--secondary" to="/return-obligations" style={{ fontSize: 12 }}>
              <CalendarClock size={14} /> Return schedule
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
