import { Search } from 'lucide-react';

/** A labelled search input (the customer portal's style), for the company lists. */
export function SearchBox({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative flex-1">
      <label htmlFor={id} className="mb-1.5 block text-small font-semibold text-heading">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-3 bottom-3 size-5 text-muted"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-(--btn-height) w-full rounded-sm border border-slate-200 bg-white ps-10 pe-4 text-heading shadow-sm placeholder:text-muted focus:border-blue-600 focus:bg-blue-50"
      />
    </div>
  );
}
