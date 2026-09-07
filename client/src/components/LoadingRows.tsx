/**
 * Skeleton loading rows for tables and lists.
 * Provides a consistent loading shimmer without a library dependency.
 */

interface LoadingRowsProps {
  columns?: number;
  rows?: number;
}

export function LoadingRows({ columns = 5, rows = 5 }: LoadingRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, ri) => (
        <tr key={ri} className="table-loading-row" aria-hidden="true">
          {Array.from({ length: columns }, (__, ci) => (
            <td key={ci}>
              <span
                className="skeleton"
                style={{ width: `${60 + ((ri * 3 + ci * 7) % 30)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Card-based loading skeleton for mobile / stacked views */
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="loading-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="loading-card">
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      ))}
    </div>
  );
}
