import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  FileText,
  Percent,
  ScrollText,
} from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

import { MoneyDisplay } from "../components/MoneyDisplay";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../lib/format";
import { useAgreement } from "../mocks/agreementHooks";
import { MOCK_CEOS, MOCK_PARTNERS } from "../mocks/data";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function profitTypeLabel(type: string): string {
  switch (type) {
    case "PERCENTAGE": return "Percentage of outstanding principal";
    case "FIXED": return "Fixed amount per period";
    case "CUSTOM": return "Custom / negotiated terms";
    default: return type;
  }
}

function frequencyLabel(freq: string): string {
  switch (freq) {
    case "ONE_TIME": return "One-time";
    case "MONTHLY": return "Monthly";
    case "QUARTERLY": return "Quarterly";
    case "YEARLY": return "Yearly";
    case "CUSTOM": return "Custom frequency";
    default: return freq;
  }
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function AgreementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const reduceMotion = useReducedMotion();

  const { data: agreement, isLoading } = useAgreement(id);

  if (isLoading) {
    return (
      <div className="detail-page">
        <div className="detail-loading">
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--block" style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  if (!agreement) {
    return <Navigate replace to="/agreements" />;
  }

  // Resolve party name and link
  let partyName = "—";
  let partyLink = "/partners";
  if (agreement.partyType === "PARTNER" && agreement.partnerId) {
    const p = MOCK_PARTNERS.find((x) => x.id === agreement.partnerId);
    partyName = p?.name ?? agreement.partnerId;
    partyLink = `/partners/${agreement.partnerId}`;
  } else if (agreement.partyType === "CEO" && agreement.ceoId) {
    const c = MOCK_CEOS.find((x) => x.id === agreement.ceoId);
    partyName = c ? `${c.businessName} (${c.ceoName})` : agreement.ceoId;
    partyLink = `/businesses/${agreement.ceoId}`;
  }

  return (
    <div className="detail-page">
      <PageHeader
        eyebrow="Agreements"
        title={agreement.agreementCode}
        description={`${agreement.partyType === "PARTNER" ? "Partner" : "CEO / Business"} agreement · ${profitTypeLabel(agreement.profitCalculationType)}`}
        actions={
          <>
            <Link className="button button--secondary" to="/agreements">
              <ArrowLeft size={16} aria-hidden="true" />
              Agreements
            </Link>
            <button className="button button--primary" type="button">
              Edit agreement
            </button>
          </>
        }
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        className="agreement-detail-layout"
      >
        {/* ─── Header strip ─────────────────────────────────────────────────── */}
        <div className="agreement-header-strip">
          <div className="agreement-header-strip__icon" aria-hidden="true">
            <ScrollText size={22} />
          </div>
          <div className="agreement-header-strip__info">
            <p className="agreement-header-strip__party">
              {agreement.partyType === "PARTNER" ? "Partner" : "CEO / Business"}
            </p>
            <Link className="agreement-header-strip__link" to={partyLink}>
              {partyName}
            </Link>
          </div>
          <StatusBadge status={agreement.status} />
        </div>

        {/* ─── Capital and dates ─────────────────────────────────────────────── */}
        <section className="agreement-section" aria-labelledby="capital-title">
          <h2 id="capital-title" className="agreement-section__title">
            <CalendarCheck size={17} aria-hidden="true" />
            Capital and period
          </h2>
          <div className="agreement-grid-3">
            <div className="agreement-field">
              <dt>Capital amount</dt>
              <dd>
                <MoneyDisplay paise={agreement.capitalAmount} prominent />
              </dd>
            </div>
            <div className="agreement-field">
              <dt>Start date</dt>
              <dd>{formatDate(agreement.startDate)}</dd>
            </div>
            <div className="agreement-field">
              <dt>End date</dt>
              <dd>{agreement.endDate ? formatDate(agreement.endDate) : "Open-ended"}</dd>
            </div>
          </div>
        </section>

        {/* ─── Profit structure ─────────────────────────────────────────────── */}
        <section className="agreement-section" aria-labelledby="profit-title">
          <h2 id="profit-title" className="agreement-section__title">
            <Percent size={17} aria-hidden="true" />
            Profit structure
          </h2>
          <div className="agreement-grid-3">
            <div className="agreement-field">
              <dt>Profit calculation</dt>
              <dd>{profitTypeLabel(agreement.profitCalculationType)}</dd>
            </div>

            {agreement.profitCalculationType === "PERCENTAGE" && agreement.profitRate ? (
              <div className="agreement-field">
                <dt>Profit rate</dt>
                <dd className="agreement-field__value--prominent">
                  {parseFloat(agreement.profitRate).toFixed(2)}% p.a.
                </dd>
              </div>
            ) : null}

            {agreement.profitCalculationType === "FIXED" && agreement.fixedProfitAmount ? (
              <div className="agreement-field">
                <dt>Fixed profit amount</dt>
                <dd>
                  <MoneyDisplay paise={agreement.fixedProfitAmount} prominent />
                  {" "}/ {frequencyLabel(agreement.profitFrequency).toLowerCase()}
                </dd>
              </div>
            ) : null}

            <div className="agreement-field">
              <dt>Profit frequency</dt>
              <dd>{frequencyLabel(agreement.profitFrequency)}</dd>
            </div>
          </div>

          {agreement.profitCalculationType === "CUSTOM" && agreement.customProfitTerms ? (
            <div className="agreement-custom-terms">
              <p className="agreement-custom-terms__label">Custom profit terms</p>
              <p className="agreement-custom-terms__body">{agreement.customProfitTerms}</p>
            </div>
          ) : null}

          {agreement.profitFrequency === "CUSTOM" && agreement.customFrequencyTerms ? (
            <div className="agreement-custom-terms">
              <p className="agreement-custom-terms__label">Custom frequency terms</p>
              <p className="agreement-custom-terms__body">{agreement.customFrequencyTerms}</p>
            </div>
          ) : null}
        </section>

        {/* ─── Repayment terms ──────────────────────────────────────────────── */}
        <section className="agreement-section" aria-labelledby="repay-title">
          <h2 id="repay-title" className="agreement-section__title">
            <CalendarClock size={17} aria-hidden="true" />
            Repayment and payment terms
          </h2>
          <div className="agreement-terms-grid">
            <div className="agreement-terms-block">
              <dt>Principal repayment terms</dt>
              <dd>{agreement.principalRepaymentTerms}</dd>
            </div>
            <div className="agreement-terms-block">
              <dt>Profit payment terms</dt>
              <dd>{agreement.profitPaymentTerms}</dd>
            </div>
          </div>
        </section>

        {/* ─── Supporting document placeholder ─────────────────────────────── */}
        <section className="agreement-section" aria-labelledby="doc-title">
          <h2 id="doc-title" className="agreement-section__title">
            <FileText size={17} aria-hidden="true" />
            Supporting document
          </h2>
          {agreement.documentId ? (
            <p className="agreement-doc-ref">
              Document ID: <code>{agreement.documentId}</code>
            </p>
          ) : (
            <div className="agreement-no-doc">
              <p>No document attached.</p>
              <button className="button button--secondary" type="button">
                Attach document
              </button>
            </div>
          )}
        </section>

        {/* ─── Notes ────────────────────────────────────────────────────────── */}
        {agreement.notes ? (
          <div className="detail-notes">
            <strong>Notes</strong>
            <p>{agreement.notes}</p>
          </div>
        ) : null}

        {/* ─── Audit timestamps ─────────────────────────────────────────────── */}
        <div className="agreement-timestamps">
          <span>Created {formatDate(agreement.createdAt)}</span>
          <span>·</span>
          <span>Updated {formatDate(agreement.updatedAt)}</span>
        </div>
      </motion.div>
    </div>
  );
}
