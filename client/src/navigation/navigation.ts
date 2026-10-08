import {
  BadgeIndianRupee,
  BarChart2,
  BookOpen,
  CalendarClock,
  CreditCard,
  Handshake,
  LayoutDashboard,
  Link2,
  Settings,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  path: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** Whether this item is visible to CEO (read-only) users. Defaults to true. */
  ceoVisible?: boolean;
}

export const navigationItems: NavigationItem[] = [
  {
    path: "/",
    label: "Dashboard",
    shortLabel: "Home",
    description: "Financial operating overview",
    icon: LayoutDashboard,
  },
  {
    path: "/partners",
    label: "Partners",
    shortLabel: "Partners",
    description: "Capital partner records",
    icon: Handshake,
  },
  {
    path: "/capital-contributions",
    label: "Capital Contributions",
    shortLabel: "Capital",
    description: "Partner capital contributions",
    icon: BadgeIndianRupee,
  },
  {
    path: "/pending-profits",
    label: "Profits",
    shortLabel: "Profits",
    description: "Profit obligations and payments, by month",
    icon: TrendingUp,
  },
  {
    path: "/cfo-share",
    label: "CFO Share",
    shortLabel: "CFO Share",
    description: "CFO profit allocations by transaction",
    icon: Wallet,
  },
  {
    path: "/return-obligations",
    label: "Return Obligations",
    shortLabel: "Returns",
    description: "Capital return schedule",
    icon: CalendarClock,
  },
  {
    path: "/ledger",
    label: "Ledger",
    shortLabel: "Ledger",
    description: "Transactions and change history",
    icon: BookOpen,
  },
  {
    path: "/credit-cards",
    label: "Credit Cards",
    shortLabel: "Cards",
    description: "Partner credit cards",
    icon: CreditCard,
  },
  {
    path: "/reports",
    label: "Reports",
    shortLabel: "Reports",
    description: "Financial summaries & trend charts",
    icon: BarChart2,
  },
  { path: "/due-calendar", label: "Due Calendar", shortLabel: "Calendar", description: "Due dates and reminder history", icon: CalendarClock },
  { path: "/liability-planning", label: "Liability Planning", shortLabel: "Planning", description: "7/30/90-day commitments and concentration", icon: BarChart2 },
  { path: "/activity", label: "Change History", shortLabel: "History", description: "Previous values and recovery actions", icon: BookOpen, ceoVisible: false },
  { path: "/import", label: "Getting Started & Import", shortLabel: "Import", description: "Guided setup and CSV import", icon: BadgeIndianRupee, ceoVisible: false },
  {
    path: "/portal-links",
    label: "Portal Links",
    shortLabel: "Portals",
    description: "Secure partner portal access",
    icon: Link2,
    ceoVisible: false,
  },
  {
    path: "/settings",
    label: "Settings",
    shortLabel: "Settings",
    description: "Workspace preferences",
    icon: Settings,
    ceoVisible: false,
  },
];

export const mobilePrimaryPaths = ["/", "/partners", "/capital-contributions", "/pending-profits"];

export function getNavigationItem(pathname: string): NavigationItem {
  return (
    navigationItems.find((item) =>
      item.path === "/"
        ? pathname === item.path
        : pathname === item.path || pathname.startsWith(`${item.path}/`),
    ) ?? navigationItems[0]!
  );
}
