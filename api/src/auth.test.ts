import { describe, it, expect } from "vitest";
import { parseClientPrincipal, validatePrincipal } from "./auth.js";

function encodePrincipal(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

describe("parseClientPrincipal", () => {
  it("returns null for undefined", () => {
    expect(parseClientPrincipal(undefined)).toBeNull();
  });
  it("returns null for invalid base64", () => {
    expect(parseClientPrincipal("not-base64!!!")).toBeNull();
  });
  it("parses valid principal", () => {
    const p = { identityProvider: "aad", userId: "u1", userDetails: "a@b.com", userRoles: ["authenticated"] };
    expect(parseClientPrincipal(encodePrincipal(p))).toEqual(p);
  });
});

describe("validatePrincipal", () => {
  it("in mock mode returns stub when no header", () => {
    process.env.DATAVERSE_MODE = "mock";
    const res = validatePrincipal(undefined, "cid");
    expect(res.authenticated).toBe(true);
    expect(res.principal?.identityProvider).toBe("mock");
  });

  it("in live mode rejects missing header", () => {
    process.env.DATAVERSE_MODE = "live";
    const res = validatePrincipal(undefined, "cid");
    expect(res.authenticated).toBe(false);
    process.env.DATAVERSE_MODE = "mock";
  });

  it("validates live principal", () => {
    process.env.DATAVERSE_MODE = "live";
    const p = { identityProvider: "aad", userId: "u1", userDetails: "a@b.com", userRoles: ["authenticated"] };
    const res = validatePrincipal(encodePrincipal(p), "cid");
    expect(res.authenticated).toBe(true);
    process.env.DATAVERSE_MODE = "mock";
  });
});
