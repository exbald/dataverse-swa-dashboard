/**
 * Auth helper — validates SWA Easy Auth header `x-ms-client-principal`.
 * In mock mode, returns a stub principal so local dev doesn't need SWA auth.
 * In live/production, rejects requests without a valid principal.
 *
 * SWA injects `x-ms-client-principal` as base64-encoded JSON:
 *   { identityProvider, userId, userDetails, userRoles }
 */

export interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export interface AuthResult {
  principal: ClientPrincipal | null;
  authenticated: boolean;
  error?: string;
}

function isMockMode(): boolean {
  return (process.env.DATAVERSE_MODE ?? "mock") === "mock";
}

export function parseClientPrincipal(headerValue: string | undefined): ClientPrincipal | null {
  if (!headerValue) return null;
  try {
    const json = Buffer.from(headerValue, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as ClientPrincipal;
    if (!parsed.userId || !parsed.identityProvider) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function validatePrincipal(
  headerValue: string | undefined,
  correlationId: string
): AuthResult {
  const principal = parseClientPrincipal(headerValue);

  // Mock mode: allow unauthenticated, return stub
  if (!principal && isMockMode()) {
    return {
      authenticated: true,
      principal: {
        identityProvider: "mock",
        userId: "mock-user-id",
        userDetails: "mock@example.com",
        userRoles: ["authenticated", "admin"],
      },
    };
  }

  if (!principal) {
    return { authenticated: false, principal: null, error: "Missing or invalid client principal" };
  }

  // Optional tenant allowlist check (if ENTRA_ALLOWED_TENANT_IDS set)
  const allowed = (process.env.ENTRA_ALLOWED_TENANT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // If allowlist configured, we check identityProvider or claims — placeholder validation
  // Real tenant check would inspect tid claim inside the principal if present
  if (allowed.length > 0) {
    // Attempt to read tid from principal if it carries claims
    const maybeClaims = principal as unknown as Record<string, unknown>;
    const tid = typeof maybeClaims["tid"] === "string" ? (maybeClaims["tid"] as string) : null;
    if (tid && !allowed.includes(tid)) {
      return { authenticated: false, principal, error: `Tenant ${tid} not allowed` };
    }
  }

  return { authenticated: true, principal };
}
