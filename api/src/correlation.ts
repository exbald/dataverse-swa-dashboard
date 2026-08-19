/**
 * Correlation ID helpers — attach to every request/response + logs.
 * Never log secrets; correlationId is safe to return to client.
 */

import { randomUUID } from "node:crypto";

export function getCorrelationId(headers: Record<string, string | undefined>): string {
  const incoming =
    headers["x-correlation-id"] ??
    headers["x-request-id"] ??
    headers["request-id"];
  if (incoming && /^[a-zA-Z0-9-_]{8,64}$/.test(incoming)) return incoming;
  return randomUUID();
}

export function errorBody(code: string, message: string, correlationId: string) {
  return {
    error: { code, message, correlationId },
  };
}
