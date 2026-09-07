/**
 * Portal Links page — generate and copy read-only portal URLs for partners and CEO.
 *
 * Partner links: /p/partner-<id>  → shows that partner's capital, profits, return dates
 * CEO link:      /p/ceo-overview  → shows aggregate portfolio (total capital, pending profits, return schedule)
 */

import { CheckCircle2, Copy, ExternalLink, Landmark, Link2, User } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { useStore } from "../useStore";

// ─── Partner portal card ──────────────────────────────────────────────────────

function PartnerPortalCard({ id, name }: { id: string; name: string }) {
  const token = `partner-${id}`;
  const url = `${window.location.origin}/app/#/p/${token}`;
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  return (
    <div className="portal-link-card">
      <div className="portal-link-card__header">
        <div className="portal-link-card__party">
          <span className="portal-link-card__avatar" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{name}</strong>
            <small>Partner portal · read-only</small>
          </div>
        </div>
        <span className="status-badge status-badge--active">Active</span>
      </div>

      <dl className="portal-link-card__meta">
        <div>
          <dt>Sees</dt>
          <dd>Their capital, profit % per allocation, payments received, pending profit, return dates</dd>
        </div>
      </dl>

      <div className="portal-link-card__url">
        <span className="portal-link-card__url-preview" aria-label="Portal URL">
          <Link2 size={13} aria-hidden="true" />
          {url}
        </span>
      </div>

      <div className="portal-link-card__actions">
        <button className="button button--primary" onClick={copyLink} type="button">
          {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
          {copied ? "Copied!" : "Copy link"}
        </button>
        <Link
          className="button button--secondary"
          to={`/p/${token}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={15} />
          Preview
        </Link>
      </div>
    </div>
  );
}

// ─── CEO portal card ──────────────────────────────────────────────────────────

function CEOPortalCard() {
  const token = "ceo-overview";
  const url = `${window.location.origin}/app/#/p/${token}`;
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  return (
    <div className="portal-link-card" style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, var(--border))" }}>
      <div className="portal-link-card__header">
        <div className="portal-link-card__party">
          <span className="portal-link-card__avatar portal-link-card__avatar--business" aria-hidden="true">
            <Landmark size={18} />
          </span>
          <div>
            <strong>CEO / Business partner</strong>
            <small>Aggregate portfolio view · read-only</small>
          </div>
        </div>
        <span className="status-badge status-badge--active">Active</span>
      </div>

      <dl className="portal-link-card__meta">
        <div>
          <dt>Sees</dt>
          <dd>Total capital outstanding, pending profits per partner, capital return schedule</dd>
        </div>
      </dl>

      <div className="portal-link-card__url">
        <span className="portal-link-card__url-preview" aria-label="CEO portal URL">
          <Link2 size={13} aria-hidden="true" />
          {url}
        </span>
      </div>

      <div className="portal-link-card__actions">
        <button className="button button--primary" onClick={copyLink} type="button">
          {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
          {copied ? "Copied!" : "Copy link"}
        </button>
        <Link
          className="button button--secondary"
          to={`/p/${token}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={15} />
          Preview
        </Link>
      </div>
    </div>
  );
}

// ─── Portal Links page ────────────────────────────────────────────────────────

export function PortalLinksPage() {
  const { partners } = useStore();

  return (
    <div className="list-page">
      <PageHeader
        eyebrow="Secure access"
        title="Portal Links"
        description="Copy and share these read-only links with partners and your CEO. Each link shows only the relevant financial data."
      />

      {/* How it works */}
      <div className="foundation-banner" style={{ marginBottom: 20 }}>
        <span className="foundation-banner__icon" aria-hidden="true">
          <Link2 size={20} />
        </span>
        <div>
          <strong>How portal links work</strong>
          <p>
            Each link is unique and opens a read-only view. Partners see only their own data.
            The CEO link shows total capital, pending profits, and return obligations.
          </p>
        </div>
      </div>

      {/* CEO portal — always one */}
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
        CEO / Business partner portal
      </h2>
      <div className="portal-links-grid" style={{ marginBottom: 28 }}>
        <CEOPortalCard />
      </div>

      {/* Partner portals */}
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
        <User size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
        Partner portals ({partners.length})
      </h2>

      {partners.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <span className="empty-state__icon"><Link2 size={22} /></span>
          <h3>No partners yet</h3>
          <p>Add partners first, then share their individual portal links.</p>
          <Link className="button button--primary" to="/partners">Add a partner</Link>
        </div>
      ) : (
        <div className="portal-links-grid">
          {partners.map((p) => (
            <PartnerPortalCard key={p.id} id={p.id} name={p.name} />
          ))}
        </div>
      )}
    </div>
  );
}
