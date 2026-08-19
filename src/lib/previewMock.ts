/**
 * PreviewMock — client-side mock for isolated temporary previews (surge, etc.)
 * where no real /api server exists. Intercepts fetch("/api/*") and returns
 * deterministic mock data matching the typed contracts.
 *
 * Enabled only when VITE_PREVIEW_MOCK === "1" | "true".
 * Never active in Azure SWA production (where real /api exists).
 */

export function isPreviewMockEnabled(): boolean {
  const v = (import.meta as unknown as { env: Record<string, string | undefined> }).env?.VITE_PREVIEW_MOCK;
  return v === "1" || v === "true";
}

type PreviewMockOpts = { delayMs?: number };

// Deterministic fixtures — mirror api/src/dataverse/mock.ts without importing server code
function seededRecords(entity: string, count: number) {
  const statuses = ["active", "inactive", "pending", "won", "lost"];
  const owners = ["alice@example.com", "bob@example.com", "carol@example.com"];
  return Array.from({ length: count }, (_, i) => ({
    id: `${entity}-${String(i + 1).padStart(4, "0")}`,
    name: `${entity} ${i + 1}`,
    status: statuses[i % statuses.length]!,
    owner: owners[i % owners.length]!,
    createdOn: new Date(Date.UTC(2025, 0, 1 + (i % 28), 10, 0, 0)).toISOString(),
    amount: entity === "opportunities" ? 1000 * (i + 1) + (i % 3) * 500 : undefined,
  }));
}

const FIXTURES: Record<string, ReturnType<typeof seededRecords>> = {
  accounts: seededRecords("accounts", 50),
  contacts: seededRecords("contacts", 42),
  opportunities: seededRecords("opportunities", 36),
};

function paginate(records: ReturnType<typeof seededRecords>, pageSize: number, pageToken?: string) {
  const offset = pageToken ? parseInt(pageToken, 10) || 0 : 0;
  const slice = records.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  return {
    data: slice,
    nextPageToken: nextOffset < records.length ? String(nextOffset) : undefined,
    totalCount: records.length,
  };
}

function buildKpis() {
  const totalAccounts = FIXTURES.accounts.length;
  const totalContacts = FIXTURES.contacts.length;
  const totalOpportunities = FIXTURES.opportunities.length;
  const totalAmount = FIXTURES.opportunities.reduce((s, r) => s + (r.amount ?? 0), 0);
  const activeCount = FIXTURES.accounts.filter((r) => r.status === "active").length;
  return {
    kpis: [
      { id: "total-accounts", label: "Total Accounts", value: totalAccounts, trend: "up" as const, delta: 4 },
      { id: "total-contacts", label: "Total Contacts", value: totalContacts, trend: "up" as const, delta: 2 },
      { id: "total-opportunities", label: "Opportunities", value: totalOpportunities, trend: "neutral" as const },
      { id: "total-amount", label: "Pipeline Value", value: totalAmount, trend: "up" as const, delta: 12 },
      { id: "active-accounts", label: "Active Accounts", value: activeCount, trend: "up" as const, delta: 1 },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function buildChart(entity?: string) {
  const key = (entity && FIXTURES[entity] ? entity : "accounts") as keyof typeof FIXTURES;
  const records = FIXTURES[key] ?? FIXTURES.accounts;
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const breakdown = [...counts.entries()].map(([status, count]) => ({ status, count }));
  const trendMap = new Map<string, number>();
  for (const r of records) trendMap.set(r.createdOn.slice(0, 10), (trendMap.get(r.createdOn.slice(0, 10)) ?? 0) + 1);
  const trend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({ date, count }));
  return { breakdown, trend };
}

function handleEntities(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api","entities","accounts"] or ["api","entities"]
  const entity = parts[2] ?? url.searchParams.get("entity") ?? "accounts";
  let records = [...(FIXTURES[entity] ?? FIXTURES.accounts)];

  const q = url.searchParams.get("q");
  if (q) {
    const qq = q.toLowerCase();
    records = records.filter((r) => r.name.toLowerCase().includes(qq) || r.status.toLowerCase().includes(qq) || r.owner.toLowerCase().includes(qq));
  }
  const status = url.searchParams.get("status");
  if (status) records = records.filter((r) => r.status === status);
  const owner = url.searchParams.get("owner");
  if (owner) records = records.filter((r) => r.owner === owner);

  const sf = url.searchParams.get("sortField");
  const sd = url.searchParams.get("sortDir") ?? "asc";
  if (sf) {
    const f = sf as keyof (typeof records)[number];
    records.sort((a, b) => {
      const av = (a[f] ?? "") as string | number;
      const bv = (b[f] ?? "") as string | number;
      const cmp = String(av).localeCompare(String(bv));
      return sd === "desc" ? -cmp : cmp;
    });
  }

  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "25", 10) || 25;
  const pageToken = url.searchParams.get("pageToken") ?? undefined;
  return paginate(records, pageSize, pageToken);
}

function jsonResponse(body: unknown, status = 200, correlationId = "preview-mock"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "x-correlation-id": correlationId },
  });
}

export function installPreviewMock(opts: PreviewMockOpts = {}): void {
  if (!isPreviewMockEnabled()) return;
  const delayMs = opts.delayMs ?? 200;
  const originalFetch = window.fetch.bind(window);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  window.fetch = async (input: any, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    let url: URL;
    try {
      url = new URL(urlStr, window.location.origin);
    } catch {
      return originalFetch(input, init);
    }

    const isApi = url.pathname.startsWith("/api/");
    const isAuth = url.pathname.startsWith("/.auth/");
    if (!isApi && !isAuth) return originalFetch(input, init);

    // Small delay so skeletons/loading states are visible
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));

    const correlationId = `preview-${Date.now().toString(36)}`;

    if (isAuth) {
      // Preview has no real auth — return anonymous; app will show "Not signed in"
      if (url.pathname === "/.auth/me") return jsonResponse({ clientPrincipal: null }, 200, correlationId);
      return jsonResponse({ error: { code: "NOT_FOUND", message: "Preview auth stub", correlationId } }, 404, correlationId);
    }

    const path = url.pathname.replace(/^\/api\/?/, "");
    if (path === "health") return jsonResponse({ status: "ok", version: "0.1.0-preview", mode: "mock", timestamp: new Date().toISOString(), correlationId }, 200, correlationId);
    if (path === "kpis") return jsonResponse(buildKpis(), 200, correlationId);
    if (path === "chart") return jsonResponse(buildChart(url.searchParams.get("entity") ?? undefined), 200, correlationId);
    if (path.startsWith("entities")) return jsonResponse(handleEntities(url), 200, correlationId);

    return jsonResponse({ error: { code: "NOT_FOUND", message: "Preview mock: not found", correlationId } }, 404, correlationId);
  };

  // eslint-disable-next-line no-console
  console.info("[preview-mock] enabled (VITE_PREVIEW_MOCK=1) — /api/* intercepted with mock data");
}
