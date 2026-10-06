import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";

import { getNavigationItem } from "../navigation/navigation";
import { MobileNavigation } from "./MobileNavigation";
import { DataStatus } from "../components/DataStatus";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const activeItem = getNavigationItem(location.pathname);

  return (
    <div className="app-shell">
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
              <DataStatus><Outlet /></DataStatus>
            </main>
          </motion.div>
        </AnimatePresence>
      </div>
      <MobileNavigation />
    </div>
  );
}