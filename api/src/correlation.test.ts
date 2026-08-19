import { describe, it, expect } from "vitest";
import { getCorrelationId } from "./correlation.js";

describe("getCorrelationId", () => {
  it("returns incoming if valid", () => {
    expect(getCorrelationId({ "x-correlation-id": "abc-12345" })).toBe("abc-12345");
  });
  it("generates uuid if missing", () => {
    const id = getCorrelationId({});
    expect(id.length).toBeGreaterThan(10);
  });
  it("generates new if incoming invalid", () => {
    const id = getCorrelationId({ "x-correlation-id": "x" });
    expect(id.length).toBeGreaterThan(10);
  });
});
