import type { RecordItem } from "../lib/types";

type SortField = "name" | "status" | "owner" | "createdOn" | "amount";
type SortDir = "asc" | "desc";

type Props = {
  rows: RecordItem[];
  totalCount?: number;
  loading: boolean;
  error: Error | null;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  onRetry?: () => void;
  onRowClick?: (row: RecordItem) => void;
  sortField?: SortField;
  sortDir?: SortDir;
  onSort?: (field: SortField) => void;
  pageSize: number;
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "badge--active"
      : status === "pending"
        ? "badge--pending"
        : status === "draft"
          ? "badge--draft"
          : "badge--inactive";
  return <span className={`badge ${cls}`}>{status}</span>;
}

function SortIndicator({ active, dir }: { active: boolean; dir?: SortDir }) {
  if (!active) return <span aria-hidden="true" style={{ opacity: 0.3 }} />;
  return <span aria-hidden="true">{dir === "asc" ? " ↑" : " ↓"}</span>;
}

export function DataTable({
  rows,
  totalCount,
  loading,
  error,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  onRetry,
  onRowClick,
  sortField,
  sortDir,
  onSort,
  pageSize,
}: Props) {
  if (loading && rows.length === 0) {
    return (
      <div className="card" aria-busy="true" aria-label="Loading records">
        <div className="card__header">
          <span className="card__title">Records</span>
        </div>
        <div className="card__body">
          <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 16 }} />
        </div>
      </div>
    );
  }

  if (error && rows.length === 0) {
    const isAuth = (error as { status?: number }).status === 401 || (error as { status?: number }).status === 403;
    if (isAuth) {
      const is401 = (error as { status?: number }).status === 401;
      return (
        <div className="card" role="alert">
          <div className="auth-state">
            <p className="auth-state__title">{is401 ? "Sign in required" : "Not authorized"}</p>
            <p className="auth-state__desc">
              {is401 ? "Please sign in to view records." : "You don't have permission to view this data."}
            </p>
            {is401 && (
              <a className="btn btn--primary btn--sm" href="/.auth/login/aad">
                Sign in
              </a>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="card" role="alert">
        <div className="error-state">
          <p className="error-state__title">Couldn&apos;t load records</p>
          <p className="error-state__desc">{error.message}</p>
          {(error as { correlationId?: string }).correlationId && (
            <span className="error-state__meta">
              Correlation ID: {(error as { correlationId?: string }).correlationId}
            </span>
          )}
          {onRetry && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <div className="card">
        <div className="card__header">
          <span className="card__title">Records</span>
        </div>
        <div className="empty-state">
          <p className="empty-state__title">No records — adjust filters</p>
          <p className="empty-state__desc">Try changing your search, status, owner, or date range.</p>
          {onRetry && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
              Clear filters
            </button>
          )}
        </div>
      </div>
    );
  }

  const columns: { key: SortField; label: string; sortable: boolean }[] = [
    { key: "name", label: "Name", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "owner", label: "Owner", sortable: true },
    { key: "createdOn", label: "Created", sortable: true },
    { key: "amount", label: "Amount", sortable: true },
  ];

  return (
    <div className="card">
      <div className="card__header">
        <span className="card__title">Records</span>
        {typeof totalCount === "number" && (
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{totalCount.toLocaleString()} total</span>
        )}
      </div>

      <div className="table-wrap">
        <table className="table" role="table" aria-label="Records table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  aria-sort={
                    sortField === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                  }
                  onClick={() => col.sortable && onSort?.(col.key)}
                  tabIndex={col.sortable ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (col.sortable && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSort?.(col.key);
                    }
                  }}
                  role={col.sortable ? "button" : undefined}
                >
                  {col.label}
                  {col.sortable && <SortIndicator active={sortField === col.key} dir={sortDir} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick?.(row);
                  }
                }}
                aria-label={`View details for ${row.name}`}
              >
                <td style={{ fontWeight: 550, color: "var(--text)" }}>{row.name}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>{row.owner}</td>
                <td>{new Date(row.createdOn).toLocaleDateString()}</td>
                <td>{typeof row.amount === "number" ? `$${row.amount.toLocaleString()}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="pagination__info" aria-live="polite">
          {rows.length} of {totalCount ?? "?"} · {pageSize} per page
          {loading && " · Loading…"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn--secondary btn--sm" disabled={!hasPrev || loading} onClick={onPrev}>
            Previous
          </button>
          <button type="button" className="btn btn--secondary btn--sm" disabled={!hasNext || loading} onClick={onNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
