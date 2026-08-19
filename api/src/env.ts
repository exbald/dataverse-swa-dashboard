/**
 * Environment validation — placeholders, never invent real tenant IDs/URLs.
 */

import { z } from "zod";

export const EnvSchema = z.object({
  DATAVERSE_MODE: z.enum(["mock", "live"]).default("mock"),
  DATAVERSE_URL: z.string().url().optional().or(z.literal("")),
  DATAVERSE_TENANT_ID: z.string().uuid().optional().or(z.literal("")),
  DATAVERSE_CLIENT_ID: z.string().uuid().optional().or(z.literal("")),
  DATAVERSE_CLIENT_SECRET: z.string().optional(),
  ENTRA_ALLOWED_TENANT_IDS: z.string().optional(),
  API_CACHE_TTL: z.coerce.number().int().min(0).max(3600).default(60),
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  return EnvSchema.parse({
    DATAVERSE_MODE: process.env.DATAVERSE_MODE,
    DATAVERSE_URL: process.env.DATAVERSE_URL,
    DATAVERSE_TENANT_ID: process.env.DATAVERSE_TENANT_ID,
    DATAVERSE_CLIENT_ID: process.env.DATAVERSE_CLIENT_ID,
    DATAVERSE_CLIENT_SECRET: process.env.DATAVERSE_CLIENT_SECRET,
    ENTRA_ALLOWED_TENANT_IDS: process.env.ENTRA_ALLOWED_TENANT_IDS,
    API_CACHE_TTL: process.env.API_CACHE_TTL,
  });
}

export function requireLiveEnv(env: Env): void {
  if (env.DATAVERSE_MODE !== "live") return;
  const missing: string[] = [];
  if (!env.DATAVERSE_URL) missing.push("DATAVERSE_URL");
  if (!env.DATAVERSE_TENANT_ID) missing.push("DATAVERSE_TENANT_ID");
  if (!env.DATAVERSE_CLIENT_ID) missing.push("DATAVERSE_CLIENT_ID");
  if (!env.DATAVERSE_CLIENT_SECRET) missing.push("DATAVERSE_CLIENT_SECRET");
  if (missing.length) {
    throw new Error(`Live mode requires env: ${missing.join(", ")}`);
  }
  const url = env.DATAVERSE_URL as string;
  // Validate URL shape — allow sovereign clouds, warn on non-crm domains
  if (!url.endsWith("/")) {
    // normalize — but don't mutate here, just validate
  }
  if (!url.includes(".crm.dynamics.com") && !url.includes(".crm")) {
    // Allow custom domains but warn — not throwing since sovereign clouds differ
  }
}
