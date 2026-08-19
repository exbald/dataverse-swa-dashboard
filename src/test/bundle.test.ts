import { describe, it, expect, vi, afterEach } from "vitest";

describe("api boundary", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("throws ApiError with correlationId on 500", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "x-correlation-id": "cid-500" }),
      json: async () => ({ error: { code: "500", message: "internal", correlationId: "cid-500" } }),
    } as unknown as Response);

    const { getKpis } = await import("../lib/api");
    await expect(getKpis()).rejects.toMatchObject({
      status: 500,
      correlationId: "cid-500",
    });
  });

  it("throws 401 ApiError", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({}),
      json: async () => ({ error: { code: "401", message: "unauthorized" } }),
    } as unknown as Response);

    const { getKpis } = await import("../lib/api");
    await expect(getKpis()).rejects.toMatchObject({ status: 401 });
  });
});

describe("bundle boundary", () => {
  it("no Dataverse URL or secret token pattern in source files", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const srcDir = path.resolve(__dirname, "..");
    const forbidden = ["crm.dynamics.com", "client_secret", "clientSecret", "DATAVERSE_CLIENT_SECRET"];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
      }
      return out;
    }

    const files = walk(srcDir);
    for (const file of files) {
      if (file.includes("bundle.test.ts") || file.includes("api.test.ts")) continue;
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        expect(content, `${file} must not contain "${pattern}"`).not.toContain(pattern);
      }
    }
  });
});
