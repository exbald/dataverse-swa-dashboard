import {
  KpisResponseSchema,
  PaginatedResponseSchema,
  ChartDataSchema,
  type KpisResponse,
  type PaginatedResponse,
  type ChartData,
  type EntityQuery,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "/api";

export class ApiError extends Error {
  status: number;
  correlationId?: string;
  code?: string;

  constructor(message: string, status: number, correlationId?: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.correlationId = correlationId;
    this.code = code;
  }
}

function buildUrl(path: string, params?: Record<string, string | number | undefined | null>): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  // Return path+search only (same-origin)
  return `${url.pathname}${url.search}`;
}

async function fetchJson<T>(url: string, schema?: { parse: (d: unknown) => T }): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });

  const correlationId = res.headers.get("x-correlation-id") ?? res.headers.get("x-request-id") ?? undefined;

  if (res.status === 401 || res.status === 403) {
    throw new ApiError(
      res.status === 401 ? "Not authenticated" : "Not authorized",
      res.status,
      correlationId,
      String(res.status),
    );
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText;
    const code =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: { code?: string } }).error?.code ?? res.status)
        : String(res.status);
    const cid =
      (body as { error?: { correlationId?: string } })?.error?.correlationId ?? correlationId;
    throw new ApiError(msg, res.status, cid, code);
  }

  const data = (await res.json()) as unknown;
  if (schema) {
    try {
      return schema.parse(data);
    } catch (e) {
      throw new ApiError(
        e instanceof Error ? e.message : "Invalid response shape",
        res.status,
        correlationId,
        "PARSE_ERROR",
      );
    }
  }
  return data as T;
}

export function getKpis(signal?: AbortSignal): Promise<KpisResponse> {
  void signal;
  return fetchJson(buildUrl("/kpis"), KpisResponseSchema);
}

export function getEntities(query: EntityQuery, signal?: AbortSignal): Promise<PaginatedResponse> {
  void signal;
  const entity = query.entity || "accounts";
  const params: Record<string, string | number | undefined | null> = {
    pageSize: query.pageSize ?? 25,
    pageToken: query.pageToken ?? undefined,
    q: query.q || undefined,
    status: query.status || undefined,
    owner: query.owner || undefined,
    dateFrom: query.dateFrom || undefined,
    dateTo: query.dateTo || undefined,
    sortField: query.sortField || undefined,
    sortDir: query.sortDir || undefined,
  };
  return fetchJson(buildUrl(`/entities/${encodeURIComponent(entity)}`, params), PaginatedResponseSchema);
}

export function getChartData(entity?: string, signal?: AbortSignal): Promise<ChartData> {
  void signal;
  const params: Record<string, string | undefined> = {};
  if (entity) params.entity = entity;
  return fetchJson(buildUrl("/chart", params), ChartDataSchema);
}

export async function getHealth(): Promise<{ status: string }> {
  return fetchJson(buildUrl("/health"));
}

export { API_BASE };
