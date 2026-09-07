import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

import { getNavigationItem } from "../navigation/navigation";
import { MobileNavigation } from "./MobileNavigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const activeItem = getNavigationItem(location.pathname);

  // On mobile, hide the top bar on all pages except the Dashboard (Home)
  const isHome = location.pathname === "/";

  return (
    <div className={`app-shell${!isHome ? " app-shell--no-mobile-topbar" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar />
      <div className="app-shell__workspace">
        <TopBar activeItem={activeItem} />
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1 }}
            className="page-transition"
            exit={{ opacity: reduceMotion ? 1 : 0 }}
            initial={reduceMotion ? false : { opacity: 0 }}
            key={location.pathname}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
          >
            <main className="page-content" id="main-content">
              <Outlet />
            </main>
          </motion.div>
        </AnimatePresence>
      </div>
      <MobileNavigation />
    </div>
  );
}