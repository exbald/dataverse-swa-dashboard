import { describe, it, expect } from "vitest";
import { handleHealth } from "./health.js";
import { handleKpis } from "./kpis.js";
import { handleEntities } from "./entities.js";

describe("handleHealth", () => {
  it("returns 200 with mode and correlation", () => {
    process.env.DATAVERSE_MODE = "mock";
    const res = handleHealth({ headers: {}, query: {}, method: "GET" });
    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).status).toBe("ok");
    expect(res.headers["x-correlation-id"]).toBeTruthy();
  });
});

describe("handleKpis", () => {
  it("returns kpis in mock mode", async () => {
    process.env.DATAVERSE_MODE = "mock";
    const res = await handleKpis({ headers: {}, query: {}, method: "GET" });
    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown[]>).kpis).toBeDefined;
    const body = res.body as { kpis: unknown[] };
    expect(body.kpis.length).toBeGreaterThan(0);
  });
});

describe("handleEntities", () => {
  it("400 on invalid entity", async () => {
    process.env.DATAVERSE_MODE = "mock";
    const res = await handleEntities({ headers: {}, query: {}, params: { entity: "invoices" }, method: "GET" });
    expect(res.status).toBe(400);
  });
  it("400 on invalid pageSize", async () => {
    process.env.DATAVERSE_MODE = "mock";
    const res = await handleEntities({ headers: {}, query: { pageSize: "999" }, params: { entity: "accounts" }, method: "GET" });
    expect(res.status).toBe(400);
  });
  it("200 on valid request with pagination shape", async () => {
    process.env.DATAVERSE_MODE = "mock";
    const res = await handleEntities({ headers: {}, query: { pageSize: "5" }, params: { entity: "accounts" }, method: "GET" });
    expect(res.status).toBe(200);
    const body = res.body as { data: unknown[]; nextPageToken?: string; totalCount?: number };
    expect(body.data.length).toBe(5);
    expect(body.totalCount).toBe(50);
    expect(body.nextPageToken).toBe("5");
  });
  it("search + filter + sort work", async () => {
    process.env.DATAVERSE_MODE = "mock";
    const res = await handleEntities({
      headers: {},
      query: { q: "alice", sort: "name asc", pageSize: "10" },
      params: { entity: "contacts" },
      method: "GET",
    });
    expect(res.status).toBe(200);
  });
  it("error shape has correlationId", async () => {
    process.env.DATAVERSE_MODE = "mock";
    const res = await handleEntities({ headers: {}, query: {}, params: { entity: "bad" }, method: "GET" });
    const body = res.body as { error: { code: string; correlationId: string } };
    expect(body.error.correlationId).toBeTruthy();
  });
});
