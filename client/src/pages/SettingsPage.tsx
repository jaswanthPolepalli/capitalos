import { Moon, RefreshCw, Sun, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "../components/PageHeader";
import { useTheme } from "../theme/ThemeProvider";
import * as Store from "../store";

// ─── Deleted Record types ─────────────────────────────────────────────────────

interface DeletedAllocation {
  id: string;
  partnerId: string;
  amountRupees: number;
  receivedDate: string;
  profitPercent: number;
  deletedAt?: string;
}

interface DeletedCapitalReturn {
  id: string;
  partnerId: string;
  allocationId: string;
  amountRupees: number;
  returnedDate: string;
  deletedAt?: string;
}

interface DeletedProfitRecord {
  id: string;
  partnerId: string;
  allocationId: string;
  amountRupees: number;
  paidDate: string;
  deletedAt?: string;
}

function fmt(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// ─── Soft-Delete Recovery Section ────────────────────────────────────────────

function SoftDeleteSection() {
  const [deletedAllocations, setDeletedAllocations] = useState<DeletedAllocation[]>([]);
  const [deletedReturns, setDeletedReturns] = useState<DeletedCapitalReturn[]>([]);
  const [deletedProfits, setDeletedProfits] = useState<DeletedProfitRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadDeleted() {
    setLoading(true);
    setError(null);
    try {
      const [allocs, returns_, profits_] = await Promise.all([
        fetch("/server/capitalos-api/allocations?deleted=true").then((r) => r.json()).then((j) => (j.data ?? []) as DeletedAllocation[]),
        fetch("/server/capitalos-api/capital-returns?deleted=true").then((r) => r.json()).then((j) => (j.data ?? []) as DeletedCapitalReturn[]),
        fetch("/server/capitalos-api/profit-records?deleted=true").then((r) => r.json()).then((j) => (j.data ?? []) as DeletedProfitRecord[]),
      ]);
      setDeletedAllocations(allocs);
      setDeletedReturns(returns_);
      setDeletedProfits(profits_);
    } catch {
      setError("Could not load deleted records. The API may not support this endpoint yet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeleted();
  }, []);

  async function handleRestoreAllocation(id: string) {
    setRestoringId(id);
    try {
      await Store.restoreAllocation(id);
      setDeletedAllocations((prev) => prev.filter((a) => a.id !== id));
      setSuccessMsg("Allocation restored successfully.");
    } catch {
      setError("Failed to restore allocation.");
    } finally {
      setRestoringId(null);
    }
  }

  async function handleRestoreCapitalReturn(id: string) {
    setRestoringId(id);
    try {
      await Store.restoreCapitalReturn(id);
      setDeletedReturns((prev) => prev.filter((r) => r.id !== id));
      setSuccessMsg("Capital return restored successfully.");
    } catch {
      setError("Failed to restore capital return.");
    } finally {
      setRestoringId(null);
    }
  }

  async function handleRestoreProfitRecord(id: string) {
    setRestoringId(id);
    try {
      await Store.restoreProfitRecord(id);
      setDeletedProfits((prev) => prev.filter((r) => r.id !== id));
      setSuccessMsg("Profit record restored successfully.");
    } catch {
      setError("Failed to restore profit record.");
    } finally {
      setRestoringId(null);
    }
  }

  const totalDeleted = deletedAllocations.length + deletedReturns.length + deletedProfits.length;

  return (
    <section className="settings-section" aria-labelledby="deleted-title">
      <div className="settings-section__heading">
        <Trash2 size={20} aria-hidden="true" />
        <div>
          <h2 id="deleted-title">Deleted Records</h2>
          <p>View and restore soft-deleted entries. Deleted records are hidden from all lists but can be recovered here.</p>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          {loading ? "Loading…" : `${totalDeleted} deleted record${totalDeleted !== 1 ? "s" : ""} found`}
        </span>
        <button
          className="button button--secondary"
          type="button"
          onClick={loadDeleted}
          disabled={loading}
          style={{ fontSize: 12 }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && (
        <div className="form-hint" style={{ borderLeft: "3px solid var(--outgoing)", color: "var(--outgoing)", marginBottom: 12 }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="form-hint" style={{ borderLeft: "3px solid var(--incoming)", color: "var(--incoming)", marginBottom: 12 }}>
          {successMsg}
          <button
            type="button"
            style={{ marginLeft: 8, fontSize: 11, background: "none", border: "none", cursor: "pointer", color: "inherit", textDecoration: "underline" }}
            onClick={() => setSuccessMsg(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {!loading && totalDeleted === 0 && !error && (
        <div style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>
          No deleted records found. Records you soft-delete will appear here for recovery.
        </div>
      )}

      {/* Deleted Allocations */}
      {deletedAllocations.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
            Capital Allocations ({deletedAllocations.length})
          </h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="table-th">Partner ID</th>
                  <th className="table-th table-th--money">Amount</th>
                  <th className="table-th">Rate</th>
                  <th className="table-th">Received date</th>
                  <th className="table-th table-th--action"><span className="sr-only">Restore</span></th>
                </tr>
              </thead>
              <tbody>
                {deletedAllocations.map((a) => (
                  <tr className="table-row" key={a.id} style={{ opacity: 0.7 }}>
                    <td className="table-cell" style={{ color: "var(--muted)" }}>{a.partnerId}</td>
                    <td className="table-cell table-cell--money">{fmt(a.amountRupees)}</td>
                    <td className="table-cell">{a.profitPercent}% p.m.</td>
                    <td className="table-cell table-cell--secondary">{a.receivedDate}</td>
                    <td className="table-cell table-cell--action">
                      <button
                        className="button button--secondary"
                        type="button"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => handleRestoreAllocation(a.id)}
                        disabled={restoringId === a.id}
                      >
                        {restoringId === a.id ? "Restoring…" : <><RefreshCw size={12} /> Restore</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deleted Capital Returns */}
      {deletedReturns.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
            Capital Returns ({deletedReturns.length})
          </h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="table-th">Partner ID</th>
                  <th className="table-th table-th--money">Amount</th>
                  <th className="table-th">Returned date</th>
                  <th className="table-th table-th--action"><span className="sr-only">Restore</span></th>
                </tr>
              </thead>
              <tbody>
                {deletedReturns.map((r) => (
                  <tr className="table-row" key={r.id} style={{ opacity: 0.7 }}>
                    <td className="table-cell" style={{ color: "var(--muted)" }}>{r.partnerId}</td>
                    <td className="table-cell table-cell--money">{fmt(r.amountRupees)}</td>
                    <td className="table-cell table-cell--secondary">{r.returnedDate}</td>
                    <td className="table-cell table-cell--action">
                      <button
                        className="button button--secondary"
                        type="button"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => handleRestoreCapitalReturn(r.id)}
                        disabled={restoringId === r.id}
                      >
                        {restoringId === r.id ? "Restoring…" : <><RefreshCw size={12} /> Restore</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deleted Profit Records */}
      {deletedProfits.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
            Profit Records ({deletedProfits.length})
          </h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="table-th">Partner ID</th>
                  <th className="table-th table-th--money">Amount</th>
                  <th className="table-th">Paid date</th>
                  <th className="table-th table-th--action"><span className="sr-only">Restore</span></th>
                </tr>
              </thead>
              <tbody>
                {deletedProfits.map((r) => (
                  <tr className="table-row" key={r.id} style={{ opacity: 0.7 }}>
                    <td className="table-cell" style={{ color: "var(--muted)" }}>{r.partnerId}</td>
                    <td className="table-cell table-cell--money">{fmt(r.amountRupees)}</td>
                    <td className="table-cell table-cell--secondary">{r.paidDate}</td>
                    <td className="table-cell table-cell--action">
                      <button
                        className="button button--secondary"
                        type="button"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => handleRestoreProfitRecord(r.id)}
                        disabled={restoringId === r.id}
                      >
                        {restoringId === r.id ? "Restoring…" : <><RefreshCw size={12} /> Restore</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="settings-page">
      <PageHeader
        description="Manage your workspace appearance and recover deleted records."
        title="Settings"
      />

      <div className="settings-grid">
        <section className="settings-section" aria-labelledby="appearance-title">
          <div className="settings-section__heading">
            {isDark ? (
              <Moon size={20} aria-hidden="true" />
            ) : (
              <Sun size={20} aria-hidden="true" />
            )}
            <div>
              <h2 id="appearance-title">Appearance</h2>
              <p>Choose the color mode used across your workspace.</p>
            </div>
          </div>
          <div className="setting-row">
            <span>
              <strong>Dark mode</strong>
              <small>{isDark ? "Enabled" : "Disabled"}</small>
            </span>
            <button
              aria-checked={isDark}
              aria-label="Dark mode"
              className="theme-switch"
              onClick={toggleTheme}
              role="switch"
              type="button"
            >
              <span className="theme-switch__thumb" />
            </button>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="workspace-title">
          <div className="settings-section__heading">
            <User size={20} aria-hidden="true" />
            <div>
              <h2 id="workspace-title">Workspace</h2>
              <p>You are the CFO and sole administrator of this workspace.</p>
            </div>
          </div>
          <dl className="account-details">
            <div>
              <dt>Role</dt>
              <dd>CFO / Owner</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>Full — all modules</dd>
            </div>
          </dl>
        </section>

        <SoftDeleteSection />
      </div>
    </div>
  );
}
