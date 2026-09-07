import { Search, X } from "lucide-react";
import { useId } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  label = "Search",
}: SearchInputProps) {
  const id = useId();

  return (
    <div className="search-input">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <span className="search-input__icon" aria-hidden="true">
        <Search size={16} />
      </span>
      <input
        className="search-input__field"
        id={id}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      {value ? (
        <button
          aria-label="Clear search"
          className="search-input__clear"
          onClick={() => onChange("")}
          type="button"
        >
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
