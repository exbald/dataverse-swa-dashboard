import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDataverseService } from "./factory.js";
import { MockDataverseService } from "./mock.js";

describe("createDataverseService factory", () => {
  const origEnv = process.env.DATAVERSE_MODE;

  afterEach(() => {
    process.env.DATAVERSE_MODE = origEnv;
    vi.restoreAllMocks();
  });

  it("returns Mock in mock mode (default)", () => {
    process.env.DATAVERSE_MODE = "mock";
    const svc = createDataverseService("cid");
    expect(svc).toBeInstanceOf(MockDataverseService);
  });

  it("returns Mock when DATAVERSE_MODE unset", () => {
    delete process.env.DATAVERSE_MODE;
    const svc = createDataverseService("cid");
    expect(svc).toBeInstanceOf(MockDataverseService);
  });

  it("throws if live mode missing env", async () => {
    process.env.DATAVERSE_MODE = "live";
    delete process.env.DATAVERSE_URL;
    delete process.env.DATAVERSE_TENANT_ID;
    expect(() => createDataverseService("cid")).toThrow(/Live mode requires env/);
  });
});
