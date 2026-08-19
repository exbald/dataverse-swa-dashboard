import { describe, it, expect, beforeEach } from "vitest";
import { MockDataverseService } from "./mock.js";

describe("MockDataverseService", () => {
  let svc: MockDataverseService;
  beforeEach(() => { svc = new MockDataverseService(); });

  it("lists accounts with default pagination", async () => {
    const res = await svc.listEntities("accounts", {});
    expect(res.data.length).toBe(25);
    expect(res.nextPageToken).toBe("25");
    expect(res.totalCount).toBe(50);
  });

  it("paginates with pageToken", async () => {
    const p1 = await svc.listEntities("accounts", { pageSize: 10 });
    expect(p1.data[0]!.id).toBe("accounts-0001");
    const p2 = await svc.listEntities("accounts", { pageSize: 10, pageToken: p1.nextPageToken });
    expect(p2.data[0]!.id).toBe("accounts-0011");
  });

  it("last page has no nextPageToken", async () => {
    const res = await svc.listEntities("contacts", { pageSize: 100 });
    expect(res.nextPageToken).toBeUndefined();
  });

  it("filters by q (search)", async () => {
    const res = await svc.listEntities("accounts", { q: "accounts 1" });
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every(r => r.name.toLowerCase().includes("accounts 1"))).toBe(true);
  });

  it("filters by filter eq", async () => {
    const res = await svc.listEntities("accounts", { filter: "status eq 'active'" });
    expect(res.data.every(r => r.status === "active")).toBe(true);
  });

  it("sorts desc", async () => {
    const res = await svc.listEntities("accounts", { sort: "name desc", pageSize: 5 });
    const names = res.data.map(r => r.name);
    const sorted = [...names].sort((a, b) => b.localeCompare(a));
    expect(names).toEqual(sorted);
  });

  it("getKpis returns deterministic cards", async () => {
    const res = await svc.getKpis();
    expect(res.kpis.length).toBeGreaterThan(0);
    expect(res.kpis.find(k => k.id === "total-accounts")?.value).toBe(50);
    expect(res.generatedAt).toBeTruthy();
  });

  it("is deterministic across instances", async () => {
    const a = await new MockDataverseService().listEntities("opportunities", { pageSize: 5 });
    const b = await new MockDataverseService().listEntities("opportunities", { pageSize: 5 });
    expect(a.data).toEqual(b.data);
  });
});
