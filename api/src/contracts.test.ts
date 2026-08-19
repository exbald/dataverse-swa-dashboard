import { describe, it, expect } from "vitest";
import { PaginationQuerySchema, EntityParamSchema } from "./contracts.js";

describe("PaginationQuerySchema", () => {
  it("defaults pageSize to 25", () => {
    expect(PaginationQuerySchema.parse({}).pageSize).toBe(25);
  });
  it("rejects pageSize 0", () => {
    expect(PaginationQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
  });
  it("rejects pageSize >100", () => {
    expect(PaginationQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
  it("accepts valid pageToken", () => {
    expect(PaginationQuerySchema.parse({ pageToken: "abc123" }).pageToken).toBe("abc123");
  });
  it("coerces string pageSize", () => {
    expect(PaginationQuerySchema.parse({ pageSize: "10" }).pageSize).toBe(10);
  });
});

describe("EntityParamSchema", () => {
  it("accepts accounts", () => {
    expect(EntityParamSchema.parse("accounts")).toBe("accounts");
  });
  it("rejects unknown entity", () => {
    expect(EntityParamSchema.safeParse("invoices").success).toBe(false);
  });
});
