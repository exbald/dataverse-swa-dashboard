import type { EntityRecord, KpisResponse, PaginatedResponse, SupportedEntity } from "../contracts.js";

export interface ListEntitiesOptions {
  pageSize?: number;
  pageToken?: string;
  filter?: string;
  sort?: string;
  q?: string;
}

export interface DataverseService {
  /** List records for an entity with pagination/filter/sort/search. */
  listEntities(entity: SupportedEntity, options: ListEntitiesOptions): Promise<PaginatedResponse<EntityRecord>>;
  /** Get KPIs aggregated from entity data. */
  getKpis(): Promise<KpisResponse>;
}
