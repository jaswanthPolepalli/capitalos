import { MotionConfig } from "framer-motion";
import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { DataRefreshNotice } from "./components/DataRefreshNotice";
import { ModalAccessibility } from "./components/ModalAccessibility";
import { CommandPalette } from "./components/CommandPalette";
import { ToastProvider } from "./components/Toast";
import { RoleProvider } from "./context/RoleContext";
import { AppShell } from "./layout/AppShell";

// ─── Eagerly loaded ───────────────────────────────────────────────────────────
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ThemeProvider } from "./theme/ThemeProvider";

// ─── Lazily loaded (route-level code splitting) ────────────────────────────────
const CapitalContributionsPage = lazy(() =>
  import("./pages/CapitalContributionsPage").then((m) => ({ default: m.CapitalContributionsPage })),
);
const PartnerDetailPage = lazy(() =>
  import("./pages/PartnerDetailPage").then((m) => ({ default: m.PartnerDetailPage })),
);
const PartnerStatementPage = lazy(() =>
  import("./pages/PartnerStatementPage").then((m) => ({ default: m.PartnerStatementPage })),
);
const PartnersPage = lazy(() =>
  import("./pages/PartnersPage").then((m) => ({ default: m.PartnersPage })),
);
const LedgerPage = lazy(() =>
  import("./pages/LedgerPage").then((m) => ({ default: m.LedgerPage })),
);
const PendingProfitsPage = lazy(() =>
  import("./pages/PendingProfitsPage").then((m) => ({ default: m.PendingProfitsPage })),
);
const ReturnObligationsPage = lazy(() =>
  import("./pages/ReturnObligationsPage").then((m) => ({ default: m.ReturnObligationsPage })),
);
const PortalLinksPage = lazy(() =>
  import("./pages/PortalLinksPage").then((m) => ({ default: m.PortalLinksPage })),
);
const PublicPortalPage = lazy(() =>
  import("./pages/PublicPortalPage").then((m) => ({ default: m.PublicPortalPage })),
);
const CreditCardsPage = lazy(() =>
  import("./pages/CreditCardsPage").then((m) => ({ default: m.CreditCardsPage })),
);
const BulkPaymentPage = lazy(() =>
  import("./pages/BulkPaymentPage").then((m) => ({ default: m.BulkPaymentPage })),
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);

const CFOSharePage = lazy(() => import('./pages/CFOSharePage').then(m => ({ default: m.CFOSharePage })));
const ActivityPage = lazy(() => import('./pages/ActivityPage').then(m => ({ default: m.ActivityPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })));
const DueCalendarPage = lazy(() => import('./pages/DueCalendarPage').then(m => ({ default: m.DueCalendarPage })));
const LiabilityPlanningPage = lazy(() => import('./pages/LiabilityPlanningPage').then(m => ({ default: m.LiabilityPlanningPage })));

// ─── Suspend fallback ─────────────────────────────────────────────────────────

function RouteLoadingFallback() {
  return (
    <main className="session-screen" aria-busy="true" aria-live="polite">
      <div className="session-loader" aria-hidden="true" />
    </main>
  );
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* ── Public partner/CEO portal (shared external links) ──────── */}
        <Route path="/p/:token" element={<PublicPortalPage />} />

        {/* ── CFO workspace (no authentication required) ─────────────── */}
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/partners/:id" element={<PartnerDetailPage />} />
          <Route path="/partners/:id/statement" element={<PartnerStatementPage />} />
          <Route path="/capital-contributions" element={<CapitalContributionsPage />} />
          <Route path="/cfo-share" element={<CFOSharePage />} />
          <Route path="/pending-profits" element={<PendingProfitsPage />} />
          <Route path="/return-obligations" element={<ReturnObligationsPage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/credit-cards" element={<CreditCardsPage />} />
          <Route path="/bulk-payment" element={<BulkPaymentPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/portal-links" element={<PortalLinksPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/due-calendar" element={<DueCalendarPage />} />
          <Route path="/liability-planning" element={<LiabilityPlanningPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export function App() {
  return (
    <HashRouter>
      <RoleProvider>
        <ThemeProvider>
          <ToastProvider>
            <MotionConfig reducedMotion="user">
              <DataRefreshNotice />
              <ModalAccessibility />
              <AppRoutes />
              <CommandPalette />
            </MotionConfig>
          </ToastProvider>
        </ThemeProvider>
      </RoleProvider>
    </HashRouter>
  );
}
