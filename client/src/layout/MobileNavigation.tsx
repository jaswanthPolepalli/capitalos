import { AnimatePresence, motion } from "framer-motion";
import { Landmark, MoreHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";

import {
  mobilePrimaryPaths,
  navigationItems,
} from "../navigation/navigation";

export function MobileNavigation() {
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const primaryItems = navigationItems.filter((item) =>
    mobilePrimaryPaths.includes(item.path),
  );
  const isMoreActive = !mobilePrimaryPaths.some((path) =>
    path === "/"
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(`${path}/`),
  );

  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }

    const workspace = document.querySelector<HTMLElement>(".app-shell");
    const wasInert = workspace?.inert ?? false;
    if (workspace) workspace.inert = true;
    if (navRef.current) navRef.current.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
      }
      if (event.key === "Tab") {
        const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    const desktop = window.matchMedia?.("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop?.matches) setIsDrawerOpen(false); };
    desktop?.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      if (workspace) workspace.inert = wasInert;
      if (navRef.current) navRef.current.inert = false;
      moreButtonRef.current?.focus();
      desktop?.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isDrawerOpen]);

  const navContent = (
    <>
      <nav ref={navRef} className="mobile-nav" aria-label="Mobile navigation">
        {primaryItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              className={({ isActive }) =>
                `mobile-nav__link${isActive ? " mobile-nav__link--active" : ""}`
              }
              end={item.path === "/"}
              to={item.path}
            >
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.shortLabel}</span>
            </NavLink>
          );
        })}
        <button
          ref={moreButtonRef}
          aria-expanded={isDrawerOpen}
          className={`mobile-nav__link mobile-nav__more${isMoreActive ? " mobile-nav__link--active" : ""}`}
          onClick={() => setIsDrawerOpen(true)}
          type="button"
        >
          <MoreHorizontal size={21} aria-hidden="true" />
          <span>More</span>
          <span className="mobile-nav__more-dot" aria-hidden="true" />
        </button>
      </nav>

      <AnimatePresence>
        {isDrawerOpen ? (
          <div className="mobile-drawer-layer">
            <motion.button
              animate={{ opacity: 1 }}
              aria-label="Close navigation"
              tabIndex={-1}
              className="mobile-drawer-backdrop"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              type="button"
            />
            <motion.aside
              ref={drawerRef}
              animate={{ y: 0 }}
              aria-label="All CapitalOS sections"
              aria-modal="true"
              className="mobile-drawer"
              exit={{ y: "100%" }}
              initial={{ y: "100%" }}
              role="dialog"
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
            >
              <header className="mobile-drawer__header">
                <div className="brand-lockup">
                  <span className="brand-mark" aria-hidden="true">
                    <Landmark size={19} />
                  </span>
                  <strong>CapitalOS</strong>
                </div>
                <button
                  aria-label="Close navigation"
                  className="icon-button"
                  onClick={() => setIsDrawerOpen(false)}
                  ref={closeButtonRef}
                  type="button"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </header>
              <nav className="mobile-drawer__nav">
                {navigationItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      className={({ isActive }) =>
                        `mobile-drawer__link${isActive ? " mobile-drawer__link--active" : ""}`
                      }
                      end={item.path === "/"}
                      onClick={() => setIsDrawerOpen(false)}
                      to={item.path}
                    >
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </NavLink>
                  );
                })}
              </nav>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );

  // Render via portal into document.body so position:fixed is not affected
  // by any CSS transform/will-change stacking context from parent elements
  // (e.g. framer-motion's translateY animation on the page-transition wrapper)
  return createPortal(navContent, document.body);
}
