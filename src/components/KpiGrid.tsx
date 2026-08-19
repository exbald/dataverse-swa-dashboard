import type { Kpi } from "../lib/types";

type Props = {
  kpis: Kpi[] | null;
  loading: boolean;
  error: Error | null;
  onRetry?: () => void;
};

function formatValue(v: number | string): string {
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function KpiGrid({ kpis, loading, error, onRetry }: Props) {
  if (loading && !kpis) {
    return (
      <div className="kpi-grid" aria-label="Key metrics" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton skeleton--kpi" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (error && !kpis) {
    return (
      <div className="card" role="alert">
        <div className="error-state">
          <p className="error-state__title">Couldn&apos;t load KPIs</p>
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

  if (!kpis || kpis.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <p className="empty-state__title">No metrics available</p>
          <p className="empty-state__desc">Metrics will appear once data is available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-grid" aria-label="Key metrics">
      {kpis.map((kpi) => (
        <div key={kpi.id} className="kpi-card">
          <span className="kpi-card__label">{kpi.label}</span>
          <span className="kpi-card__value">{formatValue(kpi.value)}</span>
          {typeof kpi.delta === "number" && (
            <span
              className={`kpi-card__delta kpi-card__delta--${kpi.trend ?? "neutral"}`}
              aria-label={kpi.deltaLabel ?? undefined}
            >
              {kpi.trend === "up" ? "↑" : kpi.trend === "down" ? "↓" : "—"} {Math.abs(kpi.delta)}%
              {kpi.deltaLabel ? ` ${kpi.deltaLabel}` : ""}
            </span>
          )}
          {kpi.deltaLabel && typeof kpi.delta !== "number" && (
            <span className="kpi-card__foot">{kpi.deltaLabel}</span>
          )}
        </div>
      ))}
    </div>
  );
}
