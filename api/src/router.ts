/**
 * Minimal router for local dev / tests. In SWA, each function is auto-routed
 * via function.json; this router lets us test without Azure Functions runtime.
 */
import { handleHealth } from "./handlers/health.js";
import { handleKpis } from "./handlers/kpis.js";
import { handleEntities } from "./handlers/entities.js";
import type { ApiContext, ApiResponse } from "./handlers/health.js";

export async function routeRequest(ctx: ApiContext): Promise<ApiResponse> {
  const path = ctx.params?.route ?? "";
  // Health is public-ish (still requires correlation, but no strict auth in mock)
  // For simplicity, health does not enforce auth; kpis/entities do.
  if (ctx.method === "GET" && (path === "health" || path === "/health")) {
    return handleHealth(ctx);
  }
  if (ctx.method === "GET" && (path === "kpis" || path === "/kpis")) {
    return handleKpis(ctx);
  }
  if (ctx.method === "GET" && path.startsWith("entities/")) {
    const entity = path.split("/")[1];
    return handleEntities({ ...ctx, params: { entity: entity ?? "" } });
  }
  // Fallback: try entity from params
  if (ctx.method === "GET" && ctx.params?.entity) {
    return handleEntities(ctx);
  }
  return {
    status: 404,
    headers: { "Content-Type": "application/json", "x-correlation-id": ctx.headers["x-correlation-id"] ?? "n/a" },
    body: { error: { code: "NOT_FOUND", message: "Not found", correlationId: ctx.headers["x-correlation-id"] ?? "n/a" } },
  };
}
