import type { TransactionDirection, TransactionType } from "../types/domain";

interface TransactionTypeBadgeProps {
  type: TransactionType;
  direction: TransactionDirection;
}

const TYPE_CONFIG: Record<
  TransactionType,
  { label: string; variant: "in" | "out" }
> = {
  PARTNER_CAPITAL_RECEIVED: { label: "Capital received", variant: "in" },
  CEO_CAPITAL_PROVIDED: { label: "Capital provided", variant: "out" },
  CEO_PRINCIPAL_RECEIVED: { label: "Principal received", variant: "in" },
  CEO_PROFIT_RECEIVED: { label: "Profit received", variant: "in" },
  PARTNER_PRINCIPAL_PAID: { label: "Principal paid", variant: "out" },
  PARTNER_PROFIT_PAID: { label: "Profit paid", variant: "out" },
};

export function TransactionTypeBadge({
  type,
  direction,
}: TransactionTypeBadgeProps) {
  const config = TYPE_CONFIG[type];
  const variant = direction === "IN" ? "in" : "out";

  return (
    <span className={`txn-type-badge txn-type-badge--${variant}`}>
      <span className="txn-type-badge__dot" aria-hidden="true" />
      {config?.label ?? type.replace(/_/g, " ")}
    </span>
  );
}
