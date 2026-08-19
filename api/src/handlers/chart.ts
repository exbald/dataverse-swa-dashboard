import { getCorrelationId, errorBody } from "../correlation.js";
import { validatePrincipal } from "../auth.js";
import { createDataverseService } from "../dataverse/factory.js";
import type { ApiContext, ApiResponse } from "./health.js";

function baseHeaders(correlationId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-correlation-id": correlationId,
  };
}

export async function handleChart(ctx: ApiContext): Promise<ApiResponse> {
  const correlationId = getCorrelationId(ctx.headers);
  const auth = validatePrincipal(ctx.headers["x-ms-client-principal"], correlationId);
  if (!auth.authenticated) {
    return {
      status: 401,
      headers: baseHeaders(correlationId),
      body: errorBody("UNAUTHORIZED", auth.error ?? "Unauthorized", correlationId),
    };
  }
  try {
    const service = createDataverseService(correlationId);
    const entity = (ctx.query.entity as string) || "accounts";
    const result = await service.getChartData(entity);
    const ttl = parseInt(process.env.API_CACHE_TTL ?? "60", 10);
    return {
      status: 200,
      headers: { ...baseHeaders(correlationId), "Cache-Control": `private, max-age=${ttl}` },
      body: result,
    };
  } catch (err: unknown) {
    return {
      status: 500,
      headers: baseHeaders(correlationId),
      body: errorBody("INTERNAL_ERROR", "Failed to load chart data", correlationId),
    };
  }
}
