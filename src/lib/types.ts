import { z } from "zod";

// -- Domain types (placeholder entities, replaceable once Dataverse schema confirmed) --
export type EntityName = string;

export const KpiSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  delta: z.number().nullable().optional(),
  deltaLabel: z.string().nullable().optional(),
  trend: z.enum(["up", "down", "neutral"]).optional(),
});

export type Kpi = z.infer<typeof KpiSchema>;

export const KpisResponseSchema = z.object({
  kpis: z.array(KpiSchema),
  updatedAt: z.string().optional(),
});

export type KpisResponse = z.infer<typeof KpisResponseSchema>;

export const RecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  owner: z.string(),
  createdOn: z.string(),
  amount: z.number().nullable().optional(),
  // allow extra fields for custom entities
}).passthrough();

export type RecordItem = z.infer<typeof RecordSchema>;

export const PaginatedResponseSchema = z.object({
  data: z.array(RecordSchema),
  nextPageToken: z.string().nullable().optional(),
  totalCount: z.number().optional(),
});

export type PaginatedResponse = z.infer<typeof PaginatedResponseSchema>;

export const StatusBreakdownSchema = z.object({
  status: z.string(),
  count: z.number(),
});

export type StatusBreakdown = z.infer<typeof StatusBreakdownSchema>;

export const TrendPointSchema = z.object({
  date: z.string(),
  count: z.number(),
  amount: z.number().optional(),
});

export type TrendPoint = z.infer<typeof TrendPointSchema>;

export const ChartDataSchema = z.object({
  breakdown: z.array(StatusBreakdownSchema),
  trend: z.array(TrendPointSchema),
});

export type ChartData = z.infer<typeof ChartDataSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    correlationId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// Query params for entity listing
export type EntityQuery = {
  pageSize?: number;
  pageToken?: string | null;
  q?: string;
  status?: string;
  owner?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField?: string;
  sortDir?: "asc" | "desc";
  entity?: string;
};
