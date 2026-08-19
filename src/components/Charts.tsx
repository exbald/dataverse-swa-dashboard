import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Cell,
} from "recharts";
import type { ChartData } from "../lib/types";

const STATUS_COLORS: Record<string, string> = {
  active: "#067647",
  pending: "#B54708",
  inactive: "#667085",
  draft: "#175CD3",
};

type Props = {
  data: ChartData | null;
  loading: boolean;
  error: Error | null;
  onRetry?: () => void;
};

export function Charts({ data, loading, error, onRetry }: Props) {
  if (loading && !data) {
    return (
      <div className="chart-section" aria-busy="true" aria-label="Charts loading">
        <div className="card">
          <div className="card__header">
            <span className="card__title">Status breakdown</span>
          </div>
          <div className="card__body">
            <div className="skeleton" style={{ height: 220 }} />
          </div>
        </div>
        <div className="card">
          <div className="card__header">
            <span className="card__title">Trend</span>
          </div>
          <div className="card__body">
            <div className="skeleton" style={{ height: 220 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="chart-section">
        <div className="card" role="alert">
          <div className="card__header">
            <span className="card__title">Status breakdown</span>
          </div>
          <div className="card__body">
            <div className="error-state">
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
        </div>
      </div>
    );
  }

  if (!data || (data.breakdown.length === 0 && data.trend.length === 0)) {
    return (
      <div className="chart-section">
        <div className="card">
          <div className="card__header">
            <span className="card__title">Status breakdown</span>
          </div>
          <div className="card__body">
            <div className="empty-state" style={{ padding: "24px" }}>
              <p className="empty-state__desc">No chart data — adjust filters.</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card__header">
            <span className="card__title">Trend</span>
          </div>
          <div className="card__body">
            <div className="empty-state" style={{ padding: "24px" }}>
              <p className="empty-state__desc">No trend data.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-section">
      <div className="card">
        <div className="card__header">
          <span className="card__title">Status breakdown</span>
        </div>
        <div className="card__body" role="img" aria-label="Status breakdown chart">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.breakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EB" />
              <XAxis dataKey="status" tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #E6E8EB", fontSize: 12 }}
                cursor={{ fill: "#F8F9FB" }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.breakdown.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#3358FF"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="card__title">Trend (last 14 days)</span>
        </div>
        <div className="card__body" role="img" aria-label="Trend chart">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#667085" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E6E8EB", fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#3358FF" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
