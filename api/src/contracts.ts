import { z } from "zod";

// ── Pagination shape ────────────────────────────────────────────
export const PaginationQuerySchema = z.object({
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  pageToken: z.string().optional(),
  filter: z.string().max(500).optional(),
  sort: z.string().max(200).optional(),
  q: z.string().max(200).optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export interface PaginatedResponse<T> {
  data: T[];
  nextPageToken?: string;
  totalCount?: number;
}

// ── Error shape ─────────────────────────────────────────────────
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    correlationId: string;
  };
}

// ── Entity config (placeholder — replace with real Dataverse schema) ──
export const SUPPORTED_ENTITIES = ["accounts", "contacts", "opportunities"] as const;
export type SupportedEntity = (typeof SUPPORTED_ENTITIES)[number];

export const EntityParamSchema = z.enum(SUPPORTED_ENTITIES);

// ── Generic entity record (placeholder fields) ──────────────────
// Marked PLACEHOLDER — replace with real logical names once supplied.
export interface EntityRecord {
  id: string;
  name: string;
  status: string;
  owner: string;
  createdOn: string; // ISO 8601
  amount?: number;
}

// ── KPI contracts ───────────────────────────────────────────────
export interface KpiCard {
  id: string;
  label: string;
  value: number | string;
  delta?: number;
  trend?: "up" | "down" | "flat";
}

export interface KpisResponse {
  kpis: KpiCard[];
  generatedAt: string;
}

// ── Health ──────────────────────────────────────────────────────
export interface HealthResponse {
  status: "ok";
  version: string;
  mode: "mock" | "live";
  timestamp: string;
}
