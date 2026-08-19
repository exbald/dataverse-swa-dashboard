import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("no secrets in repo", () => {
  it("no DATAVERSE_CLIENT_SECRET value in tracked files", () => {
    const forbidden = [/client_secret/i, /sk_live/i];
    // Scan api/src for hardcoded secrets (allow env var references)
    const files = ["api/src/dataverse/live.ts", "api/src/env.ts"];
    for (const rel of files) {
      try {
        const content = readFileSync(join(process.cwd(), rel), "utf-8");
        // Allow process.env.DATAVERSE_CLIENT_SECRET but not literal values
        const lines = content.split("\n");
        for (const line of lines) {
          if (line.includes("DATAVERSE_CLIENT_SECRET") && line.includes("process.env")) continue;
          for (const pat of forbidden) {
            if (pat.test(line) && line.includes("=") && !line.includes("process.env")) {
              throw new Error(`Potential secret in ${rel}: ${line.trim()}`);
            }
          }
        }
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw e;
      }
    }
  });

  it("env examples contain only placeholders", () => {
    // .env.example lives at repo root (one level above api/)
    const envExample = readFileSync(join(process.cwd(), "..", ".env.example"), "utf-8");
    expect(envExample).toContain("your-org.crm.dynamics.com");
    expect(envExample).toContain("replace-with-client-secret");
  });

  it("no .env or local.settings.json committed", () => {
    const gitignore = readFileSync(join(process.cwd(), "..", ".gitignore"), "utf-8");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain("local.settings.json");
  });
});
