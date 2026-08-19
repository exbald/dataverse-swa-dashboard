import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { KpiGrid } from "./components/KpiGrid";
import { FilterBar, type FilterState } from "./components/FilterBar";
import { Charts } from "./components/Charts";
import { DataTable } from "./components/DataTable";
import { DetailDrawer } from "./components/DetailDrawer";
import { usePolling } from "./lib/usePolling";
import { getKpis, getEntities, getChartData } from "./lib/api";
import type { RecordItem } from "./lib/types";

const POLL_INTERVAL = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 60000);
const PAGE_SIZE = 25;

type SortField = "name" | "status" | "owner" | "createdOn" | "amount";

export default function App() {
  // Auth stub: check /.auth/me if available
  const [authStatus, setAuthStatus] = useState<"authenticated" | "anonymous" | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/.auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const principal = data?.clientPrincipal;
        setAuthStatus(principal ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (!cancelled) setAuthStatus("anonymous");
      });
    // Fallback timeout for environments without SWA auth
    const t = window.setTimeout(() => {
      if (!cancelled) setAuthStatus((s) => (s === "loading" ? "anonymous" : s));
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    status: "",
    owner: "",
    dateFrom: "",
    dateTo: "",
  });

  // Debounced search for API
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(filters.q), 350);
    return () => window.clearTimeout(id);
  }, [filters.q]);

  // Sorting
  const [sortField, setSortField] = useState<SortField | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // Pagination with skiptoken stack
  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const currentToken = pageTokens[pageIndex] ?? null;

  // Reset pagination when filters/sort change
  useEffect(() => {
    setPageTokens([null]);
    setPageIndex(0);
  }, [debouncedQ, filters.status, filters.owner, filters.dateFrom, filters.dateTo, sortField, sortDir]);

  // Selected record for drawer
  const [selected, setSelected] = useState<RecordItem | null>(null);

  // KPI polling
  const kpiFetcher = useCallback(() => getKpis(), []);
  const kpisPolling = usePolling(kpiFetcher, { intervalMs: POLL_INTERVAL, enabled: true });

  // Chart polling
  const chartFetcher = useCallback(() => getChartData(), []);
  const chartPolling = usePolling(chartFetcher, { intervalMs: POLL_INTERVAL, enabled: true });

  // Entity list — needs to re-fetch when deps change
  // We use a key-based fetcher: create fetcher that captures current query
  const entityQuery = useMemo(
    () => ({
      pageSize: PAGE_SIZE,
      pageToken: currentToken ?? undefined,
      q: debouncedQ || undefined,
      status: filters.status || undefined,
      owner: filters.owner || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      sortField: sortField || undefined,
      sortDir: sortDir || undefined,
    }),
    [currentToken, debouncedQ, filters.status, filters.owner, filters.dateFrom, filters.dateTo, sortField, sortDir],
  );

  const entityFetcher = useCallback(() => getEntities(entityQuery), [entityQuery]);
  const entitiesPolling = usePolling(entityFetcher, { intervalMs: POLL_INTERVAL, enabled: true });

  // Handle next page token from response
  const nextPageToken = entitiesPolling.data?.nextPageToken ?? null;
  const hasNext = Boolean(nextPageToken);
  const hasPrev = pageIndex > 0;

  function handleNext() {
    if (!nextPageToken) return;
    setPageTokens((prev) => {
      // If we already have token at next index, just advance
      if (prev[pageIndex + 1] === nextPageToken) return prev;
      // If next slot doesn't exist, append
      if (pageIndex + 1 >= prev.length) return [...prev, nextPageToken];
      // Otherwise update
      const next = [...prev];
      next[pageIndex + 1] = nextPageToken;
      return next.slice(0, pageIndex + 2);
    });
    setPageIndex((i) => i + 1);
  }

  function handlePrev() {
    setPageIndex((i) => Math.max(0, i - 1));
  }

  function handleRefresh() {
    kpisPolling.refresh();
    chartPolling.refresh();
    entitiesPolling.refresh();
  }

  function handleClearFilters() {
    setFilters({ q: "", status: "", owner: "", dateFrom: "", dateTo: "" });
  }

  const isValidating = kpisPolling.isValidating || chartPolling.isValidating || entitiesPolling.isValidating;

  return (
    <div className="app-shell">
      <div
        className="preview-banner"
        role="status"
        aria-label="Preview — mock data"
      >
        Preview &middot; mock data &mdash; not production &mdash; temporary isolated deployment &middot;{" "}
        <span className="preview-banner__mode">DATAVERSE_MODE=mock</span>
      </div>
      <Header authStatus={authStatus} />

      <main className="main">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="toolbar__left">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleRefresh}
              disabled={isValidating}
              aria-label="Refresh data"
            >
              {isValidating ? "Refreshing…" : "↻ Refresh"}
            </button>
            {isValidating && <span className="dot-pulse" aria-hidden="true" />}
          </div>
          <div className="toolbar__right" aria-live="polite">
            {kpisPolling.data?.updatedAt && (
              <span>Updated {new Date(kpisPolling.data.updatedAt).toLocaleTimeString()}</span>
            )}
            {isValidating && <span>Syncing…</span>}
          </div>
        </div>

        <KpiGrid
          kpis={kpisPolling.data?.kpis ?? null}
          loading={kpisPolling.isLoading}
          error={kpisPolling.error}
          onRetry={kpisPolling.refresh}
        />

        <FilterBar
          value={filters}
          onChange={setFilters}
          onReset={handleClearFilters}
        />

        <Charts data={chartPolling.data} loading={chartPolling.isLoading} error={chartPolling.error} onRetry={chartPolling.refresh} />

        <DataTable
          rows={entitiesPolling.data?.data ?? []}
          totalCount={entitiesPolling.data?.totalCount}
          loading={entitiesPolling.isLoading || entitiesPolling.isValidating}
          error={entitiesPolling.error}
          hasNext={hasNext}
          hasPrev={hasPrev}
          onNext={handleNext}
          onPrev={handlePrev}
          onRetry={entitiesPolling.error ? entitiesPolling.refresh : handleClearFilters}
          onRowClick={setSelected}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          pageSize={PAGE_SIZE}
        />
      </main>

      <DetailDrawer record={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
