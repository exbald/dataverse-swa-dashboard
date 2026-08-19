import { getCorrelationId, errorBody } from "../correlation.js";
import { getEnv } from "../env.js";

export interface ApiContext {
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  params?: Record<string, string | undefined>;
  method: string;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

function baseHeaders(correlationId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-correlation-id": correlationId,
    "Cache-Control": "no-store",
  };
}

export function handleHealth(ctx: ApiContext): ApiResponse {
  const correlationId = getCorrelationId(ctx.headers);
  const env = getEnv();
  const body = {
    status: "ok" as const,
    version: "0.1.0",
    mode: env.DATAVERSE_MODE,
    timestamp: new Date().toISOString(),
  };
  return {
    status: 200,
    headers: { ...baseHeaders(correlationId), "Cache-Control": "no-cache" },
    body,
  };
}
