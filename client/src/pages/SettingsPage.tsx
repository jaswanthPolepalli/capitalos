import { Moon, Sun, User } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { RecoveryPanel } from "../components/RecoveryPanel";
import { useTheme } from "../theme/ThemeProvider";

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

        <RecoveryPanel />
      </div>
    </div>
  );
}
