import { motion } from "framer-motion";
import { Landmark } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useRole } from "../context/RoleContext";
import { navigationItems } from "../navigation/navigation";

export function Sidebar() {
  const { isCFO } = useRole();

  // CEO (read-only) users see a filtered nav — hide items marked ceoVisible: false
  const visibleItems = isCFO
    ? navigationItems
    : navigationItems.filter((item) => item.ceoVisible !== false);

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar__brand">
        <span className="brand-mark" aria-hidden="true">
          <Landmark size={20} strokeWidth={1.8} />
        </span>
        <span className="sidebar__brand-copy">
          <strong>CapitalOS</strong>
          <small>{isCFO ? "CFO workspace" : "CEO view"}</small>
        </span>
      </div>

      <div className="sidebar__section-label">Workspace</div>
      <nav className="sidebar__nav">
        {visibleItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              className={({ isActive }) =>
                `sidebar__link${isActive ? " sidebar__link--active" : ""}`
              }
              end={item.path === "/"}
              title={item.label}
              to={item.path}
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <motion.span
                      className="sidebar__active-indicator"
                      layoutId="sidebar-active-route"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span className="sidebar__link-label">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <span className="sidebar__status-dot" aria-hidden="true" />
        <span className="sidebar__footer-copy">
          <strong>{isCFO ? "Private workspace" : "Read-only view"}</strong>
          <small>{isCFO ? "Catalyst protected" : "CEO access"}</small>
        </span>
      </div>
    </aside>
  );
}
