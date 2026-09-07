import type { ReactNode } from "react";

export interface FilterOption {
  value: string;
  label: string;
}

interface SelectFilterProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

export function SelectFilter({
  label,
  value,
  options,
  onChange,
}: SelectFilterProps) {
  return (
    <label className="select-filter">
      <span className="sr-only">{label}</span>
      <select
        className="select-filter__control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface FilterBarProps {
  children: ReactNode;
  trailing?: ReactNode;
}

export function FilterBar({ children, trailing }: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="filter-bar__controls">{children}</div>
      {trailing ? <div className="filter-bar__trailing">{trailing}</div> : null}
    </div>
  );
}
