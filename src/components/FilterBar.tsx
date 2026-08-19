export type FilterState = {
  q: string;
  status: string;
  owner: string;
  dateFrom: string;
  dateTo: string;
};

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  statusOptions?: string[];
  ownerOptions?: string[];
  onReset?: () => void;
};

export function FilterBar({ value, onChange, statusOptions, ownerOptions, onReset }: Props) {
  function update(patch: Partial<FilterState>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="filter-bar" role="search" aria-label="Filters">
      <label className="filter-bar__search" aria-label="Search records">
        <span className="filter-bar__search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="search"
          placeholder="Search by name…"
          value={value.q}
          onChange={(e) => update({ q: e.target.value })}
          aria-label="Search"
        />
      </label>

      <label>
        <span className="sr-only">Status</span>
        <select
          className="select"
          value={value.status}
          onChange={(e) => update({ status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {(statusOptions ?? ["active", "pending", "inactive", "draft"]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="sr-only">Owner</span>
        <select
          className="select"
          value={value.owner}
          onChange={(e) => update({ owner: e.target.value })}
          aria-label="Filter by owner"
        >
          <option value="">All owners</option>
          {(ownerOptions ?? ["Alex Rivera", "Jordan Lee", "Casey Kim", "Morgan Blake"]).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="sr-only">From date</span>
        <input
          type="date"
          className="input-date"
          value={value.dateFrom}
          onChange={(e) => update({ dateFrom: e.target.value })}
          aria-label="From date"
        />
      </label>

      <label>
        <span className="sr-only">To date</span>
        <input
          type="date"
          className="input-date"
          value={value.dateTo}
          onChange={(e) => update({ dateTo: e.target.value })}
          aria-label="To date"
        />
      </label>

      {onReset && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onReset} aria-label="Clear filters">
          Clear
        </button>
      )}
    </div>
  );
}
