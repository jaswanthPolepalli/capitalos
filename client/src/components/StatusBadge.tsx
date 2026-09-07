import type { EntityStatus, InvestmentStatus, ScheduleStatus } from "../types/domain";

type BadgeStatus =
  | EntityStatus
  | InvestmentStatus
  | ScheduleStatus
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "DRAFT"
  | "COMPLETED"
  | "CANCELLED"
  | "OVERDUE"
  | "UPCOMING"
  | "DUE"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PARTIALLY_REPAID"
  | "FULLY_REPAID"
  | "WRITTEN_OFF"
  | string;

function getVariant(status: BadgeStatus): string {
  switch (status) {
    case "ACTIVE":
    case "PAID":
    case "FULLY_REPAID":
      return "status-badge--active";
    case "INACTIVE":
    case "COMPLETED":
    case "CANCELLED":
    case "WRITTEN_OFF":
      return "status-badge--inactive";
    case "OVERDUE":
      return "status-badge--overdue";
    case "UPCOMING":
    case "DUE":
      return "status-badge--upcoming";
    case "PARTIALLY_PAID":
    case "PARTIALLY_REPAID":
      return "status-badge--partial";
    case "SUSPENDED":
    case "DRAFT":
      return "status-badge--warning";
    default:
      return "status-badge--neutral";
  }
}

function getLabel(status: BadgeStatus): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${getVariant(status)}`}>
      {label ?? getLabel(status)}
    </span>
  );
}
