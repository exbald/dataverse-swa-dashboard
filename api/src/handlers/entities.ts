import { getCorrelationId, errorBody } from "../correlation.js";
import { validatePrincipal } from "../auth.js";
import { createDataverseService } from "../dataverse/factory.js";
import { EntityParamSchema, PaginationQuerySchema } from "../contracts.js";
import type { ApiContext, ApiResponse } from "./health.js";

function baseHeaders(correlationId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-correlation-id": correlationId,
  };
}

export async function handleEntities(ctx: ApiContext): Promise<ApiResponse> {
  const correlationId = getCorrelationId(ctx.headers);

  const auth = validatePrincipal(ctx.headers["x-ms-client-principal"], correlationId);
  if (!auth.authenticated) {
    return {
      status: 401,
      headers: baseHeaders(correlationId),
      body: errorBody("UNAUTHORIZED", auth.error ?? "Unauthorized", correlationId),
    };
  }

  // Validate entity param
  const entityRaw = ctx.params?.entity ?? ctx.query.entity;
  const entityParsed = EntityParamSchema.safeParse(entityRaw);
  if (!entityParsed.success) {
    return {
      status: 400,
      headers: baseHeaders(correlationId),
      body: errorBody("INVALID_ENTITY", `Invalid entity: ${entityRaw}. Allowed: accounts, contacts, opportunities`, correlationId),
    };
  }

  // Validate query
  const queryParsed = PaginationQuerySchema.safeParse(ctx.query);
  if (!queryParsed.success) {
    return {
      status: 400,
      headers: baseHeaders(correlationId),
      body: errorBody("INVALID_QUERY", queryParsed.error.issues[0]?.message ?? "Invalid query", correlationId),
    };
  }

  const { pageSize, pageToken, filter, sort, q } = queryParsed.data;

  try {
    const service = createDataverseService(correlationId);
    const result = await service.listEntities(entityParsed.data, {
      pageSize,
      pageToken,
      filter,
      sort,
      q,
    });
    const ttl = parseInt(process.env.API_CACHE_TTL ?? "60", 10);
    return {
      status: 200,
      headers: {
        ...baseHeaders(correlationId),
        "Cache-Control": `private, max-age=${ttl}`,
      },
      body: result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return {
      status: 500,
      headers: baseHeaders(correlationId),
      body: errorBody("INTERNAL_ERROR", "Failed to load entities", correlationId),
    };
  }
}
