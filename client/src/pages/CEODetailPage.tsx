import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CalendarClock,
  FileText,
  Link2,
  ScrollText,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { MoneyDisplay } from "../components/MoneyDisplay";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, formatINR } from "../lib/format";
import {
  useCEO,
  useCEOAgreements,
  useCEOInvestments,
  useCEOPortalAccess,
  useCEOSchedules,
  useCEOSummary,
  useCEOTransactions,
} from "../mocks/hooks";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "investments", label: "Investments" },
  { id: "transactions", label: "Transactions" },
  { id: "schedules", label: "Schedule" },
  { id: "agreements", label: "Agreements" },
  { id: "portal", label: "Portal Access" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function FinancialCard({
  label,
  paise,
  tone,
}: {
  label: string;
  paise: bigint;
  tone?: "positive" | "negative" | "pending" | "neutral";
}) {
  return (
    <div className="fin-card">
      <p className="fin-card__label">{label}</p>
      <MoneyDisplay
        paise={paise}
        prominent
        className="fin-card__value"
        {...(tone !== undefined ? { tone } : {})}
      />
    </div>
  );
}

function OverviewTab({ ceoId }: { ceoId: string }) {
  const { data: summary, isLoading } = useCEOSummary(ceoId);

  if (isLoading || !summary) {
    return (
      <div className="detail-section">
        <div className="skeleton skeleton--block" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div className="detail-section">
      <h2 className="detail-section__title">Capital position</h2>
      <div className="fin-cards-grid">
        <FinancialCard
          label="Total capital provided"
          paise={summary.totalCapitalProvided}
        />
        <FinancialCard
          label="Principal returned"
          paise={summary.totalPrincipalReturned}
          tone="positive"
        />
        <FinancialCard
          label="Principal outstanding"
          paise={summary.principalOutstanding}
          tone={summary.principalOutstanding > 0n ? "pending" : "neutral"}
        />
        <FinancialCard
          label="Profit received"
          paise={summary.totalProfitReceived}
          tone="positive"
        />
        <FinancialCard
          label="Profit outstanding"
          paise={summary.profitOutstanding}
          tone={summary.profitOutstanding > 0n ? "pending" : "neutral"}
        />
        <FinancialCard
          label="Total outstanding"
          paise={summary.totalOutstanding}
          tone={summary.totalOutstanding > 0n ? "pending" : "neutral"}
        />
      </div>

      {summary.nextPaymentDate ? (
        <div className="next-payment-banner">
          <CalendarClock size={18} aria-hidden="true" />
          <span>
            Next payment of{" "}
            <strong>
              {summary.nextPaymentAmount
                ? formatINR(summary.nextPaymentAmount)
                : "—"}
            </strong>{" "}
            due on <strong>{formatDate(summary.nextPaymentDate)}</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function InvestmentsTab({ ceoId }: { ceoId: string }) {
  const { data: investments, isLoading } = useCEOInvestments(ceoId);

  if (isLoading) {
    return <div className="skeleton skeleton--block" style={{ height: 120 }} />;
  }

  if (investments.length === 0) {
    return (
      <div className="table-empty">
        <span className="empty-state__icon" aria-hidden="true">
          <TrendingUp size={22} />
        </span>
        <h3>No investments</h3>
        <p>No capital investments have been recorded for this business.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="data-table" aria-label="CEO investments">
        <thead>
          <tr>
            <th className="table-th">Code</th>
            <th className="table-th">Date</th>
            <th className="table-th table-th--money">Principal</th>
            <th className="table-th">Purpose</th>
            <th className="table-th">Method</th>
            <th className="table-th">Reference</th>
            <th className="table-th">Status</th>
          </tr>
        </thead>
        <tbody>
          {investments.map((inv) => (
            <tr className="table-row" key={inv.id}>
              <td className="table-cell">
                <code>{inv.investmentCode}</code>
              </td>
              <td className="table-cell table-cell--secondary">
                {formatDate(inv.investmentDate)}
              </td>
              <td className="table-cell table-cell--money">
                <MoneyDisplay paise={inv.principalAmount} tone="pending" prominent />
              </td>
              <td className="table-cell table-cell--secondary" style={{ maxWidth: 260 }}>
                {inv.purpose}
              </td>
              <td className="table-cell table-cell--secondary">{inv.paymentMethod}</td>
              <td className="table-cell table-cell--secondary">
                <code>{inv.referenceNumber ?? "—"}</code>
              </td>
              <td className="table-cell">
                <StatusBadge status={inv.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionsTab({ ceoId }: { ceoId: string }) {
  const { data: transactions, isLoading } = useCEOTransactions(ceoId);

  if (isLoading) {
    return <div className="skeleton skeleton--block" style={{ height: 120 }} />;
  }

  if (transactions.length === 0) {
    return (
      <div className="table-empty">
        <span className="empty-state__icon" aria-hidden="true">
          <FileText size={22} />
        </span>
        <h3>No transactions</h3>
        <p>No ledger transactions have been recorded for this business.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="data-table" aria-label="CEO transactions">
        <thead>
          <tr>
            <th className="table-th">Code</th>
            <th className="table-th">Date</th>
            <th className="table-th">Type</th>
            <th className="table-th table-th--money">Principal</th>
            <th className="table-th table-th--money">Profit</th>
            <th className="table-th table-th--money">Total</th>
            <th className="table-th">Direction</th>
            <th className="table-th">Method</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr className="table-row" key={t.id}>
              <td className="table-cell">
                <code>{t.transactionCode}</code>
              </td>
              <td className="table-cell table-cell--secondary">
                {formatDate(t.transactionDate)}
              </td>
              <td className="table-cell">
                <StatusBadge
                  status={t.direction === "IN" ? "ACTIVE" : "OVERDUE"}
                  label={t.transactionType.replace(/_/g, " ")}
                />
              </td>
              <td className="table-cell table-cell--money">
                <MoneyDisplay paise={t.principalAmount} />
              </td>
              <td className="table-cell table-cell--money">
                <MoneyDisplay paise={t.profitAmount} />
              </td>
              <td className="table-cell table-cell--money">
                <MoneyDisplay
                  paise={t.totalAmount}
                  prominent
                  tone={t.direction === "IN" ? "positive" : "pending"}
                />
              </td>
              <td className="table-cell">
                <StatusBadge
                  status={t.direction === "IN" ? "ACTIVE" : "INACTIVE"}
                  label={t.direction}
                />
              </td>
              <td className="table-cell table-cell--secondary">{t.paymentMethod}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchedulesTab({ ceoId }: { ceoId: string }) {
  const { data: schedules, isLoading } = useCEOSchedules(ceoId);

  if (isLoading) {
    return <div className="skeleton skeleton--block" style={{ height: 120 }} />;
  }

  if (schedules.length === 0) {
    return (
      <div className="table-empty">
        <span className="empty-state__icon" aria-hidden="true">
          <CalendarClock size={22} />
        </span>
        <h3>No schedule</h3>
        <p>No payment schedule entries have been created for this business.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="data-table" aria-label="Payment schedule">
        <thead>
          <tr>
            <th className="table-th">Due Date</th>
            <th className="table-th table-th--money">Expected Principal</th>
            <th className="table-th table-th--money">Expected Profit</th>
            <th className="table-th table-th--money">Paid Principal</th>
            <th className="table-th table-th--money">Paid Profit</th>
            <th className="table-th table-th--money">Pending</th>
            <th className="table-th">Status</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((s) => (
            <tr className="table-row" key={s.id}>
              <td className="table-cell">
                <strong>{formatDate(s.dueDate)}</strong>
              </td>
              <td className="table-cell table-cell--money">
                <MoneyDisplay paise={s.expectedPrincipal} />
              </td>
              <td className="table-cell table-cell--money">
                <MoneyDisplay paise={s.expectedProfit} />
              </td>
              <td className="table-cell table-cell--money">
                <MoneyDisplay paise={s.paidPrincipal} tone="positive" />
              </td>
              <td className="table-cell table-cell--money">
                <MoneyDisplay paise={s.paidProfit} tone="positive" />
              </td>
              <td className="table-cell table-cell--money">
                <MoneyDisplay
                  paise={s.principalPending + s.profitPending}
                  tone={s.principalPending + s.profitPending > 0n ? "pending" : "neutral"}
                  prominent
                />
              </td>
              <td className="table-cell">
                <StatusBadge status={s.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgreementsTab({ ceoId }: { ceoId: string }) {
  const { data: agreements, isLoading } = useCEOAgreements(ceoId);

  if (isLoading) {
    return <div className="skeleton skeleton--block" style={{ height: 120 }} />;
  }

  if (agreements.length === 0) {
    return (
      <div className="table-empty">
        <span className="empty-state__icon" aria-hidden="true">
          <ScrollText size={22} />
        </span>
        <h3>No agreements</h3>
        <p>No agreements have been created for this business.</p>
      </div>
    );
  }

  return (
    <div className="detail-section">
      {agreements.map((a) => (
        <div className="agreement-card" key={a.id}>
          <div className="agreement-card__header">
            <div>
              <code className="agreement-card__code">{a.agreementCode}</code>
              <h3>
                {a.profitCalculationType} profit — {a.profitFrequency.toLowerCase()}
              </h3>
            </div>
            <StatusBadge status={a.status} />
          </div>
          <dl className="agreement-card__details">
            <div>
              <dt>Capital amount</dt>
              <dd>
                <MoneyDisplay paise={a.capitalAmount} prominent />
              </dd>
            </div>
            <div>
              <dt>Start date</dt>
              <dd>{formatDate(a.startDate)}</dd>
            </div>
            <div>
              <dt>End date</dt>
              <dd>{a.endDate ? formatDate(a.endDate) : "Open-ended"}</dd>
            </div>
            {a.profitCalculationType === "PERCENTAGE" && a.profitRate ? (
              <div>
                <dt>Profit rate</dt>
                <dd>{parseFloat(a.profitRate).toFixed(2)}% p.a.</dd>
              </div>
            ) : null}
            {a.profitCalculationType === "FIXED" && a.fixedProfitAmount ? (
              <div>
                <dt>Fixed profit</dt>
                <dd>
                  <MoneyDisplay paise={a.fixedProfitAmount} /> /{" "}
                  {a.profitFrequency.toLowerCase()}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="agreement-card__terms">
            <strong>Repayment: </strong>
            {a.principalRepaymentTerms}
          </p>
          <p className="agreement-card__terms">
            <strong>Profit: </strong>
            {a.profitPaymentTerms}
          </p>
        </div>
      ))}
    </div>
  );
}

function PortalTab({ ceoId }: { ceoId: string }) {
  const { data: access, isLoading } = useCEOPortalAccess(ceoId);

  if (isLoading) {
    return <div className="skeleton skeleton--block" style={{ height: 120 }} />;
  }

  if (!access) {
    return (
      <div className="table-empty">
        <span className="empty-state__icon" aria-hidden="true">
          <Link2 size={22} />
        </span>
        <h3>No portal link</h3>
        <p>Generate a permanent secure portal URL for this business.</p>
        <button className="button button--primary" type="button">
          <Link2 size={15} aria-hidden="true" />
          Generate portal link
        </button>
      </div>
    );
  }

  return (
    <div className="detail-section">
      <div className="portal-card">
        <div className="portal-card__header">
          <Link2 size={20} aria-hidden="true" />
          <h3>Business portal access</h3>
          <StatusBadge status={access.active ? "ACTIVE" : "INACTIVE"} />
        </div>
        <dl className="portal-card__details">
          <div>
            <dt>Access code</dt>
            <dd>
              <code>{access.accessCode}</code>
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {access.active
                ? "Active — portal URL is live"
                : "Revoked — portal URL is disabled"}
            </dd>
          </div>
          {access.lastAccessAt ? (
            <div>
              <dt>Last accessed</dt>
              <dd>{formatDate(access.lastAccessAt)}</dd>
            </div>
          ) : null}
        </dl>
        <div className="portal-card__actions">
          {access.active ? (
            <>
              <button className="button button--primary" type="button">
                Copy portal URL
              </button>
              <button className="button button--secondary" type="button">
                Regenerate
              </button>
              <button className="button button--danger" type="button">
                Revoke
              </button>
            </>
          ) : (
            <button className="button button--primary" type="button">
              <Link2 size={15} aria-hidden="true" />
              Regenerate portal link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function CEODetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const reduceMotion = useReducedMotion();

  const { data: ceo, isLoading } = useCEO(id);

  if (isLoading) {
    return (
      <div className="detail-page">
        <div className="detail-loading">
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--block" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  if (!ceo) {
    return <Navigate replace to="/businesses" />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab ceoId={ceo.id} />;
      case "investments":
        return <InvestmentsTab ceoId={ceo.id} />;
      case "transactions":
        return <TransactionsTab ceoId={ceo.id} />;
      case "schedules":
        return <SchedulesTab ceoId={ceo.id} />;
      case "agreements":
        return <AgreementsTab ceoId={ceo.id} />;
      case "portal":
        return <PortalTab ceoId={ceo.id} />;
    }
  };

  return (
    <div className="detail-page">
      <PageHeader
        eyebrow="CEOs / Businesses"
        title={ceo.businessName}
        description={`${ceo.ceoCode} · ${ceo.ceoName}`}
        actions={
          <>
            <Link className="button button--secondary" to="/businesses">
              <ArrowLeft size={16} aria-hidden="true" />
              Businesses
            </Link>
            <button className="button button--primary" type="button">
              Edit business
            </button>
          </>
        }
      />

      <div className="profile-strip">
        <span className="profile-strip__avatar profile-strip__avatar--business" aria-hidden="true">
          {ceo.businessName.charAt(0).toUpperCase()}
        </span>
        <div className="profile-strip__info">
          {ceo.email ? (
            <span>
              <a href={`mailto:${ceo.email}`}>{ceo.email}</a>
            </span>
          ) : null}
          {ceo.phone ? <span>{ceo.phone}</span> : null}
          {ceo.address ? (
            <span className="profile-strip__address">{ceo.address}</span>
          ) : null}
        </div>
        <div className="profile-strip__meta">
          <StatusBadge status={ceo.status} />
          <span className="profile-strip__date">
            Added {formatDate(ceo.createdAt)}
          </span>
        </div>
      </div>

      <nav className="detail-tabs" aria-label="Business sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`detail-tab${activeTab === tab.id ? " detail-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <motion.div
        key={activeTab}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
      >
        {renderTab()}
      </motion.div>

      {ceo.notes ? (
        <div className="detail-notes">
          <strong>Notes</strong>
          <p>{ceo.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
