/**
 * LiveDataverseService — Dataverse Web API via MSAL confidential client.
 * Server-only: token cached, OData $select/$filter/$top/$skiptoken, retry on 429/5xx.
 * Never log secrets; never return tokens to client.
 */

import type { DataverseService, ListEntitiesOptions } from "./interface.js";
import type { EntityRecord, KpisResponse, PaginatedResponse, SupportedEntity } from "../contracts.js";

// Lazy import to avoid hard dependency in mock mode
type MsalModule = typeof import("@azure/msal-node");

interface TokenCache {
  token: string;
  expiresAt: number;
}

const ENTITY_SET_MAP: Record<SupportedEntity, string> = {
  accounts: "accounts",
  contacts: "contacts",
  opportunities: "opportunities",
};

function dataverseScope(dataverseUrl: string): string {
  const base = dataverseUrl.replace(/\/$/, "");
  return `${base}/.default`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; correlationId: string } = { correlationId: "n/a" }
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt >= maxRetries) throw err;
      const backoff = Math.min(1000 * 2 ** attempt + Math.random() * 200, 8000);
      const retryAfter = (err as { retryAfterMs?: number })?.retryAfterMs;
      await sleep(retryAfter ?? backoff);
      attempt++;
    }
  }
}

export class LiveDataverseService implements DataverseService {
  private tokenCache: TokenCache | null = null;
  private msalApp: InstanceType<MsalModule["ConfidentialClientApplication"]> | null = null;

  constructor(
    private readonly config: {
      dataverseUrl: string;
      tenantId: string;
      clientId: string;
      clientSecret: string;
      correlationId?: string;
    }
  ) {}

  private async getMsalApp(): Promise<InstanceType<MsalModule["ConfidentialClientApplication"]>> {
    if (this.msalApp) return this.msalApp;
    const msal: MsalModule = await import("@azure/msal-node");
    this.msalApp = new msal.ConfidentialClientApplication({
      auth: {
        clientId: this.config.clientId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        clientSecret: this.config.clientSecret,
      },
    });
    return this.msalApp;
  }

  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.token;
    }
    const app = await this.getMsalApp();
    const result = await app.acquireTokenByClientCredential({
      scopes: [dataverseScope(this.config.dataverseUrl)],
    });
    if (!result?.accessToken) throw new Error("Failed to acquire Dataverse token");
    this.tokenCache = {
      token: result.accessToken,
      expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600_000,
    };
    return this.tokenCache.token;
  }

  private async dataverseFetch(
    path: string,
    searchParams: URLSearchParams,
    correlationId: string
  ): Promise<Response> {
    const token = await this.getToken();
    const url = `${this.config.dataverseUrl.replace(/\/$/, "")}/api/data/v9.2/${path}?${searchParams.toString()}`;

    return withRetry(
      async () => {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-correlation-id": correlationId,
          },
        });
        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After");
          const err = Object.assign(new Error(`Dataverse 429`), {
            status: 429,
            retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
          });
          throw err;
        }
        if (!res.ok) {
          const err = Object.assign(new Error(`Dataverse ${res.status}: ${res.statusText}`), {
            status: res.status,
          });
          throw err;
        }
        return res;
      },
      { correlationId }
    );
  }

  async listEntities(
    entity: SupportedEntity,
    options: ListEntitiesOptions
  ): Promise<PaginatedResponse<EntityRecord>> {
    const entitySet = ENTITY_SET_MAP[entity];
    const params = new URLSearchParams();
    params.set("$select", "name,statuscode,ownerid,createdon,estimatedvalue");
    if (options.pageSize) params.set("$top", String(options.pageSize));
    if (options.pageToken) params.set("$skiptoken", options.pageToken);
    if (options.filter) params.set("$filter", options.filter);
    if (options.sort) {
      // sort like "name asc" -> "$orderby=name asc"
      params.set("$orderby", options.sort);
    }
    if (options.q) {
      // OData search via $filter contains — placeholder
      params.set("$filter", `contains(name,'${options.q.replace(/'/g, "''")}')`);
    }

    const correlationId = this.config.correlationId ?? "live-list";
    const res = await this.dataverseFetch(entitySet, params, correlationId);
    const body = (await res.json()) as {
      value: unknown[];
      "@odata.nextLink"?: string;
      "@odata.count"?: number;
    };

    // Map Dataverse fields to EntityRecord placeholder shape
    const data: EntityRecord[] = (body.value as Record<string, unknown>[]).map((row) => ({
      id: String(row[`${entitySet.slice(0, -1)}id`] ?? row["id"] ?? ""),
      name: String(row["name"] ?? ""),
      status: String(row["statuscode"] ?? row["status"] ?? ""),
      owner: String((row["ownerid"] as Record<string, unknown> | undefined)?.["name"] ?? row["owner"] ?? ""),
      createdOn: String(row["createdon"] ?? row["createdOn"] ?? new Date().toISOString()),
      amount: row["estimatedvalue"] != null ? Number(row["estimatedvalue"]) : undefined,
    }));

    let nextPageToken: string | undefined;
    if (body["@odata.nextLink"]) {
      try {
        const nextUrl = new URL(body["@odata.nextLink"]);
        nextPageToken = nextUrl.searchParams.get("$skiptoken") ?? undefined;
      } catch {
        nextPageToken = undefined;
      }
    }

    return { data, nextPageToken, totalCount: body["@odata.count"] };
  }

  async getKpis(): Promise<KpisResponse> {
    // Aggregate via Dataverse queries — simplified; real impl would use FetchXML or OData aggregates
    const correlationId = this.config.correlationId ?? "live-kpis";
    const counts = await Promise.all(
      (Object.keys(ENTITY_SET_MAP) as SupportedEntity[]).map(async (entity) => {
        const entitySet = ENTITY_SET_MAP[entity];
        const params = new URLSearchParams({ $top: "1", $count: "true" });
        const res = await this.dataverseFetch(entitySet, params, correlationId);
        const body = (await res.json()) as { "@odata.count"?: number; value: unknown[] };
        return { entity, count: body["@odata.count"] ?? body.value.length };
      })
    );

    const kpis = counts.map((c) => ({
      id: `total-${c.entity}`,
      label: `Total ${c.entity}`,
      value: c.count,
      trend: "flat" as const,
    }));

    return { kpis, generatedAt: new Date().toISOString() };
  }
}
