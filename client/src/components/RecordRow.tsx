import { Children, cloneElement, isValidElement, useState } from "react";
import type { ComponentPropsWithRef, ReactElement, TdHTMLAttributes } from "react";

// Keep identity, balances, deadlines and actions visible; secondary context is
// available on demand on phones. Desktop retains every original column.
const secondaryLabels = new Set([
  "Source", "Rate", "Profit %", "Received", "Since", "Notes", "Profit accrued",
  "Regular profit paid", "Cashback paid", "Profit paid", "Returned", "Bill gen", "Due date", "Allocation",
]);
type CellProps = TdHTMLAttributes<HTMLTableCellElement> & { "data-label"?: string; "data-mobile-secondary"?: boolean };

export function RecordRow({ children, ...props }: ComponentPropsWithRef<"tr">) {
  const [expanded, setExpanded] = useState(false);
  let hasDetails = false;
  const cells = Children.map(children, (child) => {
    if (!isValidElement<CellProps>(child) || child.type !== "td" || !secondaryLabels.has(child.props["data-label"] ?? "")) return child;
    hasDetails = true;
    return cloneElement(child as ReactElement<CellProps>, { "data-mobile-secondary": true });
  });
  return (
    <tr {...props} data-details-expanded={expanded}>
      {cells}
      {hasDetails && <td className="mobile-record-toggle">
        <button type="button" className="button button--secondary" aria-expanded={expanded}
          onClick={(event) => { event.stopPropagation(); setExpanded(!expanded); }}>
          {expanded ? "Hide details" : "Show details"}
        </button>
      </td>}
    </tr>
  );
}
